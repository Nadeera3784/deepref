from datetime import date

from pydantic import BaseModel


class Totals(BaseModel):
    users: int
    active_users: int
    documents: int
    chunks: int
    storage_bytes: int
    conversations: int
    questions: int
    total_tokens: int
    avg_latency_ms: float | None


class DailyActivity(BaseModel):
    day: date
    questions: int
    new_users: int
    documents: int


class TopUser(BaseModel):
    email: str
    full_name: str | None
    questions: int
    documents: int


class StatusCount(BaseModel):
    status: str
    count: int


class Analytics(BaseModel):
    totals: Totals
    daily: list[DailyActivity]
    top_users: list[TopUser]
    documents_by_status: list[StatusCount]


class ServiceHealth(BaseModel):
    database: bool
    storage: bool
    llm: bool
    embeddings: bool
