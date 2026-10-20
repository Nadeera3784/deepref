import uuid
from typing import Any

import pytest

from app.api.routes import conversations
from app.models import Conversation, Message, MessageRole, User
from app.schemas.chat import Source

SOURCE = Source(
    index=1,
    document_id=uuid.uuid4(),
    filename="guide.pdf",
    page_number=3,
    snippet="Tomatoes prefer a soil pH between 5.5 and 6.8.",
    score=0.8,
)


class RecordingEmbedder:
    """Remembers every query; the "vector" is just the query's position in that list."""

    def __init__(self) -> None:
        self.queries: list[str] = []

    async def embed_query(self, text: str) -> list[float]:
        self.queries.append(text)
        return [float(len(self.queries) - 1)]


@pytest.fixture
def embedder(monkeypatch: pytest.MonkeyPatch) -> RecordingEmbedder:
    """Only queries mentioning 'pH' find a passage."""
    recorder = RecordingEmbedder()

    async def fake_retrieve(
        _session: Any, *, query_embedding: list[float], **_: Any
    ) -> list[Source]:
        return [SOURCE] if "pH" in recorder.queries[int(query_embedding[0])] else []

    monkeypatch.setattr(conversations, "retrieve", fake_retrieve)
    return recorder


async def find(embedder: RecordingEmbedder, question: str, history: list[Message]) -> list[Source]:
    return await conversations._find_sources(
        None,  # type: ignore[arg-type]
        embedder,  # type: ignore[arg-type]
        User(id=uuid.uuid4()),
        Conversation(document_ids=[]),
        question,
        history,
    )


async def test_off_topic_question_finds_nothing(embedder: RecordingEmbedder) -> None:
    assert await find(embedder, "Who is the CEO of Apple?", []) == []
    assert embedder.queries == ["Who is the CEO of Apple?"]  # no history, so no retry


async def test_vague_follow_up_retries_with_previous_question(embedder: RecordingEmbedder) -> None:
    history = [
        Message(role=MessageRole.USER, content="What soil pH do tomatoes need?"),
        Message(role=MessageRole.ASSISTANT, content="Between 5.5 and 6.8 [1]."),
    ]
    assert await find(embedder, "Tell me more", history) == [SOURCE]
    assert embedder.queries == ["Tell me more", "What soil pH do tomatoes need?\nTell me more"]


async def test_fixed_reply_streams_without_calling_the_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    class ExplodingLLM:
        def stream_chat(self, *_: Any) -> Any:
            raise AssertionError("LLM must not be called when there are no sources")

    saved: list[str] = []

    class FakeSession:
        def add(self, message: Message) -> None:
            saved.append(message.content)

        async def execute(self, *_: Any) -> None: ...
        async def commit(self) -> None: ...
        async def __aenter__(self) -> "FakeSession":
            return self

        async def __aexit__(self, *_: Any) -> None: ...

    monkeypatch.setattr(conversations, "SessionLocal", FakeSession)
    events = [
        e
        async for e in conversations._stream_answer(
            uuid.uuid4(),
            conversations.NO_ANSWER_MESSAGE,
            [],
            ExplodingLLM(),  # type: ignore[arg-type]
        )
    ]
    assert events[0] == "event: sources\ndata: []\n\n"
    assert conversations.NO_ANSWER_MESSAGE in events[1]
    assert events[-1].startswith("event: done")
    assert saved == [conversations.NO_ANSWER_MESSAGE]


def test_unanswered_turns_are_left_out_of_history() -> None:
    def msg(role: str, content: str) -> Message:
        return Message(role=MessageRole(role), content=content)

    history = [
        msg("user", "Who is the CEO of Apple?"),
        msg("assistant", conversations.NO_ANSWER_MESSAGE),
        msg("user", "What soil pH do tomatoes need?"),
        msg("assistant", "Between 5.5 and 6.8 [1]."),
    ]
    assert [m.content for m in conversations._informative(history)] == [
        "What soil pH do tomatoes need?",
        "Between 5.5 and 6.8 [1].",
    ]
