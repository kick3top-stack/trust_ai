from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories import ReceiptRepository
from app.domain.enums import ReceiptStatus
from app.receipts.builder import build_receipt_payload, receipt_with_hash
from app.services.batch_service import BatchService


class ReceiptService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._receipt_repo = ReceiptRepository(session)
        self._batch_service = BatchService(session)

    async def create_and_register(
        self,
        *,
        request_id: UUID,
        model_name: str,
        model_version: str,
        model_hash: str,
        prompt_hash: str,
        response_hash: str,
        seed: int,
        generation_parameters: dict[str, Any],
        credit_cost: int,
        status: ReceiptStatus = ReceiptStatus.COMPLETED,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        receipt_id = uuid4()
        timestamp = datetime.now(timezone.utc)

        payload = build_receipt_payload(
            request_id=request_id,
            timestamp=timestamp,
            model_name=model_name,
            model_version=model_version,
            model_hash=model_hash,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            seed=seed,
            generation_parameters=generation_parameters,
            credit_cost=credit_cost,
            status=status,
        )
        full_receipt = receipt_with_hash(payload)

        await self._receipt_repo.create_generation_request(
            request_id=request_id,
            status=status.value,
            credit_cost=credit_cost,
            generation_parameters=generation_parameters,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            model_name=model_name,
            model_version=model_version,
            model_hash=model_hash,
            seed=seed,
            user_id=user_id,
        )

        batch, leaf_index, proof, root_sig = await self._batch_service.append_receipt(
            receipt_hash=full_receipt["receipt_hash"],
            receipt_id=receipt_id,
            request_id=request_id,
            timestamp=timestamp,
            canonical_payload=payload,
            status=status.value,
        )

        if root_sig is None and batch.status == "open":
            root_sig = await self._batch_service.get_signature_for_batch(batch.id)

        return {
            "receipt": full_receipt,
            "receipt_id": str(receipt_id),
            "batch_id": str(batch.id),
            "leaf_index": leaf_index,
            "merkle_proof": proof.to_dict() if proof else None,
            "root_signature": root_sig,
        }

    async def get_by_request_id(self, request_id: UUID) -> dict[str, Any] | None:
        row = await self._receipt_repo.get_by_request_id(request_id)
        if row is None:
            return None
        receipt = {**row.canonical_payload, "receipt_hash": row.receipt_hash}
        batch_service = BatchService(self._session)
        proof = None
        root_sig = None
        if row.batch_id is not None and row.leaf_index is not None:
            proof = (await batch_service.get_proof_for_receipt(row.batch_id, row.leaf_index)).to_dict()
            root_sig = await batch_service.get_signature_for_batch(row.batch_id)
        return {
            "receipt": receipt,
            "receipt_id": str(row.id),
            "batch_id": str(row.batch_id) if row.batch_id else None,
            "merkle_proof": proof,
            "root_signature": root_sig,
        }

    async def get_by_id(self, receipt_id: UUID) -> dict[str, Any] | None:
        row = await self._receipt_repo.get_by_id(receipt_id)
        if row is None:
            return None
        return await self.get_by_request_id(row.request_id)
