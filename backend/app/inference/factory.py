from __future__ import annotations

from app.config import settings
from app.domain.interfaces.inference_provider import InferenceProvider
from app.inference.gguf_provider import GgufProvider
from app.inference.lmstudio_provider import LmStudioProvider


def create_inference_provider() -> InferenceProvider:
    backend = settings.trustai_inference_backend.lower()
    if backend == "lmstudio":
        return LmStudioProvider()
    if backend == "gguf":
        return GgufProvider()
    raise ValueError(f"Unknown inference backend: {backend}")
