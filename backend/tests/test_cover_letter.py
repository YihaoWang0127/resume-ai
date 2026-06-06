from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

FAKE_PDF  = b"%PDF-1.7 fake-cover-letter-pdf"
FAKE_DOCX = b"PK\x03\x04fake-cover-letter-docx"
SAMPLE_CONTENT = "I am excited to apply for this role.\n\nMy experience aligns well with your needs."
SAMPLE_COMPANY = "Acme Corp"


# ── /api/cover-letter (streaming generation) ─────────────────────────────────

def test_generate_cover_letter_returns_stream(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str):
        yield "I am excited to apply"
        yield " for this opportunity."

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "Senior engineer role at Acme Corp.",
            "company_name": SAMPLE_COMPANY,
        },
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "excited to apply" in resp.text


def test_missing_job_description_returns_400(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "   ",
            "company_name": SAMPLE_COMPANY,
        },
    )
    assert resp.status_code == 400
    assert "job description" in resp.json()["detail"].lower()


def test_missing_company_name_returns_400(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "Senior engineer role.",
            "company_name": "   ",
        },
    )
    assert resp.status_code == 400
    assert "company name" in resp.json()["detail"].lower()


def test_generate_streams_all_chunks(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    chunks = ["First paragraph.", " Second paragraph.", " Third paragraph."]

    async def fake_stream(system: str, user: str):
        for c in chunks:
            yield c

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "Engineer at Acme.",
            "company_name": SAMPLE_COMPANY,
        },
    )

    full = resp.text
    for chunk in chunks:
        assert chunk in full


def test_generate_prompt_contains_resume_and_jd(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str):
        captured["system"] = system
        captured["user"] = user
        yield "ok"

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "Looking for a senior engineer with Python skills.",
            "company_name": SAMPLE_COMPANY,
        },
    )

    assert "Jane Smith" in captured.get("user", "")
    assert "Python skills" in captured.get("user", "")
    assert SAMPLE_COMPANY in captured.get("user", "")


def test_generate_tone_is_forwarded(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str):
        captured["user"] = user
        yield "ok"

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "Some job.",
            "company_name": SAMPLE_COMPANY,
            "tone": "enthusiastic",
        },
    )

    assert "enthusiastic" in captured.get("user", "").lower()


def test_generate_missing_resume_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/api/cover-letter",
        json={"job_description": "Some job.", "company_name": SAMPLE_COMPANY},
    )
    assert resp.status_code == 422


# ── /api/cover-letter/export ─────────────────────────────────────────────────

def test_export_pdf_returns_bytes(client: TestClient, mocker) -> None:
    mocker.patch("app.routes.export.generate_cover_letter_pdf", return_value=FAKE_PDF)

    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": SAMPLE_COMPANY, "format": "pdf"},
    )

    assert resp.status_code == 200
    assert resp.content == FAKE_PDF
    assert "application/pdf" in resp.headers["content-type"]


def test_export_docx_returns_bytes(client: TestClient, mocker) -> None:
    mocker.patch("app.routes.export.generate_cover_letter_docx", return_value=FAKE_DOCX)

    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": SAMPLE_COMPANY, "format": "docx"},
    )

    assert resp.status_code == 200
    assert resp.content == FAKE_DOCX
    assert "wordprocessingml" in resp.headers["content-type"]


def test_export_txt_returns_text(client: TestClient) -> None:
    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": SAMPLE_COMPANY, "format": "txt"},
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert SAMPLE_CONTENT.encode() == resp.content


def test_export_txt_filename_uses_company_name(client: TestClient) -> None:
    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": "Acme Corp", "format": "txt"},
    )
    assert "acme_corp" in resp.headers["content-disposition"]


def test_export_pdf_filename_uses_company_name(client: TestClient, mocker) -> None:
    mocker.patch("app.routes.export.generate_cover_letter_pdf", return_value=FAKE_PDF)

    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": "Acme Corp", "format": "pdf"},
    )
    assert "acme_corp" in resp.headers["content-disposition"]
    assert ".pdf" in resp.headers["content-disposition"]


def test_export_invalid_format_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/api/cover-letter/export",
        json={"content": SAMPLE_CONTENT, "company_name": SAMPLE_COMPANY, "format": "xml"},
    )
    assert resp.status_code == 422
