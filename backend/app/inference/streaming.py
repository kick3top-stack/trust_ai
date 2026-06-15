from __future__ import annotations

from dataclasses import dataclass

from app.domain.interfaces.inference_provider import GenerationResult


@dataclass(frozen=True)
class InferenceStreamChunk:
    text: str = ""
    done: bool = False
    result: GenerationResult | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
