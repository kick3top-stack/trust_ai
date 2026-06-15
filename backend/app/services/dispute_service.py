from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import DisputeModel, GenerationRequestModel, UserModel


DISPUTE_STATUSES = ("open", "investigating", "resolved_refund", "resolved_denied", "closed")


class DisputeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user: UserModel,
        request_id: UUID,
        reason: str,
    ) -> DisputeModel:
        result = await self._session.execute(
            select(GenerationRequestModel).where(GenerationRequestModel.id == request_id)
        )
        gen = result.scalar_one_or_none()
        if gen is None:
            raise ValueError("Generation not found")
        if gen.user_id != user.id and user.role != "admin":
            raise ValueError("Access denied")

        existing = await self._session.execute(
            select(DisputeModel).where(
                DisputeModel.request_id == request_id,
                DisputeModel.user_id == user.id,
                DisputeModel.status.in_(("open", "investigating")),
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ValueError("An open dispute already exists for this request")

        row = DisputeModel(
            id=uuid4(),
            user_id=user.id,
            request_id=request_id,
            reason=reason.strip(),
            status="open",
            credit_cost=gen.credit_cost,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def list_for_user(self, user_id: UUID, *, limit: int = 50) -> list[DisputeModel]:
        result = await self._session.execute(
            select(DisputeModel)
            .where(DisputeModel.user_id == user_id)
            .order_by(DisputeModel.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_all(self, *, status: str | None = None, limit: int = 50) -> list[DisputeModel]:
        query = select(DisputeModel).order_by(DisputeModel.created_at.desc())
        if status:
            query = query.where(DisputeModel.status == status)
        query = query.limit(limit)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def update_status(
        self,
        dispute_id: UUID,
        *,
        status: str,
        resolution_note: str | None,
        admin: UserModel,
    ) -> DisputeModel:
        if status not in DISPUTE_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(DISPUTE_STATUSES)}")

        result = await self._session.execute(
            select(DisputeModel).where(DisputeModel.id == dispute_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise ValueError("Dispute not found")

        row.status = status
        row.resolution_note = resolution_note.strip() if resolution_note else None
        row.resolved_by = admin.id
        row.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return row

    @staticmethod
    def to_dict(row: DisputeModel, *, user_email: str | None = None) -> dict:
        return {
            "id": str(row.id),
            "user_id": str(row.user_id),
            "user_email": user_email,
            "request_id": str(row.request_id),
            "reason": row.reason,
            "status": row.status,
            "credit_cost": row.credit_cost,
            "resolution_note": row.resolution_note,
            "resolved_by": str(row.resolved_by) if row.resolved_by else None,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
