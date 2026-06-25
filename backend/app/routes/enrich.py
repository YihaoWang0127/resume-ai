from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse

from app.auth import AuthUser, get_current_user
from app.limiter import ai_rate_limit
from app.models.resume import EnrichRequest
from app.prompts.resume import build_enrich_prompt
from app.services.career_stage import infer_career_stage
from app.services.claude import stream_text
from app.services.quota import check_quota, log_ai_call

router = APIRouter()


@router.post("/enrich")
async def enrich_resume(
    body: EnrichRequest,
    background_tasks: BackgroundTasks,
    auth: AuthUser = Depends(get_current_user),
    _rate: None = Depends(ai_rate_limit),
) -> StreamingResponse:
    await check_quota(auth.user_id, auth.token)
    background_tasks.add_task(log_ai_call, auth.user_id, "enrich", "claude-sonnet-4-6", auth.token)

    stage = body.career_stage or infer_career_stage(body.resume)
    system, user = build_enrich_prompt(body.resume, body.tone or 'professional', stage)

    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in stream_text(system, user):
                yield chunk
        except Exception as exc:
            yield f"\n[ERROR] {exc}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
