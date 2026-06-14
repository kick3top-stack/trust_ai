"""Receipt construction and hashing."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from app.crypto.canonical import RECEIPT_VERSION, canonical_serialize
from app.crypto.hashing import sha256_hex
from app.domain.enums import ReceiptStatus


def build_receipt_payload(
    *,
    request_id: UUID | None = None,
    timestamp: datetime | None = None,
    model_name: str,
    model_version: str,
    model_hash: str,
    prompt_hash: str,
    response_hash: str,
    seed: int,
    generation_parameters: dict[str, Any],
    credit_cost: int,
    status: ReceiptStatus = ReceiptStatus.COMPLETED,
) -> dict[str, Any]:
    return {
        "request_id": str(request_id or uuid4()),
        "timestamp": (timestamp or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model_name": model_name,
        "model_version": model_version,
        "model_hash": model_hash,
        "prompt_hash": prompt_hash,
        "response_hash": response_hash,
        "seed": seed,
        "generation_parameters": generation_parameters,
        "credit_cost": credit_cost,
        "status": status.value,
        "receipt_version": RECEIPT_VERSION,
        "provider": "local",
        "provider_metadata": {},
    }


def compute_receipt_hash(receipt: dict[str, Any]) -> str:
    canonical = canonical_serialize(receipt)
    return sha256_hex(canonical)


def receipt_with_hash(receipt: dict[str, Any]) -> dict[str, Any]:
    receipt_hash = compute_receipt_hash(receipt)
    return {**receipt, "receipt_hash": receipt_hash}
