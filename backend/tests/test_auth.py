from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient


# ── helpers ───────────────────────────────────────────────────────────────────

def _parse(client: TestClient, headers: dict | None = None, pdf: bytes = b"") -> int:
    return client.post(
        "/api/parse",
        files={"file": ("resume.pdf", pdf or b"%PDF-1.4 stub", "application/pdf")},
        headers=headers or {},
    ).status_code


# ── 401 cases ─────────────────────────────────────────────────────────────────

def test_401_no_token(auth_client: TestClient) -> None:
    assert _parse(auth_client) == 401


def test_401_malformed_bearer(auth_client: TestClient) -> None:
    assert _parse(auth_client, {"Authorization": "Bearer not.a.jwt"}) == 401


def test_401_invalid_signature(auth_client: TestClient, mocker) -> None:
    from jwt.exceptions import InvalidSignatureError

    mocker.patch(
        "app.auth._jwks_client",
        return_value=mocker.Mock(
            get_signing_key_from_jwt=mocker.Mock(side_effect=InvalidSignatureError("bad sig"))
        ),
    )
    assert _parse(auth_client, {"Authorization": "Bearer bad.token.here"}) == 401


# ── 200 with valid token ───────────────────────────────────────────────────────

def test_200_valid_token(auth_client: TestClient, mocker, minimal_pdf_bytes: bytes) -> None:
    _mock_valid_jwt(mocker, "user-abc")
    mocker.patch("app.routes.parse.extract_text", return_value="Jane Smith\nSoftware Engineer")
    mocker.patch("app.routes.parse.validate_resume", return_value={"is_resume": True})
    mocker.patch(
        "app.routes.parse.complete",
        return_value='{"metadata":{"name":"Jane","email":"j@example.com"},"experience":[],"education":[],"skills":[]}',
    )

    resp = auth_client.post(
        "/api/parse",
        files={"file": ("resume.pdf", minimal_pdf_bytes, "application/pdf")},
        headers={"Authorization": "Bearer valid.token.here"},
    )
    assert resp.status_code == 200


# ── 429 rate limit ────────────────────────────────────────────────────────────

def test_429_rate_limit(auth_client: TestClient, mocker, minimal_pdf_bytes: bytes) -> None:
    _mock_valid_jwt(mocker, "user-ratelimit-test")
    mocker.patch("app.routes.parse.extract_text", return_value="Jane Smith")
    mocker.patch("app.routes.parse.validate_resume", return_value={"is_resume": True})
    mocker.patch(
        "app.routes.parse.complete",
        return_value='{"metadata":{"name":"Jane","email":"j@example.com"},"experience":[],"education":[],"skills":[]}',
    )

    headers = {"Authorization": "Bearer valid.token.here"}
    statuses = [
        auth_client.post(
            "/api/parse",
            files={"file": ("resume.pdf", minimal_pdf_bytes, "application/pdf")},
            headers=headers,
        ).status_code
        for _ in range(25)
    ]
    assert 429 in statuses


# ── helpers ───────────────────────────────────────────────────────────────────

def _mock_valid_jwt(mocker, user_id: str) -> None:
    mock_key = mocker.Mock()
    mock_key.key = "fake-key"
    mock_client = mocker.Mock()
    mock_client.get_signing_key_from_jwt.return_value = mock_key
    mocker.patch("app.auth._jwks_client", return_value=mock_client)
    mocker.patch(
        "app.auth.decode",
        return_value={"sub": user_id, "aud": "authenticated", "exp": int(time.time()) + 3600},
    )
