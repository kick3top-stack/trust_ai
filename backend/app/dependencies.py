from functools import lru_cache
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_session
from app.domain.interfaces.inference_provider import InferenceProvider
from app.inference.factory import create_inference_provider
from app.models.orm import UserModel
from app.services.auth_service import AuthService, decode_access_token
from app.services.generation_service import GenerationService

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_inference_provider() -> InferenceProvider:
    return create_inference_provider()


def get_generation_service(
    session: AsyncSession = Depends(get_session),
    inference: InferenceProvider = Depends(get_inference_provider),
) -> GenerationService:
    return GenerationService(session, inference)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> UserModel | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = UUID(payload["sub"])
    except Exception:
        return None

    service = AuthService(session)
    user = await service.get_by_id(user_id)
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(
    user: UserModel | None = Depends(get_current_user_optional),
) -> UserModel:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(user: UserModel = Depends(get_current_user)) -> UserModel:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
