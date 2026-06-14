from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import GenerationRequestModel, UserModel


async def get_request_owner(session: AsyncSession, request_id: UUID) -> UUID | None:
    result = await session.execute(
        select(GenerationRequestModel.user_id).where(GenerationRequestModel.id == request_id)
    )
    return result.scalar_one_or_none()


async def assert_can_access_request(
    session: AsyncSession,
    request_id: UUID,
    user: UserModel,
) -> None:
    if user.role == "admin":
        return

    owner_id = await get_request_owner(session, request_id)
    if owner_id is None or owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
