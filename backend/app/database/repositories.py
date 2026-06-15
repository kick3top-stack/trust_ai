from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import BatchStatus
from app.models.orm import (
    BatchModel,
    BatchSignatureModel,
    GenerationRequestModel,
    ReceiptModel,
    VerificationLogModel,
)


class ReceiptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_generation_request(
        self,
        *,
        request_id: UUID,
        status: str,
        credit_cost: int,
        generation_parameters: dict[str, Any],
        prompt_hash: str,
        response_hash: str,
        model_name: str,
        model_version: str,
        model_hash: str,
        seed: int,
        user_id: UUID | None = None,
        prompt_text: str | None = None,
        response_text: str | None = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> GenerationRequestModel:
        row = GenerationRequestModel(
            id=request_id,
            user_id=user_id,
            status=status,
            credit_cost=credit_cost,
            generation_parameters=generation_parameters,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            prompt_text=prompt_text,
            response_text=response_text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model_name=model_name,
            model_version=model_version,
            model_hash=model_hash,
            seed=seed,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_generation_request(self, request_id: UUID) -> GenerationRequestModel | None:
        result = await self._session.execute(
            select(GenerationRequestModel).where(GenerationRequestModel.id == request_id)
        )
        return result.scalar_one_or_none()

    async def create_receipt(
        self,
        *,
        receipt_id: UUID,
        request_id: UUID,
        batch_id: UUID,
        timestamp: datetime,
        receipt_hash: str,
        leaf_index: int,
        canonical_payload: dict[str, Any],
        status: str,
    ) -> ReceiptModel:
        row = ReceiptModel(
            id=receipt_id,
            request_id=request_id,
            batch_id=batch_id,
            timestamp=timestamp,
            receipt_hash=receipt_hash,
            leaf_index=leaf_index,
            canonical_payload=canonical_payload,
            status=status,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def count_for_user(self, user_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(ReceiptModel)
            .join(GenerationRequestModel, ReceiptModel.request_id == GenerationRequestModel.id)
            .where(GenerationRequestModel.user_id == user_id)
        )
        return int(result.scalar_one())

    async def get_by_request_id(self, request_id: UUID) -> ReceiptModel | None:
        result = await self._session.execute(
            select(ReceiptModel).where(ReceiptModel.request_id == request_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, receipt_id: UUID) -> ReceiptModel | None:
        result = await self._session.execute(
            select(ReceiptModel).where(ReceiptModel.id == receipt_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, receipt_hash: str) -> ReceiptModel | None:
        result = await self._session.execute(
            select(ReceiptModel).where(ReceiptModel.receipt_hash == receipt_hash)
        )
        return result.scalar_one_or_none()

    async def count_all(self) -> int:
        result = await self._session.execute(select(func.count()).select_from(ReceiptModel))
        return result.scalar_one()


class BatchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_open_batch(self) -> BatchModel | None:
        result = await self._session.execute(
            select(BatchModel).where(BatchModel.status == BatchStatus.OPEN.value)
        )
        return result.scalar_one_or_none()

    async def _next_batch_number(self) -> int:
        result = await self._session.execute(select(func.max(BatchModel.batch_number)))
        current = result.scalar_one_or_none()
        return (current or 0) + 1

    async def create_open_batch(self) -> BatchModel:
        batch = BatchModel(
            id=uuid4(),
            batch_number=await self._next_batch_number(),
            status=BatchStatus.OPEN.value,
            receipt_count=0,
        )
        self._session.add(batch)
        await self._session.flush()
        return batch

    async def get_or_create_open_batch(self) -> BatchModel:
        batch = await self.get_open_batch()
        if batch is None:
            batch = await self.create_open_batch()
        return batch

    async def get_by_id(self, batch_id: UUID) -> BatchModel | None:
        result = await self._session.execute(
            select(BatchModel).where(BatchModel.id == batch_id)
        )
        return result.scalar_one_or_none()

    async def get_receipt_hashes_for_batch(self, batch_id: UUID) -> list[str]:
        result = await self._session.execute(
            select(ReceiptModel.receipt_hash)
            .where(ReceiptModel.batch_id == batch_id)
            .order_by(ReceiptModel.leaf_index)
        )
        return list(result.scalars().all())

    async def increment_receipt_count(self, batch_id: UUID) -> BatchModel:
        batch = await self.get_by_id(batch_id)
        if batch is None:
            raise ValueError("Batch not found")
        batch.receipt_count += 1
        await self._session.flush()
        return batch

    async def seal_batch(
        self,
        batch_id: UUID,
        merkle_root: str,
        signature: bytes,
        signing_key_id: str,
    ) -> BatchModel:
        batch = await self.get_by_id(batch_id)
        if batch is None:
            raise ValueError("Batch not found")
        batch.status = BatchStatus.SIGNED.value
        batch.merkle_root = merkle_root
        batch.sealed_at = datetime.now(timezone.utc)
        sig = BatchSignatureModel(
            id=uuid4(),
            batch_id=batch_id,
            signing_key_id=signing_key_id,
            signature=signature,
            merkle_root=merkle_root,
        )
        self._session.add(sig)
        await self._session.flush()
        return batch

    async def get_latest_signed(self) -> BatchModel | None:
        result = await self._session.execute(
            select(BatchModel)
            .where(BatchModel.status == BatchStatus.SIGNED.value)
            .order_by(BatchModel.batch_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def count_signed(self) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(BatchModel)
            .where(BatchModel.status == BatchStatus.SIGNED.value)
        )
        return result.scalar_one()

    async def list_batches(self, limit: int = 50) -> list[BatchModel]:
        result = await self._session.execute(
            select(BatchModel).order_by(BatchModel.batch_number.desc()).limit(limit)
        )
        return list(result.scalars().all())


class VerificationLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(
        self,
        *,
        receipt_id: UUID | None,
        valid: bool,
        failure_reason: str | None,
        verification_steps: dict[str, bool],
    ) -> None:
        row = VerificationLogModel(
            id=uuid4(),
            receipt_id=receipt_id,
            valid=valid,
            failure_reason=failure_reason,
            verification_steps=verification_steps,
        )
        self._session.add(row)

    async def success_rate(self) -> float:
        total_result = await self._session.execute(
            select(func.count()).select_from(VerificationLogModel)
        )
        total = total_result.scalar_one()
        if total == 0:
            return 1.0
        valid_result = await self._session.execute(
            select(func.count())
            .select_from(VerificationLogModel)
            .where(VerificationLogModel.valid.is_(True))
        )
        valid = valid_result.scalar_one()
        return valid / total

    async def success_rate_for_user(self, user_id: UUID) -> float:
        from app.models.orm import GenerationRequestModel, ReceiptModel

        receipt_ids_result = await self._session.execute(
            select(ReceiptModel.id)
            .join(GenerationRequestModel, ReceiptModel.request_id == GenerationRequestModel.id)
            .where(GenerationRequestModel.user_id == user_id)
        )
        receipt_ids = list(receipt_ids_result.scalars().all())
        if not receipt_ids:
            return 1.0

        total_result = await self._session.execute(
            select(func.count())
            .select_from(VerificationLogModel)
            .where(VerificationLogModel.receipt_id.in_(receipt_ids))
        )
        total = total_result.scalar_one()
        if total == 0:
            return 1.0
        valid_result = await self._session.execute(
            select(func.count())
            .select_from(VerificationLogModel)
            .where(
                VerificationLogModel.receipt_id.in_(receipt_ids),
                VerificationLogModel.valid.is_(True),
            )
        )
        valid = valid_result.scalar_one()
        return valid / total
