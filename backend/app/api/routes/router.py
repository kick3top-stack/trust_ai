from __future__ import annotations

import io
import json
import zipfile
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.generate import GenerateDemoRequest, GenerateDemoResponse
from app.api.schemas.verify import VerifyRequest, VerifyResponse
from app.crypto.key_manager import get_public_key_info
from app.database.repositories import ReceiptRepository
from app.database.session import get_session
from app.dependencies import get_current_user, get_generation_service, get_inference_provider, require_admin
from app.domain.exceptions import InsufficientCreditsError, ModelNotLoadedError
from app.domain.interfaces.inference_provider import GenerationParams
from app.domain.interfaces.inference_provider import InferenceProvider
from app.models.orm import UserModel
from app.services.access_control import assert_can_access_request
from app.services.batch_service import BatchService
from app.services.generation_service import AdminService, GenerationService, VerificationService
from app.services.integrity_service import batch_integrity_status

router = APIRouter()


def _generation_params(body: GenerateDemoRequest) -> GenerationParams:
    return GenerationParams(
        temperature=body.parameters.temperature,
        max_tokens=body.parameters.max_tokens,
        top_p=body.parameters.top_p,
        seed=body.parameters.seed,
    )


@router.post("/generate-demo/stream")
async def generate_demo_stream(
    body: GenerateDemoRequest,
    gen_service: GenerationService = Depends(get_generation_service),
    user: UserModel = Depends(get_current_user),
) -> StreamingResponse:
    params = _generation_params(body)

    async def event_stream():
        try:
            async for event in gen_service.stream_generate_demo(body.prompt, params, user_id=user.id):
                yield (
                    f"event: {event['event']}\n"
                    f"data: {json.dumps(event['data'])}\n\n"
                )
        except ModelNotLoadedError as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
        except InsufficientCreditsError as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc), 'status': 402})}\n\n"
        except ConnectionError as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
        except OSError as exc:
            yield (
                "event: error\n"
                f"data: {json.dumps({'detail': f'Inference failed ({exc}). Use TRUSTAI_INFERENCE_BACKEND=lmstudio with LM Studio server running.'})}\n\n"
            )
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate-demo", response_model=GenerateDemoResponse)
async def generate_demo(
    body: GenerateDemoRequest,
    session: AsyncSession = Depends(get_session),
    gen_service: GenerationService = Depends(get_generation_service),
    user: UserModel = Depends(get_current_user),
) -> GenerateDemoResponse:
    params = _generation_params(body)
    try:
        result = await gen_service.generate_demo(body.prompt, params, user_id=user.id)
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InsufficientCreditsError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Inference failed ({exc}). Use TRUSTAI_INFERENCE_BACKEND=lmstudio with LM Studio server running.",
        ) from exc

    return GenerateDemoResponse(
        request_id=result["request_id"],
        response=result["response"],
        receipt=result["receipt"],
        merkle_proof=result["merkle_proof"],
        root_signature=result["root_signature"],
        batch_id=result["batch_id"],
        receipt_id=result["receipt_id"],
        credit_cost=result.get("credit_cost", 0),
        credit_balance=result.get("credit_balance", 0),
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify(
    body: VerifyRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> VerifyResponse:
    receipt_id = None
    if body.receipt.get("request_id"):
        repo = ReceiptRepository(session)
        request_id = UUID(body.receipt["request_id"])
        await assert_can_access_request(session, request_id, user)
        row = await repo.get_by_request_id(request_id)
        if row:
            receipt_id = row.id

    if body.merkle_proof is None or body.root_signature is None:
        raise HTTPException(status_code=400, detail="merkle_proof and root_signature are required")

    service = VerificationService(session)
    result = await service.verify(
        receipt=body.receipt,
        merkle_proof=body.merkle_proof,
        root_signature=body.root_signature,
        receipt_id=receipt_id,
    )
    return VerifyResponse(**result)


@router.get("/receipts")
async def list_receipts(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    rows = await AdminService(session, user).list_receipts(limit=min(limit, 100))
    return {"receipts": rows}


@router.get("/receipts/{receipt_id}")
async def get_receipt(
    receipt_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict[str, Any]:
    from app.services.receipt_service import ReceiptService

    repo = ReceiptRepository(session)
    row = await repo.get_by_id(receipt_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    await assert_can_access_request(session, row.request_id, user)
    service = ReceiptService(session)
    data = await service.get_by_id(receipt_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return data


@router.get("/receipts/by-request/{request_id}")
async def get_receipt_by_request(
    request_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict[str, Any]:
    from app.services.receipt_service import ReceiptService

    await assert_can_access_request(session, request_id, user)
    service = ReceiptService(session)
    data = await service.get_by_request_id(request_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return data


@router.post("/receipts/by-request/{request_id}/verify", response_model=VerifyResponse)
async def verify_receipt_by_request(
    request_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> VerifyResponse:
    await assert_can_access_request(session, request_id, user)
    service = VerificationService(session)
    try:
        result = await service.verify_stored(request_id=request_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return VerifyResponse(**result)


@router.post("/receipts/{receipt_id}/verify", response_model=VerifyResponse)
async def verify_receipt_by_id(
    receipt_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> VerifyResponse:
    repo = ReceiptRepository(session)
    row = await repo.get_by_id(receipt_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    await assert_can_access_request(session, row.request_id, user)
    service = VerificationService(session)
    try:
        result = await service.verify_stored(receipt_id=receipt_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return VerifyResponse(**result)


@router.get("/receipts/{receipt_id}/package")
async def get_receipt_package(
    receipt_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse

    from app.services.receipt_service import ReceiptService

    repo = ReceiptRepository(session)
    row = await repo.get_by_id(receipt_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    await assert_can_access_request(session, row.request_id, user)
    service = ReceiptService(session)
    data = await service.get_by_id(receipt_id)
    if data is None or data.get("merkle_proof") is None:
        raise HTTPException(status_code=404, detail="Receipt package not available")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        import json

        zf.writestr("receipt.json", json.dumps(data["receipt"], indent=2))
        zf.writestr("merkle_proof.json", json.dumps(data["merkle_proof"], indent=2))
        if data.get("root_signature"):
            zf.writestr("root_signature.json", json.dumps(data["root_signature"], indent=2))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=receipt-{receipt_id}.zip"},
    )


@router.get("/batches")
async def list_batches(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    from app.database.repositories import BatchRepository

    repo = BatchRepository(session)
    batches = await repo.list_batches(limit=min(limit, 100))
    batch_rows = []
    for b in batches:
        batch_rows.append(
            {
                "batch_id": str(b.id),
                "batch_number": b.batch_number,
                "status": b.status,
                "receipt_count": b.receipt_count,
                "merkle_root": b.merkle_root,
                "sealed_at": b.sealed_at.isoformat() if b.sealed_at else None,
                "created_at": b.created_at.isoformat(),
                "integrity_status": await batch_integrity_status(session, b.id, b.status),
            }
        )
    return {"batches": batch_rows}


@router.get("/batches/current")
async def get_current_batch(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict[str, Any]:
    service = BatchService(session)
    batch = await service.get_current_batch()
    if batch is None:
        return {"status": "none", "receipt_count": 0}
    return {
        "batch_id": str(batch.id),
        "batch_number": batch.batch_number,
        "status": batch.status,
        "receipt_count": batch.receipt_count,
        "merkle_root": batch.merkle_root,
    }


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: UUID,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict[str, Any]:
    service = BatchService(session)
    batch = await service.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    sig = await service.get_signature_for_batch(batch_id)
    integrity_status = await batch_integrity_status(session, batch_id, batch.status)
    return {
        "batch_id": str(batch.id),
        "batch_number": batch.batch_number,
        "status": batch.status,
        "receipt_count": batch.receipt_count,
        "merkle_root": batch.merkle_root,
        "sealed_at": batch.sealed_at.isoformat() if batch.sealed_at else None,
        "integrity_status": integrity_status,
        "root_signature": sig,
    }


@router.get("/admin/stats")
async def admin_stats(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict[str, Any]:
    """Personal dashboard stats for the signed-in user."""
    service = AdminService(session, user)
    return await service.get_stats()


@router.get("/admin/platform-stats")
async def admin_platform_stats(
    session: AsyncSession = Depends(get_session),
    admin: UserModel = Depends(require_admin),
) -> dict[str, Any]:
    service = AdminService(session, admin)
    try:
        return await service.get_platform_stats()
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/admin/users/{user_id}/stats")
async def admin_user_stats(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
    admin: UserModel = Depends(require_admin),
) -> dict[str, Any]:
    service = AdminService(session, admin)
    try:
        return await service.get_user_stats(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/admin/public-key")
async def admin_public_key(user: UserModel = Depends(get_current_user)) -> dict[str, str]:
    return get_public_key_info()


@router.get("/health")
async def health(
    session: AsyncSession = Depends(get_session),
    inference: InferenceProvider = Depends(get_inference_provider),
) -> dict[str, Any]:
    db_ok = False
    try:
        from sqlalchemy import text

        await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    from app.config import settings

    model_path = getattr(inference, "_model_path", None)
    model_path_exists = model_path.is_file() if model_path else False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "inference_backend": settings.trustai_inference_backend,
        "model_loaded": inference.is_loaded,
        "model_path_exists": model_path_exists,
        "model_path": str(model_path) if model_path else None,
        "lmstudio_url": settings.trustai_lmstudio_url if settings.trustai_inference_backend == "lmstudio" else None,
        "auth_enabled": True,
        "batches_list": True,
        "billing_statement": True,
        "disputes": True,
    }
