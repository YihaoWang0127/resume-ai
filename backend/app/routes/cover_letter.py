from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.resume import ResumeSchema
from app.prompts.resume import build_cover_letter_prompt
from app.services.claude import stream_text

router = APIRouter()


class CoverLetterRequest(BaseModel):
    resume: ResumeSchema
    job_description: str
    company_name: str
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"


@router.post("/cover-letter")
async def generate_cover_letter(req: CoverLetterRequest) -> StreamingResponse:
    if not req.job_description.strip():
        raise HTTPException(400, "Job description is required")
    if not req.company_name.strip():
        raise HTTPException(400, "Company name is required")

    resume_json = req.resume.model_dump_json(indent=2)
    system, user = build_cover_letter_prompt(
        resume_json, req.job_description, req.company_name, req.tone
    )

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
