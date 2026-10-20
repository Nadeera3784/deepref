import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import User, UserRole

logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(User.email == normalize_email(email)))


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str | None = None,
    role: UserRole = UserRole.USER,
    is_active: bool = True,
) -> User:
    user = User(
        email=normalize_email(email),
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def count_active_admins(session: AsyncSession) -> int:
    return (
        await session.scalar(
            select(func.count()).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        )
        or 0
    )


async def ensure_first_admin(session: AsyncSession) -> None:
    if await get_by_email(session, settings.FIRST_ADMIN_EMAIL) is not None:
        return
    await create_user(
        session,
        email=settings.FIRST_ADMIN_EMAIL,
        password=settings.FIRST_ADMIN_PASSWORD.get_secret_value(),
        full_name="Administrator",
        role=UserRole.ADMIN,
    )
    await session.commit()
    logger.info("Created initial admin user %s", settings.FIRST_ADMIN_EMAIL)
