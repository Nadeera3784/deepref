from typing import Any

import pytest

from app.api.routes import conversations
from app.models import Message, MessageRole
from app.services.llm import Usage
from app.services.rag import (
    NO_ANSWER_FROM_PASSAGES,
    RETRY_INSTRUCTION,
    is_citation_only,
    with_retry_instruction,
)

PROMPT = [{"role": "system", "content": "context"}, {"role": "user", "content": "What is X?"}]


@pytest.mark.parametrize("text", ["[1]", " [1]\n", "[1][2]", "[1, 2]", "[1.4]", "", "  "])
def test_citation_only_replies_are_detected(text: str) -> None:
    assert is_citation_only(text)


@pytest.mark.parametrize(
    "text", ["3 hours [1]", "No [1]", "Yes.", "[1] Tomatoes prefer a soil pH of 5.5 to 6.8."]
)
def test_short_real_answers_are_kept(text: str) -> None:
    assert not is_citation_only(text)


def test_retry_instruction_is_added_to_a_copy_of_the_question() -> None:
    retried = with_retry_instruction(PROMPT)
    assert retried[-1]["content"] == f"What is X?\n\n{RETRY_INSTRUCTION}"
    assert retried[0] == PROMPT[0]
    assert PROMPT[-1]["content"] == "What is X?"  # original untouched


class ScriptedLLM:
    """Replies with the next scripted token list on each call and reports token usage."""

    def __init__(self, *replies: list[str]) -> None:
        self.replies = list(replies)
        self.prompts: list[list[dict[str, str]]] = []

    async def stream_chat(self, messages: list[dict[str, str]], usage: Usage) -> Any:
        self.prompts.append(messages)
        usage.prompt_tokens, usage.completion_tokens = 100, 10
        for token in self.replies.pop(0):
            yield token


async def run(llm: ScriptedLLM) -> tuple[str, Usage]:
    usage = Usage()
    text = "".join([d async for d in conversations._generate(llm, PROMPT, usage)])  # type: ignore[arg-type]
    return text, usage


async def test_normal_answer_streams_without_a_retry() -> None:
    llm = ScriptedLLM(["[", "1", "]", " Growth", " habit", " is", " upright."])
    text, usage = await run(llm)
    assert text == "[1] Growth habit is upright."
    assert len(llm.prompts) == 1
    assert (usage.prompt_tokens, usage.completion_tokens) == (100, 10)


async def test_citation_only_answer_is_hidden_and_retried_with_a_nudge() -> None:
    llm = ScriptedLLM(["[", "1", "]"], ["Tomatoes", " grow", " upright", " [1]."])
    text, usage = await run(llm)
    assert text == "Tomatoes grow upright [1]."  # the bare "[1]" never reached the user
    assert llm.prompts[1][-1]["content"].endswith(RETRY_INSTRUCTION)
    assert (usage.prompt_tokens, usage.completion_tokens) == (200, 20)  # both attempts billed


async def test_gives_an_honest_message_when_the_retry_also_fails() -> None:
    text, _ = await run(ScriptedLLM(["[1]"], ["[", "1", "]"]))
    assert text == NO_ANSWER_FROM_PASSAGES


def test_citation_only_turns_are_left_out_of_history() -> None:
    def msg(role: str, content: str) -> Message:
        return Message(role=MessageRole(role), content=content)

    history = [
        msg("user", "What is Growth Habit?"),
        msg("assistant", "[1]"),
        msg("user", "What soil pH do tomatoes need?"),
        msg("assistant", "Between 5.5 and 6.8 [1]."),
        msg("user", "What is X?"),
        msg("assistant", NO_ANSWER_FROM_PASSAGES),
    ]
    assert [m.content for m in conversations._informative(history)] == [
        "What soil pH do tomatoes need?",
        "Between 5.5 and 6.8 [1].",
    ]
