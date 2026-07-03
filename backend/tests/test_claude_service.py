from __future__ import annotations

import pytest

from app.services.claude import (
    ALLOWED_SMART_MODELS,
    FABLE_MODEL,
    SMART_MODEL,
    resolve_smart_model,
)


def test_resolve_smart_model_none_returns_default() -> None:
    assert resolve_smart_model(None) == SMART_MODEL


@pytest.mark.parametrize("model", ["claude-sonnet-5", "claude-opus-4-7", FABLE_MODEL])
def test_resolve_smart_model_allowed_values_pass_through(model: str) -> None:
    assert resolve_smart_model(model) == model


def test_resolve_smart_model_default_is_allowed() -> None:
    assert resolve_smart_model(SMART_MODEL) == SMART_MODEL


def test_resolve_smart_model_invalid_raises_value_error() -> None:
    with pytest.raises(ValueError):
        resolve_smart_model("claude-not-a-real-model")


def test_allowed_smart_models_contains_expected_set() -> None:
    assert ALLOWED_SMART_MODELS == {
        "claude-sonnet-4-6",
        "claude-sonnet-5",
        "claude-opus-4-7",
        "claude-opus-4-8",
        "claude-fable-5",
    }
