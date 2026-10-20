from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import SessionDep
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.schemas.auth import RegisterRequest, Token
from app.schemas.user import UserRead
from app.services import users as user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(
    session: SessionDep, form: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """OAuth2 password flow. `username` is the user's email address."""
    user = await user_service.get_by_email(session, form.username)
    if not verify_password(form.password, user.hashed_password if user else None) or not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled")

    user.last_login_at = datetime.now(UTC)
    await session.commit()
    token, expires_in = create_access_token(user.id, user.role.value)
    return Token(access_token=token, expires_in=expires_in)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(session: SessionDep, body: RegisterRequest) -> UserRead:
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Self-registration is disabled")
    if await user_service.get_by_email(session, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = await user_service.create_user(
        session, email=body.email, password=body.password, full_name=body.full_name
    )
    await session.commit()
    return UserRead.model_validate(user)
