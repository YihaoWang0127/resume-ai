from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ATSScoreRequest, ATSScoreResponse
from app.prompts.resume import build_ats_score_prompt
from app.services.claude import complete_smart

router = APIRouter()


@router.post("/ats-score", response_model=ATSScoreResponse)
async def ats_score(
    body: ATSScoreRequest,
    _user_id: str = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> ATSScoreResponse:
    if not body.job_description.strip():
        raise HTTPException(status_code=422, detail="job_description must not be empty.")

    system, user = build_ats_score_prompt(body.resume, body.job_description)
    raw = complete_smart(system, user)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Failed to parse ATS analysis from AI response.")

    return ATSScoreResponse(**data)
