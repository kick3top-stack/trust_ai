from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto.hashing import hash_text
from app.database.repositories import VerificationLogRepository
from app.domain.exceptions import InsufficientCreditsError, ModelNotLoadedError
from app.domain.interfaces.inference_provider import GenerationParams, GenerationResult, InferenceProvider
from app.inference.streaming import InferenceStreamChunk
from app.models.orm import UserModel
from app.services.auth_service import AuthService
from app.services.credit_cost import (
    compute_credit_cost,
    estimate_completion_tokens,
    estimate_generation_cost,
    estimate_prompt_tokens,
)
from app.services.credit_service import CreditService
from app.services.integrity_service import batch_integrity_status, integrity_for_request
from app.services.receipt_service import ReceiptService
from app.verifier.pipeline import verify_package


class GenerationService:
    def __init__(self, session: AsyncSession, inference: InferenceProvider) -> None:
        self._session = session
        self._inference = inference
        self._receipt_service = ReceiptService(session)

    async def _ensure_model_loaded(self) -> None:
        if not self._inference.is_loaded:
            try:
                self._inference.load()
            except Exception as exc:
                raise ModelNotLoadedError(str(exc)) from exc

    async def _validate_credits(self, user: UserModel, prompt: str, params: GenerationParams) -> None:
        estimated_cost = estimate_generation_cost(prompt, params.max_tokens)
        if user.credit_balance < estimated_cost:
            raise InsufficientCreditsError(
                f"Insufficient credits: need at least {estimated_cost}, have {user.credit_balance}"
            )

    async def _register_generation(
        self,
        *,
        request_id: UUID,
        user_id: UUID,
        prompt: str,
        params: GenerationParams,
        result: GenerationResult,
        user: UserModel,
    ) -> dict[str, Any]:
        prompt_hash = hash_text(prompt)
        response_hash = hash_text(result.response_text)
        total_tokens = result.prompt_tokens + result.completion_tokens
        credit_cost = compute_credit_cost(total_tokens)

        if user.credit_balance < credit_cost:
            raise InsufficientCreditsError(
                f"Insufficient credits: need {credit_cost}, have {user.credit_balance}"
            )

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
            prompt_text=prompt[:8192],
            response_text=result.response_text[:65536] if result.response_text else "",
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            seed=params.seed,
            generation_parameters=generation_parameters,
            credit_cost=credit_cost,
            user_id=user_id,
        )

        auth = AuthService(self._session)
        await auth.deduct_credits(user_id, credit_cost)
        updated_user = await auth.get_by_id(user_id)
        credit_svc = CreditService(self._session)
        await credit_svc.record(
            user_id=user_id,
            amount=-credit_cost,
            balance_after=updated_user.credit_balance if updated_user else 0,
            txn_type="generation",
            description=f"Generation ({result.prompt_tokens + result.completion_tokens} tokens)",
            request_id=request_id,
        )
        await self._session.commit()

        return {
            "request_id": str(request_id),
            "response": result.response_text,
            "credit_cost": credit_cost,
            "credit_balance": updated_user.credit_balance if updated_user else 0,
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
            **package,
        }

    async def _iter_inference(
        self, prompt: str, params: GenerationParams
    ) -> AsyncIterator[InferenceStreamChunk]:
        stream_generate = getattr(self._inference, "stream_generate", None)
        if stream_generate is not None:
            async for chunk in stream_generate(prompt, params):
                yield chunk
            return

        result = await self._inference.generate(prompt, params)
        if result.response_text:
            yield InferenceStreamChunk(text=result.response_text)
        yield InferenceStreamChunk(done=True, result=result)

    def _result_from_stream(
        self, prompt: str, response_text: str, chunk: InferenceStreamChunk
    ) -> GenerationResult:
        if chunk.result is not None:
            return chunk.result

        prompt_tokens = chunk.prompt_tokens or 0
        completion_tokens = chunk.completion_tokens or 0
        if prompt_tokens <= 0:
            prompt_tokens = estimate_prompt_tokens(prompt)
        if completion_tokens <= 0:
            completion_tokens = estimate_completion_tokens(response_text)

        model_name = getattr(self._inference, "MODEL_NAME", "unknown")
        model_version = getattr(self._inference, "MODEL_VERSION", "")
        model_hash = self._inference.model_hash or ""

        return GenerationResult(
            response_text=response_text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model_name=model_name,
            model_version=model_version,
            model_hash=model_hash,
        )

    async def generate_demo(
        self,
        prompt: str,
        params: GenerationParams,
        user_id: UUID,
    ) -> dict[str, Any]:
        await self._ensure_model_loaded()

        auth = AuthService(self._session)
        user = await auth.get_by_id(user_id)
        if user is None:
            raise InsufficientCreditsError("User not found")
        await self._validate_credits(user, prompt, params)

        request_id = uuid4()
        result = await self._inference.generate(prompt, params)
        return await self._register_generation(
            request_id=request_id,
            user_id=user_id,
            prompt=prompt,
            params=params,
            result=result,
            user=user,
        )

    async def stream_generate_demo(
        self,
        prompt: str,
        params: GenerationParams,
        user_id: UUID,
    ) -> AsyncIterator[dict[str, Any]]:
        await self._ensure_model_loaded()

        auth = AuthService(self._session)
        user = await auth.get_by_id(user_id)
        if user is None:
            raise InsufficientCreditsError("User not found")
        await self._validate_credits(user, prompt, params)

        request_id = uuid4()
        parts: list[str] = []
        final_chunk: InferenceStreamChunk | None = None

        async for chunk in self._iter_inference(prompt, params):
            if chunk.text:
                parts.append(chunk.text)
                yield {"event": "token", "data": {"text": chunk.text}}
            if chunk.done:
                final_chunk = chunk

        response_text = "".join(parts)
        if final_chunk is None:
            raise ModelNotLoadedError("Inference stream ended without completion")

        result = self._result_from_stream(prompt, response_text, final_chunk)
        payload = await self._register_generation(
            request_id=request_id,
            user_id=user_id,
            prompt=prompt,
            params=params,
            result=result,
            user=user,
        )
        yield {"event": "done", "data": payload}


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
            "user_message": result.extra.get("user_message"),
            "trust_level": result.extra.get("trust_level", "failed"),
            "receipt_hash": result.receipt_hash,
            "merkle_root": result.merkle_root,
            "batch_number": result.batch_number,
            "signed_at": result.signed_at,
            "signing_key_id": result.signing_key_id,
        }

    async def verify_stored(
        self,
        *,
        receipt_id: UUID | None = None,
        request_id: UUID | None = None,
    ) -> dict[str, Any]:
        service = ReceiptService(self._session)
        if receipt_id is not None:
            data = await service.get_by_id(receipt_id)
        elif request_id is not None:
            data = await service.get_by_request_id(request_id)
        else:
            raise ValueError("receipt_id or request_id required")

        if data is None or not data.get("receipt"):
            raise ValueError("Receipt not found")
        if data.get("merkle_proof") is None or data.get("root_signature") is None:
            raise ValueError("Receipt proof not available yet")

        rid = UUID(data["receipt_id"]) if data.get("receipt_id") else None
        return await self.verify(
            receipt=data["receipt"],
            merkle_proof=data["merkle_proof"],
            root_signature=data["root_signature"],
            receipt_id=rid,
        )


