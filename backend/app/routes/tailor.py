from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.resume import TailorRequest
from app.prompts.resume import build_tailor_prompt
from app.services.claude import stream_text

router = APIRouter()


@router.post("/tailor")
async def tailor_resume(body: TailorRequest) -> StreamingResponse:
    if not body.job_description.strip():
        raise HTTPException(status_code=422, detail="job_description must not be empty.")

    system, user = build_tailor_prompt(body.resume, body.job_description)

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
