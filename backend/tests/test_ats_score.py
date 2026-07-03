from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

JOB_DESC = "We are hiring a Senior Software Engineer experienced in Python and distributed systems."

ATS_RESPONSE = {
    "overall_score": 78,
    "matched_keywords": ["Python", "distributed systems"],
    "missing_keywords": ["Kubernetes"],
    "suggestions": [
        "Add a bullet mentioning container orchestration experience.",
        "Highlight the Go and gRPC experience explicitly.",
    ],
    "summary": "Strong overall match with a few gaps in infrastructure tooling.",
}


def test_ats_score_success(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.ats_score.complete_smart", return_value=json.dumps(ATS_RESPONSE))

    resp = client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["overall_score"] == 78
    assert data["matched_keywords"] == ["Python", "distributed systems"]
    assert data["missing_keywords"] == ["Kubernetes"]
    assert len(data["suggestions"]) == 2
    assert data["summary"] == "Strong overall match with a few gaps in infrastructure tooling."


def test_ats_score_strips_markdown_fences(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    fenced = f"```json\n{json.dumps(ATS_RESPONSE)}\n```"
    mocker.patch("app.routes.ats_score.complete_smart", return_value=fenced)

    resp = client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert resp.status_code == 200
    assert resp.json()["overall_score"] == 78


def test_ats_score_empty_job_description(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": "   "},
    )
    assert resp.status_code == 422


def test_ats_score_missing_job_description(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post("/api/ats-score", json={"resume": sample_resume})
    assert resp.status_code == 422


def test_ats_score_missing_resume(client: TestClient) -> None:
    resp = client.post("/api/ats-score", json={"job_description": JOB_DESC})
    assert resp.status_code == 422


def test_ats_score_malformed_ai_response(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.ats_score.complete_smart", return_value="not valid json")

    resp = client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert resp.status_code == 502
    assert "Failed to parse" in resp.json()["detail"]


def test_ats_score_prompt_contains_jd_and_resume(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    def fake_complete_smart(system: str, user: str, model: str | None = None) -> str:
        captured["system"] = system
        captured["user"] = user
        return json.dumps(ATS_RESPONSE)

    mocker.patch("app.routes.ats_score.complete_smart", side_effect=fake_complete_smart)

    client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": JOB_DESC},
    )

    assert JOB_DESC in captured.get("user", "")
    assert "Jane Smith" in captured.get("user", "")
    assert "ATS" in captured.get("system", "")


# ── model switcher (Claude model selection validation) ────────────────────────


def test_ats_score_with_invalid_model_returns_422(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/ats-score",
        json={"resume": sample_resume, "job_description": JOB_DESC, "model": "not-a-real-model"},
    )
    assert resp.status_code == 422
