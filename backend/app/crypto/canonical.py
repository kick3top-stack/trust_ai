"""Deterministic receipt serialization."""

from __future__ import annotations

import json
from typing import Any


RECEIPT_VERSION = "1.0"
CANONICAL_PREFIX = "RECEIPT_V1"

FIELD_ORDER = [
    "credit_cost",
    "generation_parameters",
    "model_hash",
    "model_name",
    "model_version",
    "prompt_hash",
    "receipt_version",
    "request_id",
    "response_hash",
    "seed",
    "status",
    "timestamp",
]


def canonical_json(obj: dict[str, Any]) -> str:
    """Serialize dict with sorted keys, no whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_serialize(receipt: dict[str, Any]) -> bytes:
    """Produce deterministic canonical bytes for hashing."""
    lines = [CANONICAL_PREFIX]
    for key in FIELD_ORDER:
        value = receipt[key]
        if key == "generation_parameters":
            serialized = canonical_json(value)
        elif key == "credit_cost" or key == "seed":
            serialized = str(int(value))
        else:
            serialized = str(value)
        lines.append(f"{key}={serialized}")
    return "\n".join(lines).encode("utf-8")
