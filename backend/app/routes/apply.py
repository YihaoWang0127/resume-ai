from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import ApplyRequest, ATSScoreResponse, ResumeSchema
from app.prompts.resume import build_ats_score_prompt, build_cover_letter_prompt, build_tailor_prompt
from app.services.career_stage import infer_career_stage
from app.services.claude import complete_smart, stream_text
from app.services.quota import check_quota, log_ai_call

router = APIRouter()


@router.post("/apply")
async def apply_to_job(
    body: ApplyRequest,
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
    await check_quota(auth.user_id, auth.token, auth.is_anonymous)

    background_tasks.add_task(log_ai_call, auth.user_id, "apply_tailor", "claude-sonnet-4-6", auth.token)
    background_tasks.add_task(log_ai_call, auth.user_id, "apply_cover_letter", "claude-sonnet-4-6", auth.token)
    background_tasks.add_task(log_ai_call, auth.user_id, "apply_ats", "claude-sonnet-4-6", auth.token)

    stage = body.career_stage or infer_career_stage(body.resume)

    async def generate() -> AsyncIterator[str]:
        try:
            # ----------------------------------------------------------------
            # Step 1: Tailor resume
            # ----------------------------------------------------------------
            yield json.dumps({"type": "progress", "stage": "tailoring", "message": "Tailoring resume..."}) + "\n"

            system, user = build_tailor_prompt(body.resume, body.job_description, stage)
            tailor_chunks: list[str] = []
            async for chunk in stream_text(system, user):
                tailor_chunks.append(chunk)
                yield json.dumps({"type": "chunk", "stage": "tailoring", "text": chunk}) + "\n"

            tailor_text = "".join(tailor_chunks)

            # ----------------------------------------------------------------
            # Step 2: Cover letter
            # ----------------------------------------------------------------
            yield json.dumps({"type": "progress", "stage": "cover_letter", "message": "Writing cover letter..."}) + "\n"

            cl_system, cl_user = build_cover_letter_prompt(
                tailor_text,
                body.job_description,
                body.company_name,
                "professional",
            )
            async for chunk in stream_text(cl_system, cl_user):
                yield json.dumps({"type": "chunk", "stage": "cover_letter", "text": chunk}) + "\n"

            # ----------------------------------------------------------------
            # Step 3: ATS score
            # ----------------------------------------------------------------
            yield json.dumps({"type": "progress", "stage": "ats", "message": "Scoring ATS match..."}) + "\n"

            # Strip markdown fences from tailor_text before parsing
            clean_tailor = tailor_text.strip()
            if clean_tailor.startswith("```"):
                clean_tailor = clean_tailor.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            tailored_resume = ResumeSchema.model_validate_json(clean_tailor)
            ats_system, ats_user = build_ats_score_prompt(tailored_resume, body.job_description)

            raw_ats = await asyncio.to_thread(complete_smart, ats_system, ats_user)

            clean_ats = raw_ats.strip()
            if clean_ats.startswith("```"):
                clean_ats = clean_ats.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            ats_data = ATSScoreResponse.model_validate_json(clean_ats)
            yield json.dumps({"type": "result", "stage": "ats", "data": ats_data.model_dump()}) + "\n"

            # ----------------------------------------------------------------
            # Done
            # ----------------------------------------------------------------
            yield json.dumps({"type": "done"}) + "\n"

        except Exception as exc:
            yield json.dumps({"type": "error", "message": str(exc)}) + "\n"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
