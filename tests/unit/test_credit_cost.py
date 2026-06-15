from app.services.credit_cost import (
    compute_credit_cost,
    estimate_generation_cost,
    estimate_prompt_tokens,
    tokens_per_credit,
)


def test_compute_credit_cost_minimum():
    assert compute_credit_cost(0) == 1
    assert compute_credit_cost(40) == 1
    assert compute_credit_cost(99) == 1


def test_compute_credit_cost_scales_at_100_tokens():
    assert compute_credit_cost(100) == 1
    assert compute_credit_cost(101) == 2
    assert compute_credit_cost(200) == 2
    assert compute_credit_cost(250) == 3


def test_estimate_includes_prompt_and_max_output():
    prompt = "A" * 120  # ~30 prompt tokens
    assert estimate_generation_cost(prompt, 128) == 2


def test_tokens_per_credit():
    assert tokens_per_credit(0.01) == 100
