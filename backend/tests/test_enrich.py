from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_enrich_returns_stream(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    async def fake_stream(system: str, user: str):
        yield '{"metadata": {"name": "Jane Smith"}}'
        yield ' more text'

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume})

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Jane Smith" in resp.text


def test_enrich_missing_resume(client: TestClient) -> None:
    resp = client.post("/api/enrich", json={})
    assert resp.status_code == 422


def test_enrich_empty_body(client: TestClient) -> None:
    resp = client.post("/api/enrich", content=b"", headers={"content-type": "application/json"})
    assert resp.status_code == 422


def test_enrich_prompt_contains_resume(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    captured: dict = {}

    async def fake_stream(system: str, user: str):
        captured["system"] = system
        captured["user"] = user
        yield "{}"

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    client.post("/api/enrich", json={"resume": sample_resume})

    assert "Jane Smith" in captured.get("user", "")
    assert "Google" in captured.get("user", "")


def test_enrich_streams_chunks(
    client: TestClient,
    sample_resume: dict,
    mocker,
) -> None:
    chunks = ["chunk_one", " chunk_two", " chunk_three"]

    async def fake_stream(system: str, user: str):
        for c in chunks:
            yield c

    mocker.patch("app.routes.enrich.stream_text", new=fake_stream)

    resp = client.post("/api/enrich", json={"resume": sample_resume})
    full = resp.text
    for chunk in chunks:
        assert chunk in full
