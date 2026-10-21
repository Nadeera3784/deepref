import uuid
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, EmbedderDep, SessionDep, StorageDep
from app.core.config import settings
from app.models import Document, User
from app.schemas.document import DocumentRead
from app.services.ingestion import ingest_document
from app.services.pdf import PDF_MAGIC
from app.services.storage import ObjectNotFoundError, StorageError, document_key

router = APIRouter(prefix="/documents", tags=["documents"])


async def _get_owned(session: SessionDep, user: User, document_id: uuid.UUID) -> Document:
    document = await session.get(Document, document_id)
    if document is None or document.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


@router.get("")
async def list_documents(session: SessionDep, user: CurrentUser) -> list[DocumentRead]:
    documents = await session.scalars(
        select(Document).where(Document.owner_id == user.id).order_by(Document.created_at.desc())
    )
    return [DocumentRead.model_validate(d) for d in documents]


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    session: SessionDep,
    user: CurrentUser,
    embedder: EmbedderDep,
    storage: StorageDep,
    background: BackgroundTasks,
    file: UploadFile,
) -> DocumentRead:
    """Store the PDF in object storage and index it in the background. Poll for `status`."""
    filename = (file.filename or "document.pdf").rsplit("/", 1)[-1][:255]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported")
    if file.size is None or file.size > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"File exceeds the {settings.MAX_UPLOAD_MB} MB limit",
        )
    if await file.read(len(PDF_MAGIC)) != PDF_MAGIC:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "File is not a valid PDF")
    await file.seek(0)

    document_id = uuid.uuid4()
    key = document_key(user.id, document_id)
    try:
        await storage.put(key, file.file, file.size, "application/pdf")
    except StorageError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "File storage is unavailable"
        ) from None

    document = Document(
        id=document_id,
        owner_id=user.id,
        filename=filename,
        storage_key=key,
        size_bytes=file.size,
    )
    session.add(document)
    try:
        await session.commit()
    except Exception:
        await storage.delete(key)
        raise

    background.add_task(ingest_document, document.id, embedder, storage)
    return DocumentRead.model_validate(document)


@router.get("/{document_id}")
async def get_document(
    session: SessionDep, user: CurrentUser, document_id: uuid.UUID
) -> DocumentRead:
    return DocumentRead.model_validate(await _get_owned(session, user, document_id))


@router.get(
    "/{document_id}/file",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/pdf": {}}}},
)
async def download_document(
    session: SessionDep, user: CurrentUser, storage: StorageDep, document_id: uuid.UUID
) -> StreamingResponse:
    """Stream the original PDF from object storage (the bucket itself is never public)."""
    document = await _get_owned(session, user, document_id)
    try:
        stored = await storage.open_stream(document.storage_key)
    except ObjectNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "The file for this document is missing"
        ) from None
    except StorageError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "File storage is unavailable"
        ) from None

    return StreamingResponse(
        stored.chunks,
        media_type="application/pdf",
        headers={
            "Content-Length": str(stored.size),
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(document.filename)}",
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    session: SessionDep, user: CurrentUser, storage: StorageDep, document_id: uuid.UUID
) -> None:
    document = await _get_owned(session, user, document_id)
    key = document.storage_key
    await session.delete(document)
    await session.commit()
    await storage.delete(key)
