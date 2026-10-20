import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import User
from app.services.embeddings import EmbeddingClient
from app.services.llm import LLMClient
from app.services.storage import ObjectStorage

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

SessionDep = Annotated[AsyncSession, Depends(get_session)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise _credentials_error from None

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise _credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def get_embedder(request: Request) -> EmbeddingClient:
    return EmbeddingClient(request.app.state.http)


def get_llm(request: Request) -> LLMClient:
    return LLMClient(request.app.state.http)


def get_storage(request: Request) -> ObjectStorage:
    storage: ObjectStorage = request.app.state.storage
    return storage


EmbedderDep = Annotated[EmbeddingClient, Depends(get_embedder)]
LLMDep = Annotated[LLMClient, Depends(get_llm)]
StorageDep = Annotated[ObjectStorage, Depends(get_storage)]
