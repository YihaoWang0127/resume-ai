from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ResumeSchema
from app.prompts.resume import build_cover_letter_prompt, build_improve_cover_letter_prompt
from app.services.claude import stream_text

router = APIRouter()


class CoverLetterRequest(BaseModel):
    resume: ResumeSchema
    job_description: str = ""
    company_name: str
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"


class CoverLetterImproveRequest(BaseModel):
    text: str
    selection: Optional[str] = None
    job_description: Optional[str] = None
    resume: Optional[ResumeSchema] = None
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"


@router.post("/cover-letter")
async def generate_cover_letter(
    req: CoverLetterRequest,
    _user_id: str = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
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


@router.post("/cover-letter/improve")
async def improve_cover_letter(
    req: CoverLetterImproveRequest,
    _user_id: str = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
    resume_json = req.resume.model_dump_json(indent=2) if req.resume else None
    system, user = build_improve_cover_letter_prompt(
        text=req.text,
        selection=req.selection,
        job_description=req.job_description,
        tone=req.tone,
        resume_json=resume_json,
    )

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
