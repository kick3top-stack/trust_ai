"""Integration tests for crypto pipeline without database."""

from app.crypto.ed25519 import generate_keypair, public_key_to_base64, sign, signature_to_base64
from app.merkle.proof import generate_proof
from app.merkle.tree import merkle_root
from app.receipts.builder import build_receipt_payload, receipt_with_hash
from app.verifier.pipeline import verify_package


def test_generate_to_verify_e2e():
    """Simulate generate -> package -> verify without LLM or DB."""
    receipts = []
    for i in range(4):
        receipts.append(receipt_with_hash(build_receipt_payload(
            model_name="Qwen2.5-0.5B-Instruct",
            model_version="local",
            model_hash="a" * 64,
            prompt_hash=f"{i:064d}",
            response_hash=f"{i+1:064d}",
            seed=i,
            generation_parameters={"temperature": 0.7, "max_tokens": 128, "top_p": 0.9, "seed": i},
            credit_cost=10 + i,
        )))

    leaves = [r["receipt_hash"] for r in receipts]
    root = merkle_root([bytes.fromhex(h) for h in leaves])
    keypair = generate_keypair("e2e-test")

    for idx, receipt in enumerate(receipts):
        proof = generate_proof(leaves, idx)
        root_sig = {
            "version": "TRUSTAI_SIGNATURE_V1",
            "batch_id": "00000000-0000-0000-0000-000000000099",
            "batch_number": 99,
            "merkle_root": root.hex(),
            "signature": signature_to_base64(sign(keypair.private_key, root)),
            "public_key": public_key_to_base64(keypair.public_key),
            "signing_key_id": "e2e-test",
            "signed_at": "2026-06-14T12:00:00Z",
            "receipt_count": len(leaves),
        }
        result = verify_package(receipt, proof.to_dict(), root_sig)
        assert result.valid, f"Receipt {idx} failed: {result.reason}"