class AdminService:
    def __init__(self, session: AsyncSession, user: UserModel) -> None:
        self._session = session
        self._user = user
        self._is_admin = user.role == "admin"

    def _scoped_requests(self, query, user_id: UUID | None = None):
        from app.models.orm import GenerationRequestModel

        if user_id is not None:
            return query.where(GenerationRequestModel.user_id == user_id)
        if self._is_admin:
            return query
        return query.where(GenerationRequestModel.user_id == self._user.id)

    async def _generations_by_day(
        self, days: int = 7, user_id: UUID | None = None
    ) -> list[dict[str, Any]]:
        from collections import defaultdict
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import select

        from app.models.orm import GenerationRequestModel

        since = datetime.now(timezone.utc) - timedelta(days=days - 1)
        query = select(
            GenerationRequestModel.created_at,
            GenerationRequestModel.credit_cost,
            GenerationRequestModel.prompt_tokens,
            GenerationRequestModel.completion_tokens,
        ).where(
            GenerationRequestModel.created_at >= since
        )
        query = self._scoped_requests(query, user_id=user_id)
        result = await self._session.execute(query)
        counts: dict[str, int] = defaultdict(int)
        credits: dict[str, int] = defaultdict(int)
        tokens: dict[str, int] = defaultdict(int)
        for created_at, credit_cost, prompt_tokens, completion_tokens in result.all():
            day = created_at.date().isoformat()
            counts[day] += 1
            credits[day] += int(credit_cost or 0)
            tokens[day] += int(prompt_tokens or 0) + int(completion_tokens or 0)

        today = datetime.now(timezone.utc).date()
        return [
            {
                "date": (today - timedelta(days=i)).isoformat(),
                "count": counts.get((today - timedelta(days=i)).isoformat(), 0),
                "credits": credits.get((today - timedelta(days=i)).isoformat(), 0),
                "tokens": tokens.get((today - timedelta(days=i)).isoformat(), 0),
            }
            for i in range(days - 1, -1, -1)
        ]

    async def _model_usage(self, user_id: UUID | None = None) -> list[dict[str, Any]]:
        from sqlalchemy import func, select

        from app.models.orm import GenerationRequestModel

        query = select(
            GenerationRequestModel.model_name,
            func.count().label("count"),
            func.sum(GenerationRequestModel.credit_cost).label("credits"),
        ).group_by(GenerationRequestModel.model_name)
        query = self._scoped_requests(query, user_id=user_id)
        result = await self._session.execute(query)
        return [
            {
                "model_name": row.model_name,
                "count": int(row.count),
                "credits": int(row.credits or 0),
            }
            for row in result.all()
        ]

    async def _latest_requests(
        self,
        *,
        user_id: UUID | None = None,
        limit: int = 10,
        include_user: bool = False,
    ) -> list[dict[str, Any]]:
        from sqlalchemy import select

        from app.models.orm import GenerationRequestModel, UserModel

        query = self._scoped_requests(
            select(GenerationRequestModel).order_by(GenerationRequestModel.created_at.desc()).limit(
                limit
            ),
            user_id=user_id,
        )
        result = await self._session.execute(query)
        latest = list(result.scalars().all())

        users_by_id: dict[UUID, UserModel] = {}
        if include_user:
            user_ids = {r.user_id for r in latest if r.user_id}
            if user_ids:
                users_result = await self._session.execute(
                    select(UserModel).where(UserModel.id.in_(user_ids))
                )
                users_by_id = {u.id: u for u in users_result.scalars().all()}

        rows = []
        for r in latest:
            row = {
                "request_id": str(r.id),
                "created_at": r.created_at.isoformat(),
                "model_name": r.model_name,
                "credit_cost": r.credit_cost,
                "status": r.status,
                "integrity_status": await integrity_for_request(self._session, r.id),
            }
            if include_user and r.user_id:
                owner = users_by_id.get(r.user_id)
                if owner:
                    row["user_id"] = str(owner.id)
                    row["user_email"] = owner.email
                    row["user_display_name"] = owner.display_name
            rows.append(row)
        return rows

    async def get_stats(self) -> dict[str, Any]:
        """Personal dashboard stats for the signed-in user."""
        return await self._build_user_stats(self._user)

    async def get_platform_stats(self) -> dict[str, Any]:
        if not self._is_admin:
            raise PermissionError("Admin access required")
        return await self._build_platform_stats()

    async def get_user_stats(self, user_id: UUID) -> dict[str, Any]:
        if not self._is_admin:
            raise PermissionError("Admin access required")

        from app.services.auth_service import AuthService, user_to_dict

        target = await AuthService(self._session).get_by_id(user_id)
        if target is None:
            raise ValueError("User not found")

        stats = await self._build_user_stats(target)
        stats["scope"] = "user"
        stats["user"] = user_to_dict(target)
        return stats

    async def _build_user_stats(self, subject: UserModel) -> dict[str, Any]:
        from app.database.repositories import ReceiptRepository, VerificationLogRepository

        receipt_repo = ReceiptRepository(self._session)
        log_repo = VerificationLogRepository(self._session)

        total_receipts = await receipt_repo.count_for_user(subject.id)
        generations_by_day = await self._generations_by_day(user_id=subject.id)
        credits_spent_7d = sum(day["credits"] for day in generations_by_day)

        return {
            "scope": "user",
            "subject_user_id": str(subject.id),
            "subject_email": subject.email,
            "subject_display_name": subject.display_name,
            "subject_role": subject.role,
            "subject_is_active": subject.is_active,
            "total_generations": total_receipts,
            "total_receipts": total_receipts,
            "credit_balance": subject.credit_balance,
            "credits_spent_7d": credits_spent_7d,
            "current_merkle_root": None,
            "last_signature_at": None,
            "open_batch_receipt_count": 0,
            "signed_batch_count": 0,
            "verification_success_rate": await log_repo.success_rate_for_user(subject.id),
            "generations_by_day": generations_by_day,
            "model_usage": await self._model_usage(user_id=subject.id),
            "latest_requests": await self._latest_requests(user_id=subject.id),
            "recent_batches": [],
        }

    async def _build_platform_stats(self) -> dict[str, Any]:
        from sqlalchemy import func, select
        from sqlalchemy.orm import selectinload

        from app.database.repositories import BatchRepository, ReceiptRepository, VerificationLogRepository
        from app.models.orm import BatchModel, UserModel

        receipt_repo = ReceiptRepository(self._session)
        batch_repo = BatchRepository(self._session)
        log_repo = VerificationLogRepository(self._session)

        total_users = int(
            (
                await self._session.execute(select(func.count()).select_from(UserModel))
            ).scalar_one()
        )
        active_users = int(
            (
                await self._session.execute(
                    select(func.count())
                    .select_from(UserModel)
                    .where(UserModel.is_active.is_(True))
                )
            ).scalar_one()
        )

        total_receipts = await receipt_repo.count_all()
        open_batch = await batch_repo.get_open_batch()
        signed_result = await self._session.execute(
            select(BatchModel)
            .options(selectinload(BatchModel.signature))
            .where(BatchModel.status == "signed")
            .order_by(BatchModel.batch_number.desc())
            .limit(1)
        )
        latest_signed = signed_result.scalar_one_or_none()

        generations_by_day = await self._generations_by_day()
        credits_spent_7d = sum(day["credits"] for day in generations_by_day)

        return {
            "scope": "platform",
            "total_users": total_users,
            "active_users": active_users,
            "total_generations": total_receipts,
            "total_receipts": total_receipts,
            "viewer_credit_balance": self._user.credit_balance,
            "credits_spent_7d": credits_spent_7d,
            "current_merkle_root": (
                open_batch.merkle_root
                if open_batch and open_batch.merkle_root
                else (latest_signed.merkle_root if latest_signed else None)
            ),
            "last_signature_at": (
                latest_signed.signature.signed_at.isoformat()
                if latest_signed and latest_signed.signature
                else None
            ),
            "open_batch_receipt_count": open_batch.receipt_count if open_batch else 0,
            "signed_batch_count": await batch_repo.count_signed(),
            "verification_success_rate": await log_repo.success_rate(),
            "generations_by_day": generations_by_day,
            "model_usage": await self._model_usage(),
            "latest_requests": await self._latest_requests(include_user=True),
            "recent_batches": await self._recent_batches(),
        }

    async def list_receipts(self, limit: int = 50) -> list[dict[str, Any]]:
        from sqlalchemy import select

        from app.models.orm import GenerationRequestModel

        query = self._scoped_requests(
            select(GenerationRequestModel).order_by(GenerationRequestModel.created_at.desc()).limit(
                min(limit, 100)
            )
        )
        result = await self._session.execute(query)
        rows = []
        for r in result.scalars().all():
            rows.append(
                {
                    "request_id": str(r.id),
                    "created_at": r.created_at.isoformat(),
                    "model_name": r.model_name,
                    "credit_cost": r.credit_cost,
                    "status": r.status,
                    "integrity_status": await integrity_for_request(self._session, r.id),
                }
            )
        return rows

    async def _recent_batches(self, limit: int = 50) -> list[dict[str, Any]]:
        from app.database.repositories import BatchRepository

        repo = BatchRepository(self._session)
        batches = await repo.list_batches(limit=limit)
        result = []
        for b in batches:
            result.append(
                {
                    "batch_id": str(b.id),
                    "batch_number": b.batch_number,
                    "status": b.status,
                    "receipt_count": b.receipt_count,
                    "merkle_root": b.merkle_root,
                    "sealed_at": b.sealed_at.isoformat() if b.sealed_at else None,
                    "created_at": b.created_at.isoformat(),
                    "integrity_status": await batch_integrity_status(
                        self._session, b.id, b.status
                    ),
                }
            )
        return result
