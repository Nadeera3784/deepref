"""Retrieval and prompt construction for document-grounded chat."""

import re
import uuid
from collections.abc import Sequence

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Document, DocumentChunk, DocumentStatus, Message
from app.schemas.chat import Source

SYSTEM_PROMPT = (
    "You are DeepRef, an assistant that answers questions about the user's documents.\n"
    "Answer using only the facts in the context passages below. Never use outside or general "
    "knowledge, even if you know the answer. Answer directly and concisely, then cite the "
    "passage numbers you used in square brackets, like [1]. "
    "If the passages do not answer the question, reply only that you could not find it in the "
    "documents."
)

NO_ANSWER_MESSAGE = (
    "I couldn't find anything about that in your documents. Try rephrasing your question, "
    "or upload a PDF that covers it."
)
NO_ANSWER_MESSAGE_SCOPED = (
    "I couldn't find anything about that in the selected documents. Try rephrasing your "
    "question, or search all documents instead."
)

NO_ANSWER_FROM_PASSAGES = (
    "I found passages that look related but couldn't put an answer together from them. "
    "Check the sources below, or try asking in a different way."
)

RETRY_INSTRUCTION = "Answer in full sentences using the passages, then add the citation."

_CITATION = re.compile(r"\[[\d.,\s]*\]")
_MIN_ANSWER_WORD_CHARS = 2


def is_citation_only(text: str) -> bool:
    """True if `text` has no real words once citation markers like [1] or [1.4] are removed.

    Deliberately loose: a terse but real answer such as "3 hours [1]" is still an answer.
    """
    words = _CITATION.sub("", text)
    return sum(ch.isalnum() for ch in words) < _MIN_ANSWER_WORD_CHARS


def with_retry_instruction(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Copy of the prompt with RETRY_INSTRUCTION appended to the final user question."""
    *rest, question = messages
    return [*rest, {**question, "content": f"{question['content']}\n\n{RETRY_INSTRUCTION}"}]


MAX_HISTORY_CHARS = 1500


async def retrieve(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    query_embedding: list[float],
    document_ids: Sequence[uuid.UUID] = (),
    top_k: int = settings.RETRIEVAL_TOP_K,
) -> list[Source]:
    await session.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))

    distance = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")
    stmt = (
        select(
            DocumentChunk.document_id,
            DocumentChunk.page_number,
            DocumentChunk.content,
            Document.filename,
            distance,
        )
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.owner_id == user_id, Document.status == DocumentStatus.READY)
        .order_by(distance)
        .limit(top_k)
    )
    if document_ids:
        stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))

    rows = (await session.execute(stmt)).all()
    return [
        Source(
            index=index,
            document_id=row.document_id,
            filename=row.filename,
            page_number=row.page_number,
            snippet=row.content,
            score=round(1 - row.distance, 4),
        )
        for index, row in enumerate(
            (row for row in rows if 1 - row.distance >= settings.RETRIEVAL_MIN_SCORE), start=1
        )
    ]


def build_messages(
    question: str, sources: list[Source], history: Sequence[Message]
) -> list[dict[str, str]]:
    """Build the chat prompt. Only call with sources; see NO_ANSWER_MESSAGE for the empty case."""
    context = "\n\n".join(f"[{s.index}]\n{s.snippet}" for s in sources)
    messages = [{"role": "system", "content": f"{SYSTEM_PROMPT}\n\nContext:\n{context}"}]
    messages.extend(
        {"role": m.role.value, "content": m.content[:MAX_HISTORY_CHARS]} for m in history
    )
    messages.append({"role": "user", "content": question})
    return messages
