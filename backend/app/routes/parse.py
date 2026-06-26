from __future__ import annotations

import json
import os

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ResumeSchema
from app.prompts.resume import build_parse_prompt
from app.services.claude import complete, validate_resume
from app.services.parser import extract_text
from app.services.quota import check_quota, log_ai_call

router = APIRouter()

_ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/octet-stream",
}
_ALLOWED_EXTS = {".pdf", ".docx", ".doc"}
_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/parse", response_model=ResumeSchema)
async def parse_resume(
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
    file: UploadFile = File(...),
) -> ResumeSchema:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if file.content_type not in _ALLOWED_TYPES and ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Upload a PDF or DOCX.",
        )
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file extension '{ext}'. Upload a PDF or DOCX.",
        )

    data = await file.read()
    if len(data) > _MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")

    try:
        raw_text = extract_text(file.filename or "resume", data)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to extract text: {exc}") from exc

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the file.")

    try:
        validation = validate_resume(raw_text)
        if not validation.get("is_resume", False):
            reason = validation.get("reason", "This does not appear to be a resume.")
            raise HTTPException(status_code=400, detail=f"Not a resume: {reason}")
    except HTTPException:
        raise
    except Exception:
        pass  # if validation fails, proceed anyway

    await check_quota(auth.user_id, auth.token)
    background_tasks.add_task(log_ai_call, auth.user_id, "parse", "claude-haiku-4-5", auth.token)

    system, user = build_parse_prompt(raw_text)
    try:
        response_text = complete(system, user)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Claude API error: {exc}") from exc

    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        return ResumeSchema.model_validate(parsed)
    except (json.JSONDecodeError, Exception) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Claude returned invalid JSON: {exc}",
        ) from exc
