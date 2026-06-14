from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.crypto.hashing import sha256_hex
from app.domain.interfaces.inference_provider import GenerationParams, GenerationResult


class QwenHFProvider:
    MODEL_NAME = "Qwen2.5-0.5B-Instruct"
    MODEL_VERSION = "local"

    def __init__(self, model_path: str | None = None) -> None:
        self._model_path = Path(model_path or settings.trustai_model_path)
        self._model = None
        self._tokenizer = None
        self._model_hash: str | None = None
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_hash(self) -> str | None:
        return self._model_hash

    def _compute_model_hash(self) -> str:
        parts: list[str] = []
        if not self._model_path.exists():
            return sha256_hex(f"missing:{self._model_path}")
        for path in sorted(self._model_path.rglob("*")):
            if path.is_file() and path.suffix in {".json", ".safetensors", ".bin", ".txt"}:
                parts.append(f"{path.name}:{sha256_hex(path.read_bytes())}")
        return sha256_hex("\n".join(parts))

    def load(self) -> None:
        if self._loaded:
            return
        if not self._model_path.exists():
            raise FileNotFoundError(f"Model path not found: {self._model_path}")

        self._model_hash = self._compute_model_hash()

        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch

        self._tokenizer = AutoTokenizer.from_pretrained(str(self._model_path), trust_remote_code=True)
        self._model = AutoModelForCausalLM.from_pretrained(
            str(self._model_path),
            trust_remote_code=True,
            torch_dtype=torch.float32,
        )
        self._model.eval()
        self._loaded = True

    async def generate(self, prompt: str, params: GenerationParams) -> GenerationResult:
        import asyncio
        import torch

        if not self._loaded:
            self.load()

        def _run() -> GenerationResult:
            assert self._tokenizer is not None and self._model is not None
            messages = [{"role": "user", "content": prompt}]
            text = self._tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            inputs = self._tokenizer(text, return_tensors="pt")
            prompt_tokens = inputs["input_ids"].shape[1]

            torch.manual_seed(params.seed)
            with torch.no_grad():
                output = self._model.generate(
                    **inputs,
                    max_new_tokens=params.max_tokens,
                    temperature=params.temperature,
                    top_p=params.top_p,
                    do_sample=params.temperature > 0,
                )
            generated = output[0][prompt_tokens:]
            completion_tokens = len(generated)
            response_text = self._tokenizer.decode(generated, skip_special_tokens=True)

            return GenerationResult(
                response_text=response_text,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                model_name=self.MODEL_NAME,
                model_version=self.MODEL_VERSION,
                model_hash=self._model_hash or "",
            )

        return await asyncio.to_thread(_run)
