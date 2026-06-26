from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_validate_jd_routes_are_registered() -> None:
    """The /api/validate-jd route must be registered in the app's router."""
    routes = [route.path for route in app.routes]  # type: ignore[attr-defined]
    assert "/api/validate-jd" in routes


def test_validate_jd_with_empty_text_returns_invalid(client: TestClient) -> None:
    """Empty text fast-path: returns valid=False without calling Claude."""
    resp = client.post("/api/validate-jd", json={"text": ""})

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert isinstance(data["reason"], str)


def test_validate_jd_with_whitespace_only_returns_invalid(client: TestClient) -> None:
    """Whitespace-only text is treated the same as empty."""
    resp = client.post("/api/validate-jd", json={"text": "   \n\t  "})

    assert resp.status_code == 200
    assert resp.json()["valid"] is False


def test_validate_jd_missing_text_field_returns_422(client: TestClient) -> None:
    """Pydantic validation rejects a request body that omits the 'text' field."""
    resp = client.post("/api/validate-jd", json={})
    assert resp.status_code == 422


def test_validate_jd_valid_jd_returns_valid(client: TestClient, mocker) -> None:
    """A real-looking job description returns valid=True when Claude agrees."""
    mocker.patch(
        "app.routes.validate_jd.complete",
        return_value=json.dumps({"valid": True, "reason": ""}),
    )

    resp = client.post(
        "/api/validate-jd",
        json={"text": "We are hiring a Senior Software Engineer with Python and cloud experience to join our platform team."},
    )

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_jd_not_a_jd_returns_invalid(client: TestClient, mocker) -> None:
    """When Claude says the text is not a job description, valid=False is returned."""
    mocker.patch(
        "app.routes.validate_jd.complete",
        return_value=json.dumps({"valid": False, "reason": "This looks like a news article."}),
    )

    resp = client.post(
        "/api/validate-jd",
        json={"text": "The stock market rose sharply today amid positive economic news from the Federal Reserve meeting."},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert "news" in data["reason"].lower()


def test_validate_jd_strips_markdown_fences(client: TestClient, mocker) -> None:
    """Claude sometimes wraps JSON in ```json fences — the route strips them."""
    fenced = '```json\n{"valid": true, "reason": ""}\n```'
    mocker.patch("app.routes.validate_jd.complete", return_value=fenced)

    resp = client.post(
        "/api/validate-jd",
        json={"text": "We are looking for a talented backend engineer with five or more years of experience building scalable systems."},
    )

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_jd_fails_open_on_exception(client: TestClient, mocker) -> None:
    """If the Claude call raises an exception, the route fails open (valid=True)
    so users are never blocked by a transient API error."""
    mocker.patch("app.routes.validate_jd.complete", side_effect=RuntimeError("network error"))

    resp = client.post(
        "/api/validate-jd",
        json={"text": "We are seeking a Staff Engineer with deep distributed systems and cloud architecture experience to lead our infrastructure team."},
    )

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


# ── /api/validate-role ────────────────────────────────────────────────────────


def test_validate_role_route_is_registered() -> None:
    """The /api/validate-role route must be registered in the app's router."""
    routes = [route.path for route in app.routes]  # type: ignore[attr-defined]
    assert "/api/validate-role" in routes


def test_validate_role_with_empty_text_returns_invalid(client: TestClient) -> None:
    """Empty text fast-path: returns valid=False without calling Claude."""
    resp = client.post("/api/validate-role", json={"text": ""})

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert isinstance(data["reason"], str)


def test_validate_role_with_whitespace_only_returns_invalid(client: TestClient) -> None:
    """Whitespace-only text is treated the same as empty."""
    resp = client.post("/api/validate-role", json={"text": "   \n\t  "})

    assert resp.status_code == 200
    assert resp.json()["valid"] is False


def test_validate_role_missing_text_field_returns_422(client: TestClient) -> None:
    """Pydantic validation rejects a request body that omits the 'text' field."""
    resp = client.post("/api/validate-role", json={})
    assert resp.status_code == 422


def test_validate_role_valid_job_title_returns_valid(client: TestClient, mocker) -> None:
    """A recognised job title returns valid=True when Claude agrees."""
    mocker.patch(
        "app.routes.validate_jd.complete",
        return_value=json.dumps({"valid": True, "reason": ""}),
    )

    resp = client.post("/api/validate-role", json={"text": "Software Engineer"})

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_role_non_job_title_returns_invalid(client: TestClient, mocker) -> None:
    """When Claude says the text is not a job title, valid=False is returned."""
    mocker.patch(
        "app.routes.validate_jd.complete",
        return_value=json.dumps({"valid": False, "reason": "This does not look like a job title."}),
    )

    resp = client.post("/api/validate-role", json={"text": "xkcd!!@@##"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert isinstance(data["reason"], str)


def test_validate_role_strips_markdown_fences(client: TestClient, mocker) -> None:
    """Claude sometimes wraps JSON in ```json fences — the route strips them."""
    fenced = '```json\n{"valid": true, "reason": ""}\n```'
    mocker.patch("app.routes.validate_jd.complete", return_value=fenced)

    resp = client.post("/api/validate-role", json={"text": "Product Manager"})

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_role_fails_open_on_exception(client: TestClient, mocker) -> None:
    """If the Claude call raises an exception, the route fails open (valid=True)
    so users are never blocked by a transient API error."""
    mocker.patch("app.routes.validate_jd.complete", side_effect=RuntimeError("timeout"))

    resp = client.post("/api/validate-role", json={"text": "Data Scientist"})

    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_role_requires_auth(auth_client: TestClient) -> None:
    """No bearer token → 401 Unauthorized."""
    resp = auth_client.post("/api/validate-role", json={"text": "Software Engineer"})
    assert resp.status_code == 401
