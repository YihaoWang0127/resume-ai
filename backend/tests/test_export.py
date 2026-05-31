from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

FAKE_PDF = b"%PDF-1.7 fake-pdf-content-for-testing"
FAKE_DOCX = b"PK\x03\x04fake-docx-content-for-testing"


def test_export_pdf_returns_bytes(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_pdf", return_value=FAKE_PDF)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "pdf"})

    assert resp.status_code == 200
    assert resp.content == FAKE_PDF


def test_export_docx_returns_bytes(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_docx", return_value=FAKE_DOCX)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "docx"})

    assert resp.status_code == 200
    assert resp.content == FAKE_DOCX


def test_export_invalid_format(
    client: TestClient,
    sample_resume: dict,
) -> None:
    resp = client.post("/api/export", json={"resume": sample_resume, "format": "xml"})
    assert resp.status_code == 422


def test_export_content_type_pdf(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_pdf", return_value=FAKE_PDF)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "pdf"})

    assert PDF_MIME in resp.headers["content-type"]


def test_export_content_type_docx(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_docx", return_value=FAKE_DOCX)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "docx"})

    assert DOCX_MIME in resp.headers["content-type"]


def test_export_content_disposition_pdf(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_pdf", return_value=FAKE_PDF)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "pdf"})

    disposition = resp.headers.get("content-disposition", "")
    assert ".pdf" in disposition
    assert "attachment" in disposition


def test_export_content_disposition_docx(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_docx", return_value=FAKE_DOCX)

    resp = client.post("/api/export", json={"resume": sample_resume, "format": "docx"})

    disposition = resp.headers.get("content-disposition", "")
    assert ".docx" in disposition
    assert "attachment" in disposition


@pytest.mark.parametrize("industry", ["general", "tech", "finance", "creative", "healthcare"])
def test_export_pdf_with_industry(
    client: TestClient,
    sample_resume: dict,
    industry: str,
) -> None:
    """Each industry preset produces a valid PDF (real generation, no mock)."""
    resp = client.post(
        "/api/export",
        json={"resume": sample_resume, "format": "pdf", "industry": industry},
    )

    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"


def test_export_default_format_is_pdf(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    mocker.patch("app.routes.export.generate_pdf", return_value=FAKE_PDF)

    resp = client.post("/api/export", json={"resume": sample_resume})

    assert resp.status_code == 200
    assert PDF_MIME in resp.headers["content-type"]


def test_export_missing_resume(client: TestClient) -> None:
    resp = client.post("/api/export", json={"format": "pdf"})
    assert resp.status_code == 422
