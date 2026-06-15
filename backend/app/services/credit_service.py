from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import CreditTransactionModel


class CreditService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        *,
        user_id: UUID,
        amount: int,
        balance_after: int,
        txn_type: str,
        description: str,
        request_id: UUID | None = None,
        actor_id: UUID | None = None,
    ) -> CreditTransactionModel:
        row = CreditTransactionModel(
            id=uuid4(),
            user_id=user_id,
            amount=amount,
            balance_after=balance_after,
            txn_type=txn_type,
            description=description,
            request_id=request_id,
            actor_id=actor_id,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def list_for_user(self, user_id: UUID, *, limit: int = 50) -> list[CreditTransactionModel]:
        result = await self._session.execute(
            select(CreditTransactionModel)
            .where(CreditTransactionModel.user_id == user_id)
            .order_by(CreditTransactionModel.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    def to_dict(row: CreditTransactionModel) -> dict:
        return {
            "id": str(row.id),
            "amount": row.amount,
            "balance_after": row.balance_after,
            "txn_type": row.txn_type,
            "description": row.description,
            "request_id": str(row.request_id) if row.request_id else None,
            "actor_id": str(row.actor_id) if row.actor_id else None,
            "created_at": row.created_at.isoformat(),
        }
