from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.resume import EnrichRequest
from app.prompts.resume import build_enrich_prompt
from app.services.claude import stream_text

router = APIRouter()


@router.post("/enrich")
async def enrich_resume(body: EnrichRequest) -> StreamingResponse:
    system, user = build_enrich_prompt(body.resume, body.tone or 'professional')

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
