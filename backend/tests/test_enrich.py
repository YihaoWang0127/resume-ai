from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.main import app


def test_enrich_returns_stream(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield '{"metadata": {"name": "Jane Smith"}}'
        yield ' more text'

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume})

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Jane Smith" in resp.text


def test_enrich_missing_resume(client: TestClient) -> None:
    resp = client.post("/api/enrich", json={})
    assert resp.status_code == 422


def test_enrich_empty_body(client: TestClient) -> None:
    resp = client.post("/api/enrich", content=b"", headers={"content-type": "application/json"})
    assert resp.status_code == 422


def test_enrich_prompt_contains_resume(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str, model: str | None = None):
        captured["system"] = system
        captured["user"] = user
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    client.post("/api/enrich", json={"resume": sample_resume})

    assert "Jane Smith" in captured.get("user", "")
    assert "Google" in captured.get("user", "")


def test_enrich_streams_chunks(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    chunks = ["chunk_one", " chunk_two", " chunk_three"]

    async def fake_stream(system: str, user: str, model: str | None = None):
        for c in chunks:
            yield c

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume})
    full = resp.text
    for chunk in chunks:
        assert chunk in full


# ── tone field ────────────────────────────────────────────────────────────────


def test_enrich_with_concise_tone_returns_200(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume, "tone": "concise"})
    assert resp.status_code == 200


def test_enrich_without_tone_defaults_to_professional(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str, model: str | None = None):
        captured["user"] = user
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume})

    assert resp.status_code == 200
    # The default tone 'professional' should appear in the prompt
    assert "professional" in captured.get("user", "")


def test_enrich_tone_appears_in_prompt(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str, model: str | None = None):
        captured["user"] = user
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    client.post("/api/enrich", json={"resume": sample_resume, "tone": "assertive"})

    assert "assertive" in captured.get("user", "")


def test_enrich_with_invalid_tone_returns_422(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post("/api/enrich", json={"resume": sample_resume, "tone": "aggressive"})
    assert resp.status_code == 422


# ── model switcher (Claude Fable 5 gating + validation) ─────────────────────────


@pytest.fixture
def anon_client() -> TestClient:
    """Test client authenticated as an anonymous/guest user."""
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="guest-user-id", token="guest-token", is_anonymous=True
    )
    app.dependency_overrides[ai_rate_limit] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def registered_client() -> TestClient:
    """Test client authenticated as a non-anonymous (registered) user."""
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="registered-user-id", token="registered-token", is_anonymous=False
    )
    app.dependency_overrides[ai_rate_limit] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_enrich_fable_model_blocked_for_anonymous_user(
    anon_client: TestClient,
    sample_resume: dict,
) -> None:
    resp = anon_client.post(
        "/api/enrich", json={"resume": sample_resume, "model": "claude-fable-5"}
    )
    assert resp.status_code == 403
    assert "fable" in resp.json()["detail"].lower() or "registered account" in resp.json()["detail"].lower()


def test_enrich_fable_model_allowed_for_registered_user(
    registered_client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = registered_client.post(
        "/api/enrich", json={"resume": sample_resume, "model": "claude-fable-5"}
    )
    assert resp.status_code == 200


def test_enrich_with_invalid_model_returns_422(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/enrich", json={"resume": sample_resume, "model": "not-a-real-model"}
    )
    assert resp.status_code == 422
