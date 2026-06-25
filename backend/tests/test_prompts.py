from __future__ import annotations

"""Tests for build_enrich_prompt and build_tailor_prompt — career-stage system prompt selection."""

import pytest

from app.models.resume import ResumeSchema
from app.prompts.resume import build_enrich_prompt, build_tailor_prompt

# ---------------------------------------------------------------------------
# Shared fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def minimal_resume() -> ResumeSchema:
    """Bare ResumeSchema with all defaults — sufficient for prompt building."""
    return ResumeSchema()


# ---------------------------------------------------------------------------
# build_enrich_prompt — system prompt per career stage
# ---------------------------------------------------------------------------

def test_enrich_student_system_contains_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_enrich_prompt(minimal_resume, "professional", "student")
    assert "do not invent" in system.lower()


def test_enrich_early_system_contains_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_enrich_prompt(minimal_resume, "professional", "early")
    assert "do not invent" in system.lower()


def test_enrich_experienced_system_contains_quantified(minimal_resume: ResumeSchema) -> None:
    system, _ = build_enrich_prompt(minimal_resume, "professional", "experienced")
    assert "quantified" in system.lower()


def test_enrich_experienced_system_does_not_contain_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_enrich_prompt(minimal_resume, "professional", "experienced")
    assert "do not invent" not in system.lower()


def test_enrich_unknown_stage_falls_back_to_early(minimal_resume: ResumeSchema) -> None:
    """An unrecognised career_stage value falls back to the 'early' system prompt."""
    system_unknown, _ = build_enrich_prompt(minimal_resume, "professional", "unknown_stage")
    system_early, _ = build_enrich_prompt(minimal_resume, "professional", "early")
    assert system_unknown == system_early


def test_enrich_tone_appears_in_user_message(minimal_resume: ResumeSchema) -> None:
    _, user = build_enrich_prompt(minimal_resume, "assertive", "early")
    assert "assertive" in user.lower()


# ---------------------------------------------------------------------------
# build_tailor_prompt — system prompt per career stage
# ---------------------------------------------------------------------------

def test_tailor_student_system_contains_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_tailor_prompt(minimal_resume, "Some JD text", "student")
    assert "do not invent" in system.lower()


def test_tailor_early_system_contains_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_tailor_prompt(minimal_resume, "Some JD text", "early")
    assert "do not invent" in system.lower()


def test_tailor_experienced_system_contains_quantified(minimal_resume: ResumeSchema) -> None:
    system, _ = build_tailor_prompt(minimal_resume, "Some JD text", "experienced")
    assert "quantified" in system.lower()


def test_tailor_experienced_system_does_not_contain_do_not_invent(minimal_resume: ResumeSchema) -> None:
    system, _ = build_tailor_prompt(minimal_resume, "Some JD text", "experienced")
    assert "do not invent" not in system.lower()


def test_tailor_unknown_stage_falls_back_to_early(minimal_resume: ResumeSchema) -> None:
    system_unknown, _ = build_tailor_prompt(minimal_resume, "Some JD text", "unknown_stage")
    system_early, _ = build_tailor_prompt(minimal_resume, "Some JD text", "early")
    assert system_unknown == system_early


def test_tailor_jd_appears_in_user_message(minimal_resume: ResumeSchema) -> None:
    jd = "We need a Python backend engineer."
    _, user = build_tailor_prompt(minimal_resume, jd, "early")
    assert jd in user
