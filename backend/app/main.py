import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal, engine
from app.services.ingestion import fail_interrupted_ingestions
from app.services.storage import ObjectStorage
from app.services.users import ensure_first_admin

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with SessionLocal() as session:
        await ensure_first_admin(session)
    await fail_interrupted_ingestions()

    app.state.storage = ObjectStorage.from_settings()
    await app.state.storage.ensure_bucket()

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0)) as http:
        app.state.http = http
        yield
    await engine.dispose()


app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=None,
    lifespan=lifespan,
)

if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
