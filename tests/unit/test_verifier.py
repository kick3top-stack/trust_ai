"""Unit tests for verification pipeline."""

from app.crypto.ed25519 import generate_keypair, public_key_to_base64, sign, signature_to_base64
from app.merkle.proof import generate_proof
from app.merkle.tree import merkle_root
from app.receipts.builder import build_receipt_payload, receipt_with_hash
from app.verifier.pipeline import verify_package


def test_full_verification_pipeline():
    receipt = receipt_with_hash(build_receipt_payload(
        model_name="Qwen2.5-0.5B-Instruct",
        model_version="local",
        model_hash="a" * 64,
        prompt_hash="b" * 64,
        response_hash="c" * 64,
        seed=42,
        generation_parameters={"temperature": 0.7, "max_tokens": 128, "top_p": 0.9, "seed": 42},
        credit_cost=10,
    ))
    leaves = [receipt["receipt_hash"]]
    root = merkle_root([bytes.fromhex(leaves[0])])
    proof = generate_proof(leaves, 0)
    keypair = generate_keypair("test")
    signature = sign(keypair.private_key, root)
    root_sig = {
        "version": "TRUSTAI_SIGNATURE_V1",
        "batch_id": "00000000-0000-0000-0000-000000000001",
        "batch_number": 1,
        "merkle_root": root.hex(),
        "signature": signature_to_base64(signature),
        "public_key": public_key_to_base64(keypair.public_key),
        "signing_key_id": "test",
        "signed_at": "2026-06-14T12:00:00Z",
        "receipt_count": 1,
    }
    result = verify_package(receipt, proof.to_dict(), root_sig)
    assert result.valid
    assert result.checks.all_valid
