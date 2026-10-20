import uuid
from datetime import datetime

from app.models.document import DocumentStatus
from app.schemas.common import ORMModel


class DocumentRead(ORMModel):
    id: uuid.UUID
    filename: str
    size_bytes: int
    page_count: int
    chunk_count: int
    status: DocumentStatus
    error: str | None
    created_at: datetime
