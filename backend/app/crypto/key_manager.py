"""Signing key management."""

from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.crypto.ed25519 import SigningKeyPair, load_private_key_pem, public_key_to_base64


@lru_cache
def get_signing_keypair() -> SigningKeyPair:
    private_key = load_private_key_pem(settings.trustai_signing_key_path)
    return SigningKeyPair(
        private_key=private_key,
        public_key=private_key.public_key(),
        key_id=settings.trustai_signing_key_id,
    )


def get_public_key_info() -> dict[str, str]:
    keypair = get_signing_keypair()
    return {
        "signing_key_id": keypair.key_id,
        "public_key": public_key_to_base64(keypair.public_key),
    }
