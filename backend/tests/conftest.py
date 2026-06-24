from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Test client with auth and rate-limiting bypassed for route-logic tests."""
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="test-user-id", token="test-token")
    app.dependency_overrides[ai_rate_limit] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client() -> TestClient:
    """Test client with real auth — for testing 401/429 behavior directly."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_resume() -> dict:
    return {
        "metadata": {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "555-1234",
            "location": "San Francisco, CA",
            "linkedin": "https://linkedin.com/in/jane",
            "github": "https://github.com/jane",
        },
        "summary": "Experienced software engineer with 8 years building scalable systems.",
        "experience": [
            {
                "company": "Google",
                "title": "Senior Software Engineer",
                "location": "San Francisco, CA",
                "start_date": "Jan 2020",
                "end_date": None,
                "bullets": [
                    "Led a team of 5 engineers to redesign the data pipeline",
                    "Reduced p99 latency by 40% through algorithmic improvements",
                ],
            },
            {
                "company": "Stripe",
                "title": "Software Engineer",
                "location": "San Francisco, CA",
                "start_date": "Jun 2017",
                "end_date": "Dec 2019",
                "bullets": ["Built payment processing pipeline handling $2B+ annually"],
            },
        ],
        "education": [
            {
                "school": "MIT",
                "degree": "B.S.",
                "field": "Computer Science",
                "start_date": "Sep 2013",
                "end_date": "Jun 2017",
                "gpa": "3.9",
                "honors": "Magna Cum Laude",
            }
        ],
        "skills": [
            {"category": "Languages", "items": ["Python", "Go", "TypeScript"]},
            {"category": "Frameworks", "items": ["FastAPI", "React", "gRPC"]},
        ],
        "projects": [],
        "detected_industry": "tech",
    }


@pytest.fixture
def claude_resume_response(sample_resume: dict) -> str:
    """Realistic Claude JSON response for a parsed resume."""
    return json.dumps(sample_resume)


@pytest.fixture
def minimal_pdf_bytes() -> bytes:
    """Minimal valid PDF bytes (not parseable by pdfplumber — use with mocked extract_text)."""
    return b"%PDF-1.4 1 0 obj<</Type/Catalog>>endobj\n%%EOF"


@pytest.fixture
def minimal_docx_bytes() -> bytes:
    """Minimal DOCX bytes stub (not parseable — use with mocked extract_text)."""
    # Real DOCX is a ZIP; we stub it because extract_text is always mocked in parse tests.
    return b"PK\x03\x04stub-docx-content"
