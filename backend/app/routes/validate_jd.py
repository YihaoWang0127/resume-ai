from __future__ import annotations

import json

from fastapi import APIRouter
from app.models.resume import ValidateJdRequest, ValidateJdResponse
from app.prompts.resume import build_validate_jd_prompt
from app.services.claude import complete

router = APIRouter()


@router.post("/validate-jd", response_model=ValidateJdResponse)
async def validate_job_description(req: ValidateJdRequest) -> ValidateJdResponse:
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
