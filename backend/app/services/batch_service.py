from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto.ed25519 import sign
from app.crypto.key_manager import get_signing_keypair
from app.database.repositories import BatchRepository, ReceiptRepository
from app.domain.enums import BatchStatus
from app.merkle.proof import MerkleProof, generate_proof
from app.merkle.tree import merkle_root
from app.models.orm import BatchModel, BatchSignatureModel, GenerationRequestModel
from app.receipts.package import build_root_signature


class BatchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._batch_repo = BatchRepository(session)
        self._receipt_repo = ReceiptRepository(session)
        self._seal_task: asyncio.Task | None = None
        self._seal_deadline: datetime | None = None

    async def append_receipt(
        self,
        receipt_hash: str,
        receipt_id: UUID,
        request_id: UUID,
        timestamp: datetime,
        canonical_payload: dict[str, Any],
        status: str,
    ) -> tuple[BatchModel, int, MerkleProof | None, dict[str, Any] | None]:
        batch = await self._batch_repo.get_or_create_open_batch()
        leaf_index = batch.receipt_count

        await self._receipt_repo.create_receipt(
            receipt_id=receipt_id,
            request_id=request_id,
            batch_id=batch.id,
            timestamp=timestamp,
            receipt_hash=receipt_hash,
            leaf_index=leaf_index,
            canonical_payload=canonical_payload,
            status=status,
        )
        batch = await self._batch_repo.increment_receipt_count(batch.id)

        proof: MerkleProof | None = None
        root_sig: dict[str, Any] | None = None

        should_seal = batch.receipt_count >= settings.trustai_batch_size
        if should_seal:
            proof, root_sig = await self._seal_batch(batch.id, leaf_index)
            await self._batch_repo.create_open_batch()
        else:
            hashes = await self._batch_repo.get_receipt_hashes_for_batch(batch.id)
            proof = generate_proof(hashes, leaf_index)

        await self._session.commit()
        return batch, leaf_index, proof, root_sig

    async def _seal_batch(self, batch_id: UUID, trigger_leaf_index: int) -> tuple[MerkleProof, dict[str, Any]]:
        hashes = await self._batch_repo.get_receipt_hashes_for_batch(batch_id)
        leaves = [bytes.fromhex(h) for h in hashes]
        root = merkle_root(leaves)
        keypair = get_signing_keypair()
        signature = sign(keypair.private_key, root)

        batch = await self._batch_repo.seal_batch(
            batch_id=batch_id,
            merkle_root=root.hex(),
            signature=signature,
            signing_key_id=keypair.key_id,
        )
        proof = generate_proof(hashes, trigger_leaf_index)
        root_sig = build_root_signature(
            batch_id=str(batch.id),
            batch_number=batch.batch_number,
            merkle_root=root.hex(),
            signature=signature,
            receipt_count=batch.receipt_count,
        )
        return proof, root_sig

    async def get_current_batch(self) -> BatchModel | None:
        return await self._batch_repo.get_open_batch()

    async def get_batch(self, batch_id: UUID) -> BatchModel | None:
        return await self._batch_repo.get_by_id(batch_id)

    async def get_proof_for_receipt(self, batch_id: UUID, leaf_index: int) -> MerkleProof:
        hashes = await self._batch_repo.get_receipt_hashes_for_batch(batch_id)
        return generate_proof(hashes, leaf_index)

    async def get_signature_for_batch(self, batch_id: UUID) -> dict[str, Any] | None:
        batch = await self._batch_repo.get_by_id(batch_id)
        if batch is None or batch.status != BatchStatus.SIGNED.value:
            return None
        result = await self._session.execute(
            select(BatchSignatureModel).where(BatchSignatureModel.batch_id == batch_id)
        )
        sig_row = result.scalar_one_or_none()
        if sig_row is None:
            return None
        return build_root_signature(
            batch_id=str(batch.id),
            batch_number=batch.batch_number,
            merkle_root=batch.merkle_root or "",
            signature=sig_row.signature,
            receipt_count=batch.receipt_count,
        )
