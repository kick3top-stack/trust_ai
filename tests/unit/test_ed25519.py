"""Unit tests for Ed25519 signing."""

from app.crypto.ed25519 import generate_keypair, public_key_to_base64, sign, verify


def test_sign_and_verify():
    keypair = generate_keypair("test-key")
    message = bytes.fromhex("ab" * 32)
    signature = sign(keypair.private_key, message)
    assert verify(keypair.public_key, message, signature)
    assert not verify(keypair.public_key, b"wrong", signature)


def test_public_key_roundtrip():
    keypair = generate_keypair()
    encoded = public_key_to_base64(keypair.public_key)
    assert len(encoded) > 0
