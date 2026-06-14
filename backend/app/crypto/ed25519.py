"""Ed25519 signing and verification."""

from __future__ import annotations

import base64
from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


@dataclass(frozen=True)
class SigningKeyPair:
    private_key: Ed25519PrivateKey
    public_key: Ed25519PublicKey
    key_id: str


def generate_keypair(key_id: str = "trustai-signing-v1") -> SigningKeyPair:
    private_key = Ed25519PrivateKey.generate()
    return SigningKeyPair(
        private_key=private_key,
        public_key=private_key.public_key(),
        key_id=key_id,
    )


def sign(private_key: Ed25519PrivateKey, message: bytes) -> bytes:
    return private_key.sign(message)


def verify(public_key: Ed25519PublicKey, message: bytes, signature: bytes) -> bool:
    try:
        public_key.verify(signature, message)
        return True
    except Exception:
        return False


def public_key_to_base64(public_key: Ed25519PublicKey) -> str:
    raw = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(raw).decode("ascii")


def public_key_from_base64(data: str) -> Ed25519PublicKey:
    raw = base64.b64decode(data)
    return Ed25519PublicKey.from_public_bytes(raw)


def signature_to_base64(signature: bytes) -> str:
    return base64.b64encode(signature).decode("ascii")


def signature_from_base64(data: str) -> bytes:
    return base64.b64decode(data)


def save_private_key_pem(private_key: Ed25519PrivateKey, path: str) -> None:
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    with open(path, "wb") as f:
        f.write(pem)


def load_private_key_pem(path: str) -> Ed25519PrivateKey:
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)
