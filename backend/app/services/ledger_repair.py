from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import CreditTransactionModel, GenerationRequestModel, UserModel
from app.services.credit_service import CreditService


async def repair_missing_generation_charges(session: AsyncSession) -> int:
    """Backfill credit deductions that were rolled back before commit (pre-fix generations)."""
    result = await session.execute(select(GenerationRequestModel))
    generations = list(result.scalars().all())
    repaired = 0

    for gen in generations:
        if gen.user_id is None or gen.credit_cost <= 0:
            continue

        txn_result = await session.execute(
            select(CreditTransactionModel.id).where(
                CreditTransactionModel.request_id == gen.id,
                CreditTransactionModel.txn_type == "generation",
            )
        )
        if txn_result.scalar_one_or_none() is not None:
            continue

        user = await session.get(UserModel, gen.user_id)
        if user is None:
            continue

        user.credit_balance = max(0, user.credit_balance - gen.credit_cost)
        await CreditService(session).record(
            user_id=gen.user_id,
            amount=-gen.credit_cost,
            balance_after=user.credit_balance,
            txn_type="generation",
            description=(
                f"Generation (backfill) ({gen.prompt_tokens + gen.completion_tokens} tokens)"
            ),
            request_id=gen.id,
        )
        repaired += 1

    if repaired:
        await session.commit()
    return repaired
