from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_parse_docx_success(
    client: TestClient,
    sample_resume: dict,
    claude_resume_response: str,
    minimal_docx_bytes: bytes,
    mocker,
) -> None:
    mocker.patch("app.routes.parse.extract_text", return_value="Jane Smith\nSoftware Engineer")
    mocker.patch("app.routes.parse.complete", return_value=claude_resume_response)

    resp = client.post(
        "/api/parse",
        files={"file": ("resume.docx", minimal_docx_bytes, DOCX_MIME)},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["metadata"]["name"] == "Jane Smith"
    assert data["metadata"]["email"] == "jane@example.com"
    assert len(data["experience"]) == 2


def test_parse_pdf_success(
    client: TestClient,
    sample_resume: dict,
    claude_resume_response: str,
    minimal_pdf_bytes: bytes,
    mocker,
) -> None:
    mocker.patch("app.routes.parse.extract_text", return_value="Jane Smith Software Engineer")
    mocker.patch("app.routes.parse.complete", return_value=claude_resume_response)

    resp = client.post(
        "/api/parse",
        files={"file": ("resume.pdf", minimal_pdf_bytes, "application/pdf")},
    )

    assert resp.status_code == 200
    assert resp.json()["metadata"]["name"] == "Jane Smith"


def test_parse_unsupported_format(client: TestClient) -> None:
    resp = client.post(
        "/api/parse",
        files={"file": ("resume.txt", b"plain text content", "text/plain")},
    )
    assert resp.status_code == 415


def test_parse_file_too_large(client: TestClient) -> None:
    big = b"x" * (10 * 1024 * 1024 + 1)
    resp = client.post(
        "/api/parse",
        files={"file": ("resume.docx", big, DOCX_MIME)},
    )
    assert resp.status_code == 413


def test_parse_claude_error(
    client: TestClient,
    minimal_docx_bytes: bytes,
    mocker,
) -> None:
    mocker.patch("app.routes.parse.extract_text", return_value="Jane Smith Engineer")
    mocker.patch("app.routes.parse.complete", side_effect=Exception("API timeout"))

    resp = client.post(
        "/api/parse",
        files={"file": ("resume.docx", minimal_docx_bytes, DOCX_MIME)},
    )
    assert resp.status_code == 502
    assert "Claude API error" in resp.json()["detail"]


def test_parse_detects_industry(
    client: TestClient,
    sample_resume: dict,
    minimal_pdf_bytes: bytes,
    mocker,
) -> None:
    response_data = {**sample_resume, "detected_industry": "finance"}
    mocker.patch("app.routes.parse.extract_text", return_value="Investment Banker Goldman Sachs")
    mocker.patch("app.routes.parse.complete", return_value=json.dumps(response_data))

    resp = client.post(
        "/api/parse",
        files={"file": ("resume.pdf", minimal_pdf_bytes, "application/pdf")},
    )

    assert resp.status_code == 200
    assert resp.json()["detected_industry"] == "finance"


def test_parse_strips_markdown_fences(
    client: TestClient,
    sample_resume: dict,
    minimal_docx_bytes: bytes,
    mocker,
) -> None:
    fenced = f"```json\n{json.dumps(sample_resume)}\n```"
    mocker.patch("app.routes.parse.extract_text", return_value="Some resume text")
    mocker.patch("app.routes.parse.complete", return_value=fenced)

    resp = client.post(
        "/api/parse",
        files={"file": ("resume.docx", minimal_docx_bytes, DOCX_MIME)},
    )
    assert resp.status_code == 200
    assert resp.json()["metadata"]["name"] == "Jane Smith"
