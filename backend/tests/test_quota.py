from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


# ── 402 quota exceeded ────────────────────────────────────────────────────────

def test_402_quota_exceeded_enrich(client: TestClient, mocker, sample_resume: dict) -> None:
    mocker.patch(
        "app.routes.enrich.check_quota",
        side_effect=HTTPException(status_code=402, detail="Monthly AI limit reached"),
    )
    resp = client.post("/api/enrich", json={"resume": sample_resume})
    assert resp.status_code == 402


def test_402_quota_exceeded_tailor(client: TestClient, mocker, sample_resume: dict) -> None:
    mocker.patch(
        "app.routes.tailor.check_quota",
        side_effect=HTTPException(status_code=402, detail="Monthly AI limit reached"),
    )
    resp = client.post(
        "/api/tailor",
        json={"resume": sample_resume, "job_description": "Software engineer role"},
    )
    assert resp.status_code == 402


# ── quota passes under limit ──────────────────────────────────────────────────

def test_quota_passes_under_limit(client: TestClient, mocker, sample_resume: dict) -> None:
    mocker.patch("app.routes.enrich.check_quota", return_value=None)
    mocker.patch("app.routes.enrich.log_ai_call", return_value=None)

    async def fake_stream(system: str, user: str):  # type: ignore[override]
        yield "enriched resume text"

    mocker.patch("app.routes.enrich.stream_text", return_value=fake_stream("", ""))

    resp = client.post("/api/enrich", json={"resume": sample_resume})
    assert resp.status_code == 200


# ── quota disabled when env vars absent ──────────────────────────────────────

async def test_quota_disabled_when_no_env_vars(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    # Import after env manipulation so module-level os.getenv picks up the patch
    import importlib
    import app.services.quota as quota_mod

    # Temporarily override the module-level vars to simulate missing env
    original_url = quota_mod._SUPABASE_URL
    original_key = quota_mod._SUPABASE_ANON_KEY
    quota_mod._SUPABASE_URL = ""
    quota_mod._SUPABASE_ANON_KEY = ""

    try:
        # Should return without raising
        await quota_mod.check_quota("user-123", "test-token")
    finally:
        quota_mod._SUPABASE_URL = original_url
        quota_mod._SUPABASE_ANON_KEY = original_key
