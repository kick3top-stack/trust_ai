"""Verification pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.crypto.ed25519 import (
    public_key_from_base64,
    signature_from_base64,
    verify,
)
from app.merkle.proof import verify_proof
from app.crypto.canonical import canonical_receipt_fields
from app.receipts.builder import compute_receipt_hash


@dataclass
class VerificationChecks:
    receipt_hash_valid: bool = False
    merkle_proof_valid: bool = False
    signature_valid: bool = False
    credit_recorded: bool = False
    model_verified: bool = False

    def to_dict(self) -> dict[str, bool]:
        return {
            "receipt_hash_valid": self.receipt_hash_valid,
            "merkle_proof_valid": self.merkle_proof_valid,
            "signature_valid": self.signature_valid,
            "credit_recorded": self.credit_recorded,
            "model_verified": self.model_verified,
        }

    @property
    def all_valid(self) -> bool:
        return all(self.to_dict().values())


@dataclass
class VerificationResult:
    valid: bool
    checks: VerificationChecks
    reason: str | None = None
    receipt_hash: str | None = None
    merkle_root: str | None = None
    batch_number: int | None = None
    signed_at: str | None = None
    signing_key_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def _user_message(checks: VerificationChecks, reason: str | None) -> str | None:
    if checks.all_valid:
        return None
    batch_trusted = (
        checks.merkle_proof_valid
        and checks.signature_valid
        and checks.credit_recorded
        and checks.model_verified
    )
    if batch_trusted and not checks.receipt_hash_valid:
        return (
            "Your charge is recorded in the signed batch, but this receipt copy does not match "
            "its fingerprint. Reload from the server or contact support with your request ID."
        )
    if not checks.signature_valid:
        return "This receipt could not be matched to a valid signed batch."
    if not checks.merkle_proof_valid:
        return "This receipt is not included in the signed batch tree."
    if not checks.credit_recorded:
        return "No credit charge was recorded on this receipt."
    return reason


def _trust_level(checks: VerificationChecks) -> str:
    if checks.all_valid:
        return "full"
    if (
        checks.merkle_proof_valid
        and checks.signature_valid
        and checks.credit_recorded
        and checks.model_verified
    ):
        return "batch"
    return "failed"


def verify_package(
    receipt: dict[str, Any],
    merkle_proof: dict[str, Any],
    root_signature: dict[str, Any],
) -> VerificationResult:
    checks = VerificationChecks()
    reason: str | None = None

    expected_hash = receipt.get("receipt_hash")
    computed_hash = compute_receipt_hash(canonical_receipt_fields(receipt))
    checks.receipt_hash_valid = expected_hash == computed_hash
    if not checks.receipt_hash_valid:
        reason = "Receipt hash does not match canonical payload"

    proof_root = merkle_proof.get("merkle_root")
    sig_root = root_signature.get("merkle_root")
    if proof_root and sig_root and proof_root == sig_root:
        checks.merkle_proof_valid = verify_proof(
            merkle_proof["receipt_hash"],
            merkle_proof.get("proof", []),
            proof_root,
        )
    if not checks.merkle_proof_valid and reason is None:
        reason = "Merkle proof does not resolve to signed root"

    if proof_root and sig_root and proof_root == sig_root:
        try:
            public_key = public_key_from_base64(root_signature["public_key"])
            signature = signature_from_base64(root_signature["signature"])
            root_bytes = bytes.fromhex(sig_root)
            checks.signature_valid = verify(public_key, root_bytes, signature)
        except Exception:
            checks.signature_valid = False
    if not checks.signature_valid and reason is None:
        reason = "Ed25519 signature verification failed"

    credit_cost = receipt.get("credit_cost", 0)
    checks.credit_recorded = isinstance(credit_cost, int) and credit_cost > 0
    if not checks.credit_recorded and reason is None:
        reason = "Credit cost not recorded"

    checks.model_verified = bool(
        receipt.get("model_name") and receipt.get("model_version") and receipt.get("model_hash")
    )
    if not checks.model_verified and reason is None:
        reason = "Model metadata incomplete"

    valid = checks.all_valid
    if valid:
        reason = None

    user_message = _user_message(checks, reason)

    return VerificationResult(
        valid=valid,
        checks=checks,
        reason=reason,
        receipt_hash=expected_hash,
        merkle_root=sig_root,
        batch_number=root_signature.get("batch_number"),
        signed_at=root_signature.get("signed_at"),
        signing_key_id=root_signature.get("signing_key_id"),
        extra={"user_message": user_message, "trust_level": _trust_level(checks)},
    )
