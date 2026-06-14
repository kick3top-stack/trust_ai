from __future__ import annotations

import hashlib
from pathlib import Path

import httpx

from app.config import settings
from app.crypto.hashing import sha256_hex
from app.domain.interfaces.inference_provider import GenerationParams, GenerationResult


class LmStudioProvider:
    """Inference via LM Studio local OpenAI-compatible API (recommended on VPS)."""

    MODEL_NAME = "Qwen2.5-Coder-0.5B-Instruct"
    MODEL_VERSION = "Q8_0"

    def __init__(self, base_url: str | None = None, model_path: str | None = None) -> None:
        self._base_url = (base_url or settings.trustai_lmstudio_url).rstrip("/")
        self._model_path = Path(model_path or settings.trustai_model_path)
        self._model_hash: str | None = None
        self._loaded = False
        self._lm_model_id: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_hash(self) -> str | None:
        return self._model_hash

    def _compute_model_hash(self) -> str:
        if self._model_path.is_file():
            h = hashlib.sha256()
            with open(self._model_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    h.update(chunk)
            return h.hexdigest()
        return sha256_hex(f"lmstudio:{self._lm_model_id or self.MODEL_NAME}")

    def load(self) -> None:
        if self._loaded:
            return
        with httpx.Client(timeout=10.0) as client:
            try:
                resp = client.get(f"{self._base_url}/models")
                resp.raise_for_status()
                data = resp.json()
                models = data.get("data") or []
                if models:
                    self._lm_model_id = models[0].get("id")
                    for m in models:
                        mid = (m.get("id") or "").lower()
                        if "qwen" in mid and "coder" in mid:
                            self._lm_model_id = m.get("id")
                            break
            except httpx.ConnectError as exc:
                raise ConnectionError(
                    "LM Studio server not reachable. Open LM Studio → Local Server → Start Server (port 1234)."
                ) from exc
            except httpx.HTTPError as exc:
                raise ConnectionError(f"LM Studio API error: {exc}") from exc

        self._model_hash = self._compute_model_hash()
        self._loaded = True

    async def generate(self, prompt: str, params: GenerationParams) -> GenerationResult:
        if not self._loaded:
            self.load()

        payload = {
            "model": self._lm_model_id or self.MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "top_p": params.top_p,
            "seed": params.seed,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(f"{self._base_url}/chat/completions", json=payload)
                resp.raise_for_status()
            except httpx.ConnectError as exc:
                raise ConnectionError(
                    "LM Studio server not running. Start Local Server in LM Studio."
                ) from exc
            data = resp.json()

        choice = data["choices"][0]
        response_text = choice["message"]["content"] or ""
        usage = data.get("usage") or {}
        return GenerationResult(
            response_text=response_text,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            model_hash=self._model_hash or "",
        )
