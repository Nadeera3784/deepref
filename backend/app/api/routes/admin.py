import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select

from app.api.deps import AdminUser, SessionDep, StorageDep
from app.core.security import hash_password
from app.models import Conversation, Document, User, UserRole
from app.schemas.admin import Analytics, ServiceHealth
from app.schemas.common import Page
from app.schemas.user import UserAdminRead, UserCreate, UserUpdate
from app.services import users as user_service
from app.services.analytics import get_analytics
from app.services.health import check_services
from app.services.storage import user_prefix

router = APIRouter(prefix="/admin", tags=["admin"])


async def _get_user(session: SessionDep, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def _to_admin_read(session: SessionDep, user: User) -> UserAdminRead:
    documents = await session.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user.id)
    )
    conversations = await session.scalar(
        select(func.count(Conversation.id)).where(Conversation.user_id == user.id)
    )
    return UserAdminRead.model_validate(user).model_copy(
        update={"document_count": documents or 0, "conversation_count": conversations or 0}
    )


@router.get("/users")
async def list_users(
    session: SessionDep,
    _: AdminUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[UserAdminRead]:
    filters = []
    if q:
        filters.append(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))

    document_count = (
        select(func.count(Document.id)).where(Document.owner_id == User.id).scalar_subquery()
    )
    conversation_count = (
        select(func.count(Conversation.id)).where(Conversation.user_id == User.id).scalar_subquery()
    )
    total = await session.scalar(select(func.count(User.id)).where(*filters)) or 0
    rows = await session.execute(
        select(User, document_count, conversation_count)
        .where(*filters)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        UserAdminRead.model_validate(user).model_copy(
            update={"document_count": docs, "conversation_count": convs}
        )
        for user, docs, convs in rows
    ]
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(session: SessionDep, _: AdminUser, body: UserCreate) -> UserAdminRead:
    if await user_service.get_by_email(session, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = await user_service.create_user(session, **body.model_dump())
    await session.commit()
    return UserAdminRead.model_validate(user)


@router.patch("/users/{user_id}")
async def update_user(
    session: SessionDep, admin: AdminUser, user_id: uuid.UUID, body: UserUpdate
) -> UserAdminRead:
    user = await _get_user(session, user_id)
    changes = body.model_dump(exclude_unset=True)

    demoting = changes.get("role") == UserRole.USER or changes.get("is_active") is False
    if user.id == admin.id and demoting:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin access")
    if user.is_admin and demoting and await user_service.count_active_admins(session) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one active admin is required")

    if (password := changes.pop("password", None)) is not None:
        user.hashed_password = hash_password(password)
    for field, value in changes.items():
        if value is not None or field == "full_name":
            setattr(user, field, value)
    await session.commit()
    return await _to_admin_read(session, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    session: SessionDep, storage: StorageDep, admin: AdminUser, user_id: uuid.UUID
) -> None:
    user = await _get_user(session, user_id)
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    await session.delete(user)
    await session.commit()
    await storage.delete_prefix(user_prefix(user_id))


@router.get("/analytics")
async def analytics(
    session: SessionDep, _: AdminUser, days: Annotated[int, Query(ge=7, le=365)] = 30
) -> Analytics:
    return await get_analytics(session, days)


@router.get("/health")
async def service_health(request: Request, storage: StorageDep, _: AdminUser) -> ServiceHealth:
    return await check_services(request.app.state.http, storage)
