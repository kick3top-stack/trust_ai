from __future__ import annotations

from typing import Any


class NoOpAnchorProvider:
    """Placeholder for future blockchain anchoring."""

    async def anchor(self, merkle_root: bytes, metadata: dict[str, Any]) -> dict[str, Any]:
        return {"anchored": False, "merkle_root": merkle_root.hex(), "metadata": metadata}
