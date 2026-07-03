from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ResumeSchema, _validate_smart_model
from app.prompts.resume import build_cover_letter_prompt, build_improve_cover_letter_prompt
from app.services.claude import SMART_MODEL, FABLE_MODEL, stream_text
from app.services.quota import check_quota, log_ai_call

router = APIRouter()


class CoverLetterRequest(BaseModel):
    resume: ResumeSchema
    job_description: str = ""
    company_name: str
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"
    model: Optional[str] = None

    _validate_model = field_validator("model")(_validate_smart_model)


class CoverLetterImproveRequest(BaseModel):
    text: str
    selection: Optional[str] = None
    job_description: Optional[str] = None
    resume: Optional[ResumeSchema] = None
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"
    model: Optional[str] = None

    _validate_model = field_validator("model")(_validate_smart_model)


@router.post("/cover-letter")
async def generate_cover_letter(
    req: CoverLetterRequest,
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
    if not req.company_name.strip():
        raise HTTPException(400, "Company name is required")

    if req.model == FABLE_MODEL and auth.is_anonymous:
        raise HTTPException(403, "Claude Fable 5 requires a registered account.")

    await check_quota(auth.user_id, auth.token, auth.is_anonymous)
    used_model = req.model or SMART_MODEL
    background_tasks.add_task(log_ai_call, auth.user_id, "cover_letter", used_model, auth.token)

    resume_json = req.resume.model_dump_json(indent=2)
    system, user = build_cover_letter_prompt(
        resume_json, req.job_description, req.company_name, req.tone
    )

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user, model=req.model):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


@router.post("/cover-letter/improve")
async def improve_cover_letter(
    req: CoverLetterImproveRequest,
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
    if req.model == FABLE_MODEL and auth.is_anonymous:
        raise HTTPException(403, "Claude Fable 5 requires a registered account.")

    await check_quota(auth.user_id, auth.token, auth.is_anonymous)
    used_model = req.model or SMART_MODEL
    background_tasks.add_task(log_ai_call, auth.user_id, "cover_letter_improve", used_model, auth.token)

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
            async for chunk in stream_text(system, user, model=req.model):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
