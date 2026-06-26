from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ValidateJdRequest, ValidateJdResponse
from app.prompts.resume import build_validate_jd_prompt, build_validate_role_prompt
from app.services.claude import complete

router = APIRouter()


@router.post("/validate-jd", response_model=ValidateJdResponse)
async def validate_job_description(
    req: ValidateJdRequest,
    _auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> ValidateJdResponse:
    if not req.text.strip():
        return ValidateJdResponse(valid=False, reason="No text provided.")

    system, user = build_validate_jd_prompt(req.text)
    try:
        raw = complete(system, user)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(raw)
        return ValidateJdResponse(
            valid=bool(result.get("valid", False)),
            reason=str(result.get("reason", "")),
        )
    except Exception:
        # Fail open — if classification fails, treat as valid to not block the user
        return ValidateJdResponse(valid=True, reason="")


@router.post("/validate-role", response_model=ValidateJdResponse)
async def validate_role(
    req: ValidateJdRequest,
    _auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> ValidateJdResponse:
    if not req.text.strip():
        return ValidateJdResponse(valid=False, reason="No text provided.")

    system, user = build_validate_role_prompt(req.text)
    try:
        raw = complete(system, user)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(raw)
        return ValidateJdResponse(
            valid=bool(result.get("valid", False)),
            reason=str(result.get("reason", "")),
        )
    except Exception:
        return ValidateJdResponse(valid=True, reason="")
