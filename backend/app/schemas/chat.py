import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.chat import MessageRole
from app.schemas.common import ORMModel


class Source(BaseModel):
    index: int
    document_id: uuid.UUID
    filename: str
    page_number: int
    snippet: str
    score: float


class MessageRead(ORMModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    sources: list[Source] | None
    created_at: datetime


class ConversationRead(ORMModel):
    id: uuid.UUID
    title: str
    document_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationRead):
    messages: list[MessageRead]


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    document_ids: list[uuid.UUID] = []


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    document_ids: list[uuid.UUID] | None = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
