from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.prompts.resume import build_improve_cover_letter_prompt

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
    async def fake_stream(system: str, user: str, model: str | None = None):
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


def test_whitespace_job_description_returns_200(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "Cover letter content."

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter",
        json={
            "resume": sample_resume,
            "job_description": "   ",
            "company_name": SAMPLE_COMPANY,
        },
    )
    assert resp.status_code == 200


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

    async def fake_stream(system: str, user: str, model: str | None = None):
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

    async def fake_stream(system: str, user: str, model: str | None = None):
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

    async def fake_stream(system: str, user: str, model: str | None = None):
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


# ── /api/cover-letter/improve (streaming improvement) ────────────────────────

SAMPLE_COVER_LETTER = (
    "I am excited to apply for the Software Engineer role at Acme Corp.\n\n"
    "My experience at Google and Stripe has prepared me well for this position."
)
SAMPLE_SELECTION = "My experience at Google and Stripe has prepared me well for this position."


def test_improve_full_text(client: TestClient, mocker) -> None:
    """POST with text only (no selection) returns 200 streaming plain text."""
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "Improved cover letter text."

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter/improve",
        json={"text": SAMPLE_COVER_LETTER},
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Improved" in resp.text


def test_improve_with_selection(client: TestClient, mocker) -> None:
    """POST with text + non-empty selection returns 200 streaming plain text."""
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "My background at Google and Stripe uniquely qualifies me."

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter/improve",
        json={"text": SAMPLE_COVER_LETTER, "selection": SAMPLE_SELECTION},
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert resp.text.strip() != ""


def test_improve_with_job_description(client: TestClient, mocker) -> None:
    """POST with text + job_description returns 200 streaming plain text."""
    async def fake_stream(system: str, user: str, model: str | None = None):
        yield "Tailored improvement with JD context."

    mocker.patch("app.routes.cover_letter.stream_text", new=fake_stream)

    resp = client.post(
        "/api/cover-letter/improve",
        json={
            "text": SAMPLE_COVER_LETTER,
            "job_description": "Senior engineer with Python and distributed systems experience.",
        },
    )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert resp.text.strip() != ""


def test_improve_missing_text_returns_422(client: TestClient) -> None:
    """POST with missing text field returns 422 (Pydantic validation failure)."""
    resp = client.post(
        "/api/cover-letter/improve",
        json={"selection": SAMPLE_SELECTION},
    )
    assert resp.status_code == 422


# ── build_improve_cover_letter_prompt unit tests ──────────────────────────────


def test_improve_prompt_with_selection_contains_excerpt() -> None:
    """User message references the selection text and describes it as an excerpt."""
    _, user = build_improve_cover_letter_prompt(
        text=SAMPLE_COVER_LETTER,
        selection=SAMPLE_SELECTION,
        job_description=None,
        tone="professional",
        resume_json=None,
    )
    assert SAMPLE_SELECTION in user
    assert "excerpt" in user.lower()


def test_improve_prompt_without_selection_contains_full_text() -> None:
    """User message contains the full cover letter when no selection is given."""
    _, user = build_improve_cover_letter_prompt(
        text=SAMPLE_COVER_LETTER,
        selection=None,
        job_description=None,
        tone="professional",
        resume_json=None,
    )
    assert SAMPLE_COVER_LETTER in user


def test_improve_prompt_with_job_description_includes_jd() -> None:
    """Job description text appears in the user message when provided."""
    jd = "Looking for a senior engineer with Python and Kubernetes skills."
    _, user = build_improve_cover_letter_prompt(
        text=SAMPLE_COVER_LETTER,
        selection=None,
        job_description=jd,
        tone="professional",
        resume_json=None,
    )
    assert jd in user


def test_improve_prompt_without_job_description_excludes_jd() -> None:
    """No job description section appears in the user message when JD is absent."""
    _, user = build_improve_cover_letter_prompt(
        text=SAMPLE_COVER_LETTER,
        selection=None,
        job_description=None,
        tone="professional",
        resume_json=None,
    )
    assert "JOB DESCRIPTION" not in user


def test_improve_prompt_whitespace_only_jd_excluded() -> None:
    """Whitespace-only job description is treated as absent — not included in prompt."""
    _, user = build_improve_cover_letter_prompt(
        text=SAMPLE_COVER_LETTER,
        selection=None,
        job_description="   ",
        tone="professional",
        resume_json=None,
    )
    assert "JOB DESCRIPTION" not in user
