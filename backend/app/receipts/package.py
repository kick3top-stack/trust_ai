"""Assemble receipt verification package."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.crypto.ed25519 import public_key_to_base64, signature_to_base64
from app.crypto.key_manager import get_signing_keypair
from app.merkle.proof import MerkleProof


def build_root_signature(
    *,
    batch_id: str,
    batch_number: int,
    merkle_root: str,
    signature: bytes,
    receipt_count: int,
) -> dict[str, Any]:
    keypair = get_signing_keypair()
    return {
        "version": "TRUSTAI_SIGNATURE_V1",
        "batch_id": batch_id,
        "batch_number": batch_number,
        "merkle_root": merkle_root,
        "signature": signature_to_base64(signature),
        "public_key": public_key_to_base64(keypair.public_key),
        "signing_key_id": keypair.key_id,
        "signed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "receipt_count": receipt_count,
    }


def build_package(
    receipt: dict[str, Any],
    merkle_proof: MerkleProof,
    root_signature: dict[str, Any],
) -> dict[str, Any]:
    return {
        "receipt": receipt,
        "merkle_proof": merkle_proof.to_dict(),
        "root_signature": root_signature,
    }
