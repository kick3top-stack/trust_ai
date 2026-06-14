from __future__ import annotations

import asyncio
from pathlib import Path

from app.config import settings
from app.crypto.hashing import sha256_hex
from app.domain.interfaces.inference_provider import GenerationParams, GenerationResult


class GgufProvider:
    """Local GGUF inference via llama-cpp-python."""

    MODEL_NAME = "Qwen2.5-Coder-0.5B-Instruct"
    MODEL_VERSION = "Q8_0"

    def __init__(self, model_path: str | None = None) -> None:
        self._model_path = Path(model_path or settings.trustai_model_path)
        self._llm = None
        self._model_hash: str | None = None
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_hash(self) -> str | None:
        return self._model_hash

    def _compute_model_hash(self) -> str:
        if not self._model_path.is_file():
            return sha256_hex(f"missing:{self._model_path}")
        import hashlib

        h = hashlib.sha256()
        with open(self._model_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                h.update(chunk)
        return h.hexdigest()

    def load(self) -> None:
        if self._loaded:
            return
        if not self._model_path.is_file():
            raise FileNotFoundError(f"GGUF model file not found: {self._model_path}")

        self._model_hash = self._compute_model_hash()

        from llama_cpp import Llama

        self._llm = Llama(
            model_path=str(self._model_path),
            n_ctx=2048,
            verbose=False,
        )
        self._loaded = True

    async def generate(self, prompt: str, params: GenerationParams) -> GenerationResult:
        if not self._loaded:
            self.load()

        def _run() -> GenerationResult:
            assert self._llm is not None
            response = self._llm.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=params.max_tokens,
                temperature=params.temperature,
                top_p=params.top_p,
                seed=params.seed,
            )
            choice = response["choices"][0]
            response_text = choice["message"]["content"] or ""
            usage = response.get("usage") or {}
            prompt_tokens = int(usage.get("prompt_tokens", 0))
            completion_tokens = int(usage.get("completion_tokens", 0))

            return GenerationResult(
                response_text=response_text,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                model_name=self.MODEL_NAME,
                model_version=self.MODEL_VERSION,
                model_hash=self._model_hash or "",
            )

        return await asyncio.to_thread(_run)
