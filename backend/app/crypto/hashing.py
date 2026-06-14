"""SHA-256 hashing utilities."""

from __future__ import annotations

import hashlib


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def sha256_bytes(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def hash_text(text: str) -> str:
    return sha256_hex(text.encode("utf-8"))
