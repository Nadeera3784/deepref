"""Background pipeline: PDF -> text -> chunks -> embeddings -> pgvector."""

import asyncio
import logging
import uuid
from typing import Any, cast

from sqlalchemy import CursorResult, update

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus
from app.services.chunking import chunk_pages
from app.services.embeddings import EmbeddingClient
from app.services.pdf import extract_pages
from app.services.storage import ObjectStorage

logger = logging.getLogger(__name__)

_ingest_slots = asyncio.Semaphore(2)


class EmptyDocumentError(Exception):
    pass


async def ingest_document(
    document_id: uuid.UUID, embedder: EmbeddingClient, storage: ObjectStorage
) -> None:
    async with _ingest_slots, SessionLocal() as session:
        document = await session.get(Document, document_id)
        if document is None:
            return
        try:
            pdf_bytes = await storage.get_bytes(document.storage_key)
            pages = await asyncio.to_thread(extract_pages, pdf_bytes)
            chunks = chunk_pages(pages, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
            if not chunks:
                raise EmptyDocumentError(
                    "No extractable text found. Scanned PDFs must be OCR'd before upload."
                )

            vectors = await embedder.embed([chunk.content for chunk in chunks])
            session.add_all(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    page_number=chunk.page_number,
                    content=chunk.content,
                    embedding=vector,
                )
                for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True))
            )
            document.page_count = len(pages)
            document.chunk_count = len(chunks)
            document.status = DocumentStatus.READY
            await session.commit()
            logger.info("Ingested document %s: %d chunks", document_id, len(chunks))
        except Exception as exc:
            logger.exception("Failed to ingest document %s", document_id)
            await session.rollback()
            document = await session.get(Document, document_id)
            if document is not None:
                document.status = DocumentStatus.FAILED
                document.error = str(exc)[:1000]
                await session.commit()


async def fail_interrupted_ingestions() -> None:
    """Documents left 'processing' by a restart will never finish; surface that to the user."""
    async with SessionLocal() as session:
        result = await session.execute(
            update(Document)
            .where(Document.status == DocumentStatus.PROCESSING)
            .values(
                status=DocumentStatus.FAILED,
                error="Processing was interrupted by a server restart. Please re-upload.",
            )
        )
        await session.commit()
        updated = cast("CursorResult[Any]", result).rowcount
        if updated:
            logger.warning("Marked %d interrupted documents as failed", updated)
