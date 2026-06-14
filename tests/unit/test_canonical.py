"""Unit tests for canonical serialization."""

from app.crypto.canonical import canonical_serialize
from app.crypto.hashing import sha256_hex
from app.receipts.builder import build_receipt_payload, compute_receipt_hash


def test_canonical_serialization_deterministic():
    receipt = build_receipt_payload(
        model_name="Qwen2.5-0.5B-Instruct",
        model_version="local",
        model_hash="a" * 64,
        prompt_hash="b" * 64,
        response_hash="c" * 64,
        seed=42,
        generation_parameters={"temperature": 0.7, "max_tokens": 128, "top_p": 0.9, "seed": 42},
        credit_cost=10,
    )
    h1 = compute_receipt_hash(receipt)
    h2 = compute_receipt_hash(receipt)
    assert h1 == h2
    assert len(h1) == 64


def test_canonical_bytes_stable():
    receipt = build_receipt_payload(
        model_name="Test",
        model_version="v1",
        model_hash="d" * 64,
        prompt_hash="e" * 64,
        response_hash="f" * 64,
        seed=1,
        generation_parameters={"seed": 1, "max_tokens": 10, "temperature": 0.5, "top_p": 0.9},
        credit_cost=5,
    )
    b1 = canonical_serialize(receipt)
    b2 = canonical_serialize(receipt)
    assert b1 == b2
    assert b1.startswith(b"RECEIPT_V1")
