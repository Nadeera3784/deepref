import httpx

from app.core.config import settings


class EmbeddingError(Exception):
    pass


class EmbeddingClient:
    """Client for an OpenAI-compatible /embeddings endpoint (llama.cpp server)."""

    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        size = settings.EMBEDDING_BATCH_SIZE
        for start in range(0, len(texts), size):
            vectors.extend(await self._embed_batch(texts[start : start + size]))
        return vectors

    async def embed_query(self, query: str) -> list[float]:
        [vector] = await self._embed_batch([settings.EMBEDDING_QUERY_PREFIX + query])
        return vector

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        try:
            response = await self._http.post(
                f"{settings.EMBEDDING_BASE_URL}/embeddings",
                json={"model": settings.EMBEDDING_MODEL, "input": batch},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise EmbeddingError(f"Embedding service request failed: {exc}") from exc

        data = sorted(response.json()["data"], key=lambda item: item["index"])
        vectors: list[list[float]] = [item["embedding"] for item in data]
        if any(len(v) != settings.EMBEDDING_DIM for v in vectors):
            raise EmbeddingError(
                f"Embedding dimension mismatch: expected {settings.EMBEDDING_DIM}, "
                f"got {len(vectors[0])}. Check EMBEDDING_DIM against the embedding model."
            )
        return vectors
