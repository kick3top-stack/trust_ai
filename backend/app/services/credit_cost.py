from __future__ import annotations

import math

from app.config import settings


def estimate_prompt_tokens(prompt: str) -> int:
    """Rough token count from character length (~4 chars per token)."""
    text = prompt.strip()
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def estimate_completion_tokens(text: str) -> int:
    """Rough completion token count when the inference API omits usage."""
    if not text.strip():
        return 0
    return max(1, math.ceil(len(text) / 4))


def compute_credit_cost(total_tokens: int, rate: float | None = None) -> int:
    """Credits charged for a completed generation."""
    rate = settings.trustai_credit_rate if rate is None else rate
    if total_tokens <= 0:
        return 1
    return max(1, math.ceil(total_tokens * rate))


def estimate_generation_cost(prompt: str, max_tokens: int, rate: float | None = None) -> int:
    """Upper-bound estimate before inference (prompt estimate + max output tokens)."""
    rate = settings.trustai_credit_rate if rate is None else rate
    estimated_tokens = estimate_prompt_tokens(prompt) + max(0, max_tokens)
    return compute_credit_cost(estimated_tokens, rate)


def tokens_per_credit(rate: float | None = None) -> int:
    rate = settings.trustai_credit_rate if rate is None else rate
    if rate <= 0:
        return 100
    return max(1, math.floor(1 / rate))
