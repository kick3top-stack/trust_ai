from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.billing import CreateDisputeRequest, CreditAdjustRequest, UpdateDisputeRequest
from app.config import settings
from app.database.session import get_session
from app.dependencies import get_current_user, require_admin
from app.models.orm import GenerationRequestModel, UserModel
from app.services.auth_service import AuthService, user_to_dict
from app.services.credit_cost import tokens_per_credit
from app.services.credit_service import CreditService
from app.services.dispute_service import DisputeService

billing_router = APIRouter(prefix="/billing", tags=["billing"])
support_router = APIRouter(prefix="/admin/support", tags=["support"])
disputes_router = APIRouter(prefix="/disputes", tags=["disputes"])


@billing_router.get("/config")
async def billing_config() -> dict[str, int | float]:
    rate = settings.trustai_credit_rate
    return {
        "credit_rate": rate,
        "tokens_per_credit": tokens_per_credit(rate),
        "min_credits": 1,
    }


@billing_router.get("/statement")
async def credit_statement(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    rows = await CreditService(session).list_for_user(user.id, limit=min(limit, 100))
    return {
        "balance": user.credit_balance,
        "transactions": [CreditService.to_dict(r) for r in rows],
    }


@support_router.get("/lookup")
async def support_lookup(
    email: str | None = None,
    request_id: str | None = None,
    limit: int = 25,
    _: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from app.models.orm import UserModel as UserOrm

    auth = AuthService(session)
    target_user: UserOrm | None = None
    if email:
        target_user = await auth.get_by_email(email.strip())
        if target_user is None:
            raise HTTPException(status_code=404, detail="User not found")

    query = select(GenerationRequestModel).order_by(GenerationRequestModel.created_at.desc())
    if request_id:
        try:
            rid = UUID(request_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid request_id") from exc
        query = query.where(GenerationRequestModel.id == rid)
    elif target_user:
        query = query.where(GenerationRequestModel.user_id == target_user.id)

    query = query.limit(min(limit, 100))
    result = await session.execute(query)
    rows = list(result.scalars().all())

    user_ids = {r.user_id for r in rows if r.user_id}
    users_by_id: dict[UUID, UserOrm] = {}
    if user_ids:
        users_result = await session.execute(select(UserOrm).where(UserOrm.id.in_(user_ids)))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

    generations = []
    for r in rows:
        owner = users_by_id.get(r.user_id) if r.user_id else None
        generations.append(
            {
                "request_id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "user_email": owner.email if owner else None,
                "user_display_name": owner.display_name if owner else None,
                "created_at": r.created_at.isoformat(),
                "status": r.status,
                "model_name": r.model_name,
                "credit_cost": r.credit_cost,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "prompt_text": r.prompt_text,
                "response_text": r.response_text,
            }
        )

    return {
        "user": user_to_dict(target_user) if target_user else None,
        "generations": generations,
    }


@support_router.post("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: UUID,
    body: CreditAdjustRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    service = AuthService(session)
    try:
        updated = await service.adjust_user_credits(
            user_id,
            amount=body.amount,
            reason=body.reason,
            actor_id=admin.id,
        )
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return user_to_dict(updated)


@disputes_router.post("")
async def create_dispute(
    body: CreateDisputeRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from app.services.auth_service import AuthService

    try:
        rid = UUID(body.request_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid request_id") from exc

    service = DisputeService(session)
    try:
        row = await service.create(user=user, request_id=rid, reason=body.reason)
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DisputeService.to_dict(row, user_email=user.email)


@disputes_router.get("")
async def list_my_disputes(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> dict[str, Any]:
    rows = await DisputeService(session).list_for_user(user.id, limit=min(limit, 100))
    return {"disputes": [DisputeService.to_dict(r, user_email=user.email) for r in rows]}


@support_router.get("/disputes")
async def list_disputes(
    status: str | None = None,
    limit: int = 50,
    _: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from app.models.orm import UserModel as UserOrm

    rows = await DisputeService(session).list_all(status=status, limit=min(limit, 100))
    user_ids = {r.user_id for r in rows}
    users_by_id: dict[UUID, UserOrm] = {}
    if user_ids:
        result = await session.execute(select(UserOrm).where(UserOrm.id.in_(user_ids)))
        users_by_id = {u.id: u for u in result.scalars().all()}

    return {
        "disputes": [
            DisputeService.to_dict(r, user_email=users_by_id.get(r.user_id).email if r.user_id in users_by_id else None)
            for r in rows
        ]
    }


@support_router.patch("/disputes/{dispute_id}")
async def update_dispute(
    dispute_id: UUID,
    body: UpdateDisputeRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from app.models.orm import UserModel as UserOrm

    service = DisputeService(session)
    try:
        row = await service.update_status(
            dispute_id,
            status=body.status,
            resolution_note=body.resolution_note,
            admin=admin,
        )
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user_result = await session.execute(select(UserOrm).where(UserOrm.id == row.user_id))
    owner = user_result.scalar_one_or_none()
    return DisputeService.to_dict(row, user_email=owner.email if owner else None)
