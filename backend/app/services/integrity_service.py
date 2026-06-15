"""Compute receipt and batch integrity without writing verification logs."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import ReceiptModel
from app.services.receipt_service import ReceiptService
from app.verifier.pipeline import verify_package

IntegrityStatus = str  # full | batch | failed | pending | none


def trust_level_from_package(
    receipt: dict[str, Any] | None,
    merkle_proof: dict[str, Any] | None,
    root_signature: dict[str, Any] | None,
) -> IntegrityStatus:
    if not receipt:
        return "none"
    if not merkle_proof or not root_signature:
        return "pending"
    result = verify_package(receipt, merkle_proof, root_signature)
    return str(result.extra.get("trust_level", "failed"))


async def integrity_for_request(session: AsyncSession, request_id: UUID) -> IntegrityStatus:
    data = await ReceiptService(session).get_by_request_id(request_id)
    if data is None:
        return "none"
    return trust_level_from_package(
        data.get("receipt"),
        data.get("merkle_proof"),
        data.get("root_signature"),
    )


async def batch_integrity_status(session: AsyncSession, batch_id: UUID, batch_status: str) -> str:
    """Batch-level integrity: verified | altered | pending | empty."""
    if batch_status == "open":
        return "pending"

    result = await session.execute(
        select(ReceiptModel.request_id).where(ReceiptModel.batch_id == batch_id)
    )
    request_ids = [row[0] for row in result.all()]
    if not request_ids:
        return "empty"

    statuses: list[str] = []
    for rid in request_ids:
        statuses.append(await integrity_for_request(session, rid))

    if any(s in ("failed", "batch") for s in statuses):
        return "altered"
    if all(s == "full" for s in statuses):
        return "verified"
    if any(s == "pending" for s in statuses):
        return "pending"
    return "altered"


async def enrich_request_row(session: AsyncSession, row: dict[str, Any]) -> dict[str, Any]:
    rid = UUID(row["request_id"])
    row["integrity_status"] = await integrity_for_request(session, rid)
    return row
