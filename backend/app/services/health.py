import asyncio
import logging

import httpx
from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal
from app.schemas.admin import ServiceHealth
from app.services.storage import ObjectStorage

logger = logging.getLogger(__name__)


async def check_database() -> bool:
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.warning("Database health check failed", exc_info=True)
        return False


async def _check_http(http: httpx.AsyncClient, base_url: str) -> bool:
    url = base_url.removesuffix("/").removesuffix("/v1") + "/health"
    try:
        response = await http.get(url, timeout=3)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


async def check_services(http: httpx.AsyncClient, storage: ObjectStorage) -> ServiceHealth:
    database, storage_ok, llm, embeddings = await asyncio.gather(
        check_database(),
        storage.ping(),
        _check_http(http, settings.LLM_BASE_URL),
        _check_http(http, settings.EMBEDDING_BASE_URL),
    )
    return ServiceHealth(database=database, storage=storage_ok, llm=llm, embeddings=embeddings)
