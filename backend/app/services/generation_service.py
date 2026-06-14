from __future__ import annotations

import math
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto.hashing import hash_text
from app.database.repositories import VerificationLogRepository
from app.domain.exceptions import ModelNotLoadedError
from app.domain.interfaces.inference_provider import GenerationParams, InferenceProvider
from app.models.orm import UserModel
from app.services.receipt_service import ReceiptService
from app.verifier.pipeline import verify_package


class GenerationService:
    def __init__(self, session: AsyncSession, inference: InferenceProvider) -> None:
        self._session = session
        self._inference = inference
        self._receipt_service = ReceiptService(session)

    async def generate_demo(
        self,
        prompt: str,
        params: GenerationParams,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        if not self._inference.is_loaded:
            try:
                self._inference.load()
            except Exception as exc:
                raise ModelNotLoadedError(str(exc)) from exc

        request_id = uuid4()
        result = await self._inference.generate(prompt, params)

        prompt_hash = hash_text(prompt)
        response_hash = hash_text(result.response_text)
        total_tokens = result.prompt_tokens + result.completion_tokens
        credit_cost = max(1, math.ceil(total_tokens * settings.trustai_credit_rate))

        generation_parameters = {
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "top_p": params.top_p,
            "seed": params.seed,
        }

        package = await self._receipt_service.create_and_register(
            request_id=request_id,
            model_name=result.model_name,
            model_version=result.model_version,
            model_hash=result.model_hash,
            prompt_hash=prompt_hash,
            response_hash=response_hash,
            seed=params.seed,
            generation_parameters=generation_parameters,
            credit_cost=credit_cost,
            user_id=user_id,
        )

        return {
            "request_id": str(request_id),
            "response": result.response_text,
            **package,
        }


class VerificationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._log_repo = VerificationLogRepository(session)

    async def verify(
        self,
        receipt: dict[str, Any],
        merkle_proof: dict[str, Any],
        root_signature: dict[str, Any],
        receipt_id: UUID | None = None,
    ) -> dict[str, Any]:
        result = verify_package(receipt, merkle_proof, root_signature)
        await self._log_repo.log(
            receipt_id=receipt_id,
            valid=result.valid,
            failure_reason=result.reason,
            verification_steps=result.checks.to_dict(),
        )
        await self._session.commit()

        return {
            "valid": result.valid,
            "checks": result.checks.to_dict(),
            "reason": result.reason,
            "receipt_hash": result.receipt_hash,
            "merkle_root": result.merkle_root,
            "batch_number": result.batch_number,
            "signed_at": result.signed_at,
            "signing_key_id": result.signing_key_id,
        }


class AdminService:
    def __init__(self, session: AsyncSession, user: UserModel) -> None:
        self._session = session
        self._user = user
        self._is_admin = user.role == "admin"

    def _scoped_requests(self, query):
        from app.models.orm import GenerationRequestModel

        if self._is_admin:
            return query
        return query.where(GenerationRequestModel.user_id == self._user.id)

    async def _generations_by_day(self, days: int = 7) -> list[dict[str, Any]]:
        from collections import defaultdict
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import select

        from app.models.orm import GenerationRequestModel

        since = datetime.now(timezone.utc) - timedelta(days=days - 1)
        query = select(GenerationRequestModel.created_at).where(
            GenerationRequestModel.created_at >= since
        )
        query = self._scoped_requests(query)
        result = await self._session.execute(query)
        counts: dict[str, int] = defaultdict(int)
        for (created_at,) in result.all():
            counts[created_at.date().isoformat()] += 1

        today = datetime.now(timezone.utc).date()
        return [
            {
                "date": (today - timedelta(days=i)).isoformat(),
                "count": counts.get((today - timedelta(days=i)).isoformat(), 0),
            }
            for i in range(days - 1, -1, -1)
        ]

    async def _model_usage(self) -> list[dict[str, Any]]:
        from sqlalchemy import func, select

        from app.models.orm import GenerationRequestModel

        query = select(
            GenerationRequestModel.model_name,
            func.count().label("count"),
            func.sum(GenerationRequestModel.credit_cost).label("credits"),
        ).group_by(GenerationRequestModel.model_name)
        if not self._is_admin:
            query = query.where(GenerationRequestModel.user_id == self._user.id)
        result = await self._session.execute(query)
        return [
            {
                "model_name": row.model_name,
                "count": int(row.count),
                "credits": int(row.credits or 0),
            }
            for row in result.all()
        ]

    async def get_stats(self) -> dict[str, Any]:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.database.repositories import BatchRepository, ReceiptRepository, VerificationLogRepository
        from app.models.orm import BatchModel, GenerationRequestModel

        receipt_repo = ReceiptRepository(self._session)
        batch_repo = BatchRepository(self._session)
        log_repo = VerificationLogRepository(self._session)

        total_receipts = (
            await receipt_repo.count_all()
            if self._is_admin
            else await receipt_repo.count_for_user(self._user.id)
        )
        latest_query = self._scoped_requests(
            select(GenerationRequestModel).order_by(GenerationRequestModel.created_at.desc()).limit(10)
        )
        result = await self._session.execute(latest_query)
        latest = result.scalars().all()

        open_batch = await batch_repo.get_open_batch() if self._is_admin else None
        latest_signed = None
        if self._is_admin:
            signed_result = await self._session.execute(
                select(BatchModel)
                .options(selectinload(BatchModel.signature))
                .where(BatchModel.status == "signed")
                .order_by(BatchModel.batch_number.desc())
                .limit(1)
            )
            latest_signed = signed_result.scalar_one_or_none()

        return {
            "total_generations": total_receipts,
            "total_receipts": total_receipts,
            "current_merkle_root": (
                open_batch.merkle_root
                if open_batch and open_batch.merkle_root
                else (latest_signed.merkle_root if latest_signed else None)
            )
            if self._is_admin
            else None,
            "last_signature_at": (
                latest_signed.signature.signed_at.isoformat()
                if latest_signed and latest_signed.signature
                else None
            )
            if self._is_admin
            else None,
            "open_batch_receipt_count": open_batch.receipt_count if open_batch else 0,
            "signed_batch_count": await batch_repo.count_signed() if self._is_admin else 0,
            "verification_success_rate": await log_repo.success_rate()
            if self._is_admin
            else await log_repo.success_rate_for_user(self._user.id),
            "generations_by_day": await self._generations_by_day(),
            "model_usage": await self._model_usage(),
            "latest_requests": [
                {
                    "request_id": str(r.id),
                    "created_at": r.created_at.isoformat(),
                    "model_name": r.model_name,
                    "credit_cost": r.credit_cost,
                    "status": r.status,
                }
                for r in latest
            ],
        }
