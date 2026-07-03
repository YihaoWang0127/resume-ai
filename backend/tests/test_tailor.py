from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

JOB_DESC = "We are hiring a Senior Software Engineer experienced in Python and distributed systems."


def test_tailor_returns_stream(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield '{"metadata": {"name": "Jane Smith"}}'

    mocker.patch("app.routes.tailor.stream_text", new=fake_stream)

    resp = client.post(
        "/api/tailor",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Jane Smith" in resp.text


def test_tailor_missing_job_description(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post("/api/tailor", json={"resume": sample_resume})
    assert resp.status_code == 422


def test_tailor_empty_job_description(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/tailor",
        json={"resume": sample_resume, "job_description": "   "},
    )
    assert resp.status_code == 422


def test_tailor_missing_resume(client: TestClient) -> None:
    resp = client.post("/api/tailor", json={"job_description": JOB_DESC})
    assert resp.status_code == 422


def test_tailor_prompt_contains_jd_and_resume(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str, model: str | None = None):
        captured["user"] = user
        yield "{}"

    mocker.patch("app.routes.tailor.stream_text", new=fake_stream)

    client.post(
        "/api/tailor",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert JOB_DESC in captured.get("user", "")
    assert "Jane Smith" in captured.get("user", "")
    assert "Google" in captured.get("user", "")
