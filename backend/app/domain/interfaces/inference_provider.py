from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class GenerationParams:
    temperature: float = 0.7
    max_tokens: int = 128
    top_p: float = 0.9
    seed: int = 42


@dataclass(frozen=True)
class GenerationResult:
    response_text: str
    prompt_tokens: int
    completion_tokens: int
    model_name: str
    model_version: str
    model_hash: str


class InferenceProvider(Protocol):
    @property
    def is_loaded(self) -> bool: ...

    @property
    def model_hash(self) -> str | None: ...

    def load(self) -> None: ...

    async def generate(self, prompt: str, params: GenerationParams) -> GenerationResult: ...


class AnchorProvider(Protocol):
    async def anchor(self, merkle_root: bytes, metadata: dict[str, Any]) -> dict[str, Any]: ...
