import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, EmbedderDep, LLMDep, SessionDep
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Conversation, Document, Message, MessageRole, User
from app.schemas.chat import (
    ConversationCreate,
    ConversationDetail,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
    Source,
)
from app.schemas.common import Page
from app.services.embeddings import EmbeddingError
from app.services.llm import LLMClient, LLMError, Usage
from app.services.rag import (
    NO_ANSWER_MESSAGE,
    NO_ANSWER_MESSAGE_SCOPED,
    build_messages,
    retrieve,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])

DEFAULT_TITLE = "New chat"


async def _get_owned(
    session: SessionDep, user: User, conversation_id: uuid.UUID, *, with_messages: bool = False
) -> Conversation:
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == user.id
    )
    if with_messages:
        stmt = stmt.options(selectinload(Conversation.messages))
    conversation = await session.scalar(stmt)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conversation


async def _validate_document_ids(
    session: SessionDep, user: User, document_ids: list[uuid.UUID]
) -> list[uuid.UUID]:
    unique = list(dict.fromkeys(document_ids))
    if not unique:
        return []
    owned = await session.scalar(
        select(func.count()).where(Document.id.in_(unique), Document.owner_id == user.id)
    )
    if owned != len(unique):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more documents were not found")
    return unique


@router.get("")
async def list_conversations(
    session: SessionDep,
    user: CurrentUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ConversationRead]:
    base = select(Conversation).where(Conversation.user_id == user.id)
    if q:
        base = base.where(Conversation.title.ilike(f"%{q}%"))
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = await session.scalars(
        base.order_by(Conversation.updated_at.desc()).limit(limit).offset(offset)
    )
    return Page(
        items=[ConversationRead.model_validate(c) for c in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    session: SessionDep, user: CurrentUser, body: ConversationCreate
) -> ConversationRead:
    conversation = Conversation(
        user_id=user.id,
        title=body.title or DEFAULT_TITLE,
        document_ids=await _validate_document_ids(session, user, body.document_ids),
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return ConversationRead.model_validate(conversation)


@router.get("/{conversation_id}")
async def get_conversation(
    session: SessionDep, user: CurrentUser, conversation_id: uuid.UUID
) -> ConversationDetail:
    conversation = await _get_owned(session, user, conversation_id, with_messages=True)
    return ConversationDetail.model_validate(conversation)


@router.patch("/{conversation_id}")
async def update_conversation(
    session: SessionDep, user: CurrentUser, conversation_id: uuid.UUID, body: ConversationUpdate
) -> ConversationRead:
    conversation = await _get_owned(session, user, conversation_id)
    if body.title is not None:
        conversation.title = body.title
    if body.document_ids is not None:
        conversation.document_ids = await _validate_document_ids(session, user, body.document_ids)
    await session.commit()
    await session.refresh(conversation)
    return ConversationRead.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    session: SessionDep, user: CurrentUser, conversation_id: uuid.UUID
) -> None:
    await session.delete(await _get_owned(session, user, conversation_id))
    await session.commit()


@router.post(
    "/{conversation_id}/messages",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def send_message(
    session: SessionDep,
    user: CurrentUser,
    embedder: EmbedderDep,
    llm: LLMDep,
    conversation_id: uuid.UUID,
    body: MessageCreate,
) -> StreamingResponse:
    """Ask a question. Streams Server-Sent Events: `sources`, `token`*, then `done` or `error`."""
    conversation = await _get_owned(session, user, conversation_id)
    question = body.content.strip()

    recent = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(settings.HISTORY_MESSAGES)
    )
    history = _informative(list(reversed(recent.all())))

    try:
        sources = await _find_sources(session, embedder, user, conversation, question, history)
    except EmbeddingError:
        logger.exception("Query embedding failed")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The embedding service is unavailable"
        ) from None

    if sources:
        answer: list[dict[str, str]] | str = build_messages(question, sources, history)
    else:
        answer = NO_ANSWER_MESSAGE_SCOPED if conversation.document_ids else NO_ANSWER_MESSAGE

    if not history and conversation.title == DEFAULT_TITLE:
        conversation.title = question[:80]
    conversation.updated_at = func.now()
    session.add(Message(conversation_id=conversation.id, role=MessageRole.USER, content=question))
    await session.commit()

    return StreamingResponse(
        _stream_answer(conversation.id, answer, sources, llm),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _informative(history: list[Message]) -> list[Message]:
    """Drop unanswered turns (a question plus its fixed no-answer reply) from the history sent to
    the model. They carry no information, and a small model copies the refusal into later answers.
    """
    no_answer = {NO_ANSWER_MESSAGE, NO_ANSWER_MESSAGE_SCOPED}
    kept: list[Message] = []
    for message in history:
        if message.role == MessageRole.ASSISTANT and message.content in no_answer:
            if kept and kept[-1].role == MessageRole.USER:
                kept.pop()
            continue
        kept.append(message)
    return kept


async def _find_sources(
    session: SessionDep,
    embedder: EmbedderDep,
    user: User,
    conversation: Conversation,
    question: str,
    history: list[Message],
) -> list[Source]:
    """Retrieve relevant passages. Vague follow-ups ("tell me more") match nothing on their own,
    so if the question alone finds nothing, retry with the previous question for context."""

    async def search(text: str) -> list[Source]:
        return await retrieve(
            session,
            user_id=user.id,
            query_embedding=await embedder.embed_query(text),
            document_ids=conversation.document_ids,
        )

    sources = await search(question)
    previous = next((m.content for m in reversed(history) if m.role == MessageRole.USER), None)
    if not sources and previous:
        sources = await search(f"{previous}\n{question}")
    return sources


async def _single(text: str) -> AsyncIterator[str]:
    yield text


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_answer(
    conversation_id: uuid.UUID,
    prompt: list[dict[str, str]] | str,
    sources: list[Source],
    llm: LLMClient,
) -> AsyncIterator[str]:
    """Stream the answer as SSE. `prompt` is either LLM messages or a fixed reply to send as-is."""
    message_id = uuid.uuid4()
    parts: list[str] = []
    usage = Usage()
    started = time.perf_counter()
    saved = False

    async def save() -> None:
        # The request-scoped session is closed once streaming starts, so use a fresh one.
        try:
            async with SessionLocal() as session:
                session.add(
                    Message(
                        id=message_id,
                        conversation_id=conversation_id,
                        role=MessageRole.ASSISTANT,
                        content="".join(parts).strip(),
                        sources=[s.model_dump(mode="json") for s in sources],
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        latency_ms=int((time.perf_counter() - started) * 1000),
                    )
                )
                await session.execute(
                    update(Conversation)
                    .where(Conversation.id == conversation_id)
                    .values(updated_at=func.now())
                )
                await session.commit()
        except Exception:
            logger.exception("Failed to save assistant message for %s", conversation_id)

    try:
        yield _sse("sources", [s.model_dump(mode="json") for s in sources])
        deltas = _single(prompt) if isinstance(prompt, str) else llm.stream_chat(prompt, usage)
        async for delta in deltas:
            parts.append(delta)
            yield _sse("token", {"content": delta})
        await save()
        saved = True
        yield _sse("done", {"message_id": str(message_id)})
    except LLMError:
        logger.exception("LLM streaming failed")
        yield _sse("error", {"detail": "The language model is unavailable. Please try again."})
    finally:
        # Client disconnected mid-answer: keep whatever was generated so history stays coherent.
        if not saved and parts:
            await asyncio.shield(save())
