from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Date, cast, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models import Conversation, Document, DocumentChunk, Message, MessageRole, User
from app.schemas.admin import Analytics, DailyActivity, StatusCount, TopUser, Totals


async def _daily_counts(
    session: AsyncSession,
    column: InstrumentedAttribute[datetime],
    since: datetime,
    *filters: ColumnElement[bool],
) -> dict[date, int]:
    day = cast(func.date_trunc("day", column), Date).label("day")
    stmt = select(day, func.count()).where(column >= since, *filters).group_by(day)
    return {day_value: count for day_value, count in (await session.execute(stmt)).tuples()}


async def get_analytics(session: AsyncSession, days: int) -> Analytics:
    today = datetime.now(UTC).date()
    since = datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), tzinfo=UTC)

    users, active_users = (
        await session.execute(
            select(func.count(), func.count().filter(User.is_active.is_(True))).select_from(User)
        )
    ).one()
    documents, storage_bytes = (
        await session.execute(
            select(func.count(Document.id), func.coalesce(func.sum(Document.size_bytes), 0))
        )
    ).one()
    chunks = await session.scalar(select(func.count(DocumentChunk.id))) or 0
    conversations = await session.scalar(select(func.count(Conversation.id))) or 0
    questions = (
        await session.scalar(select(func.count(Message.id)).where(Message.role == MessageRole.USER))
        or 0
    )
    total_tokens, avg_latency = (
        await session.execute(
            select(
                func.coalesce(
                    func.sum(
                        func.coalesce(Message.prompt_tokens, 0)
                        + func.coalesce(Message.completion_tokens, 0)
                    ),
                    0,
                ),
                func.avg(Message.latency_ms),
            ).where(Message.role == MessageRole.ASSISTANT)
        )
    ).one()

    question_days = await _daily_counts(
        session, Message.created_at, since, Message.role == MessageRole.USER
    )
    user_days = await _daily_counts(session, User.created_at, since)
    document_days = await _daily_counts(session, Document.created_at, since)
    daily = [
        DailyActivity(
            day=day,
            questions=question_days.get(day, 0),
            new_users=user_days.get(day, 0),
            documents=document_days.get(day, 0),
        )
        for day in (today - timedelta(days=offset) for offset in range(days - 1, -1, -1))
    ]

    question_counts = (
        select(Conversation.user_id, func.count(Message.id).label("questions"))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Message.role == MessageRole.USER)
        .group_by(Conversation.user_id)
        .subquery()
    )
    document_counts = (
        select(Document.owner_id, func.count(Document.id).label("documents"))
        .group_by(Document.owner_id)
        .subquery()
    )
    top_rows = await session.execute(
        select(
            User.email,
            User.full_name,
            func.coalesce(question_counts.c.questions, 0).label("questions"),
            func.coalesce(document_counts.c.documents, 0).label("documents"),
        )
        .outerjoin(question_counts, question_counts.c.user_id == User.id)
        .outerjoin(document_counts, document_counts.c.owner_id == User.id)
        .order_by(literal_column("questions").desc(), literal_column("documents").desc())
        .limit(5)
    )

    status_rows = await session.execute(
        select(Document.status, func.count()).group_by(Document.status)
    )

    return Analytics(
        totals=Totals(
            users=users,
            active_users=active_users,
            documents=documents,
            chunks=chunks,
            storage_bytes=storage_bytes,
            conversations=conversations,
            questions=questions,
            total_tokens=total_tokens,
            avg_latency_ms=float(avg_latency) if avg_latency is not None else None,
        ),
        daily=daily,
        top_users=[
            TopUser(
                email=row.email,
                full_name=row.full_name,
                questions=row.questions,
                documents=row.documents,
            )
            for row in top_rows
        ],
        documents_by_status=[
            StatusCount(status=status.value, count=count) for status, count in status_rows
        ],
    )
