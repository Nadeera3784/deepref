import uuid

from app.models import Message, MessageRole
from app.schemas.chat import Source
from app.services.rag import build_messages


def test_build_messages_includes_numbered_context_and_history() -> None:
    sources = [
        Source(
            index=1,
            document_id=uuid.uuid4(),
            filename="guide.pdf",
            page_number=4,
            snippet="The warranty lasts two years.",
            score=0.9,
        )
    ]
    history = [
        Message(role=MessageRole.USER, content="Hi"),
        Message(role=MessageRole.ASSISTANT, content="Hello!"),
    ]
    messages = build_messages("How long is the warranty?", sources, history)

    assert messages[0]["role"] == "system"
    assert "[1]\nThe warranty lasts two years." in messages[0]["content"]
    assert [m["role"] for m in messages[1:3]] == ["user", "assistant"]
    assert messages[-1] == {"role": "user", "content": "How long is the warranty?"}
