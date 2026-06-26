from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
_FREE_QUOTA = 30


def _headers(token: str) -> dict[str, str]:
    return {
        "apikey": _SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def check_quota(user_id: str, token: str, is_anonymous: bool = False) -> None:
    """Raise HTTP 402 if a guest user has used >= _FREE_QUOTA AI calls this month.

    Regular logged-in users have no monthly limit.  Only anonymous (guest) sessions
    are quota-gated.  Fails open if Supabase env vars are unset or the HTTP call
    fails — ensures dev/test environments are unaffected.
    """
    if not is_anonymous:
        return  # no quota limit for authenticated (non-guest) users

    if not _SUPABASE_URL or not _SUPABASE_ANON_KEY:
        return

    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_SUPABASE_URL}/rest/v1/ai_usage_log",
                params={
                    "user_id": f"eq.{user_id}",
                    "created_at": f"gte.{first_of_month}",
                    "select": "id",
                    "limit": str(_FREE_QUOTA),
                },
                headers=_headers(token),
            )
        if resp.status_code == 200 and len(resp.json()) >= _FREE_QUOTA:
            raise HTTPException(
                status_code=402,
                detail=f"Monthly AI limit of {_FREE_QUOTA} calls reached. Upgrade to continue.",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # fail open


async def log_ai_call(user_id: str, action: str, model: str, token: str) -> None:
    """Best-effort: insert a usage row into ai_usage_log. Never raises."""
    if not _SUPABASE_URL or not _SUPABASE_ANON_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{_SUPABASE_URL}/rest/v1/ai_usage_log",
                json={"user_id": user_id, "action": action, "model": model},
                headers=_headers(token),
            )
    except Exception:
        pass
