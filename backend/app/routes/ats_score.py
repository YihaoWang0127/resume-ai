from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ATSScoreRequest, ATSScoreResponse
from app.prompts.resume import build_ats_score_prompt
from app.services.claude import complete_smart
from app.services.quota import check_quota, log_ai_call

router = APIRouter()


@router.post("/ats-score", response_model=ATSScoreResponse)
async def ats_score(
    body: ATSScoreRequest,
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> ATSScoreResponse:
    if not body.job_description.strip():
        raise HTTPException(status_code=422, detail="job_description must not be empty.")

    await check_quota(auth.user_id, auth.token, auth.is_anonymous)
    background_tasks.add_task(log_ai_call, auth.user_id, "ats_score", "claude-sonnet-4-6", auth.token)

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
