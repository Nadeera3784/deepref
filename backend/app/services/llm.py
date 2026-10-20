import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


class LLMError(Exception):
    pass


@dataclass(slots=True)
class Usage:
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class LLMClient:
    """Streaming chat client for an OpenAI-compatible /chat/completions endpoint."""

    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def stream_chat(self, messages: list[dict[str, str]], usage: Usage) -> AsyncIterator[str]:
        """Yield content deltas. Token counts are written into `usage` when the stream ends."""
        payload: dict[str, Any] = {
            "model": settings.LLM_MODEL,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "max_tokens": settings.LLM_MAX_TOKENS,
            "temperature": settings.LLM_TEMPERATURE,
        }
        try:
            async with self._http.stream(
                "POST",
                f"{settings.LLM_BASE_URL}/chat/completions",
                json=payload,
                timeout=settings.LLM_TIMEOUT_SECONDS,
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode(errors="replace")[:500]
                    raise LLMError(f"LLM returned {response.status_code}: {body}")

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    if chunk_usage := chunk.get("usage"):
                        usage.prompt_tokens = chunk_usage.get("prompt_tokens")
                        usage.completion_tokens = chunk_usage.get("completion_tokens")
                    for choice in chunk.get("choices", []):
                        if content := (choice.get("delta") or {}).get("content"):
                            yield content
        except httpx.HTTPError as exc:
            raise LLMError(f"LLM request failed: {exc}") from exc
