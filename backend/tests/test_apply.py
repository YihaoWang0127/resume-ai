from __future__ import annotations

import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

JOB_DESC = "We are hiring a Senior Software Engineer experienced in Python and distributed systems."
COMPANY = "Acme Corp"
ROLE = "Senior Software Engineer"


# ── 401 / auth ────────────────────────────────────────────────────────────────

def test_apply_401_no_token(auth_client: TestClient, sample_resume: dict) -> None:
    resp = auth_client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )
    assert resp.status_code == 401


# ── 422 validation ────────────────────────────────────────────────────────────

def test_apply_422_missing_job_description(client: TestClient, sample_resume: dict) -> None:
    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )
    assert resp.status_code == 422


def test_apply_422_missing_company_name(client: TestClient, sample_resume: dict) -> None:
    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "role": ROLE,
        },
    )
    assert resp.status_code == 422


def test_apply_422_missing_role(client: TestClient, sample_resume: dict) -> None:
    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
        },
    )
    assert resp.status_code == 422


def test_apply_422_missing_resume(client: TestClient) -> None:
    resp = client.post(
        "/api/apply",
        json={
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )
    assert resp.status_code == 422


# ── 402 quota exceeded ────────────────────────────────────────────────────────

def test_apply_402_quota_exceeded(client: TestClient, mocker, sample_resume: dict) -> None:
    mocker.patch(
        "app.routes.apply.check_quota",
        side_effect=HTTPException(status_code=402, detail="Monthly AI limit reached"),
    )
    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )
    assert resp.status_code == 402


# ── streaming response (mocked) ───────────────────────────────────────────────

_TAILORED_RESUME_JSON = json.dumps(
    {
        "metadata": {"name": "Jane Smith", "email": "jane@example.com"},
        "summary": "Tailored summary",
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "detected_industry": "tech",
    }
)

_ATS_RESPONSE_JSON = json.dumps(
    {
        "overall_score": 82,
        "matched_keywords": ["Python"],
        "missing_keywords": [],
        "suggestions": [],
        "summary": "Good match.",
    }
)


def test_apply_returns_ndjson_stream(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.apply.check_quota", return_value=None)

    async def fake_tailor_stream(system: str, user: str):
        yield _TAILORED_RESUME_JSON

    async def fake_cl_stream(system: str, user: str):
        yield "Dear Hiring Manager,"

    call_count = 0

    async def fake_stream(system: str, user: str):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            yield _TAILORED_RESUME_JSON
        else:
            yield "Dear Hiring Manager,"

    mocker.patch("app.routes.apply.stream_text", new=fake_stream)
    mocker.patch("app.routes.apply.complete_smart", return_value=_ATS_RESPONSE_JSON)

    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]

    lines = [line for line in resp.text.strip().split("\n") if line]
    events = [json.loads(line) for line in lines]
    types = [e["type"] for e in events]

    # Must include at minimum: progress, chunk(s), done
    assert "progress" in types
    assert "chunk" in types
    assert "done" in types


def test_apply_stream_stage_order(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    """Verify the stage sequence: tailoring → cover_letter → ats → done."""
    mocker.patch("app.routes.apply.check_quota", return_value=None)

    call_count = 0

    async def fake_stream(system: str, user: str):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            yield _TAILORED_RESUME_JSON
        else:
            yield "Cover letter content."

    mocker.patch("app.routes.apply.stream_text", new=fake_stream)
    mocker.patch("app.routes.apply.complete_smart", return_value=_ATS_RESPONSE_JSON)

    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )

    assert resp.status_code == 200
    lines = [line for line in resp.text.strip().split("\n") if line]
    events = [json.loads(line) for line in lines]

    progress_stages = [e["stage"] for e in events if e["type"] == "progress"]
    result_stages = [e["stage"] for e in events if e["type"] == "result"]

    assert "tailoring" in progress_stages
    assert "cover_letter" in progress_stages
    assert "ats" in progress_stages
    assert "ats" in result_stages

    # Stage ordering: tailoring progress must appear before cover_letter progress
    tailoring_idx = next(
        i for i, e in enumerate(events) if e.get("type") == "progress" and e.get("stage") == "tailoring"
    )
    cover_letter_idx = next(
        i for i, e in enumerate(events) if e.get("type") == "progress" and e.get("stage") == "cover_letter"
    )
    ats_idx = next(
        i for i, e in enumerate(events) if e.get("type") == "progress" and e.get("stage") == "ats"
    )
    done_idx = next(i for i, e in enumerate(events) if e.get("type") == "done")

    assert tailoring_idx < cover_letter_idx < ats_idx < done_idx


def test_apply_ats_result_contains_score(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.apply.check_quota", return_value=None)

    call_count = 0

    async def fake_stream(system: str, user: str):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            yield _TAILORED_RESUME_JSON
        else:
            yield "Cover letter body."

    mocker.patch("app.routes.apply.stream_text", new=fake_stream)
    mocker.patch("app.routes.apply.complete_smart", return_value=_ATS_RESPONSE_JSON)

    resp = client.post(
        "/api/apply",
        json={
            "resume": sample_resume,
            "job_description": JOB_DESC,
            "company_name": COMPANY,
            "role": ROLE,
        },
    )

    lines = [line for line in resp.text.strip().split("\n") if line]
    events = [json.loads(line) for line in lines]

    ats_result = next(e for e in events if e.get("type") == "result" and e.get("stage") == "ats")
    assert ats_result["data"]["overall_score"] == 82
