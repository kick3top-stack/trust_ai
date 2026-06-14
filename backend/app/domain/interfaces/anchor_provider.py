from __future__ import annotations

from typing import Any, Protocol


class AnchorProvider(Protocol):
    async def anchor(self, merkle_root: bytes, metadata: dict[str, Any]) -> dict[str, Any]: ...
