from __future__ import annotations

import jwt as pyjwt
from fastapi import HTTPException, Request
from limits import parse as parse_rate
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from slowapi.util import get_remote_address

_storage = MemoryStorage()
_strategy = MovingWindowRateLimiter(_storage)
_ai_rate = parse_rate("20/minute")


def _user_id_key(request: Request) -> str:
    """Extract user sub from JWT (unverified) for rate-limit keying, fallback to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = pyjwt.decode(auth[7:], options={"verify_signature": False})
            sub = payload.get("sub", "")
            if sub:
                return str(sub)
        except Exception:
            pass
    return get_remote_address(request)


async def ai_rate_limit(request: Request) -> None:
    """FastAPI dependency: enforce 20 AI calls/minute per user (anonymous or registered)."""
    key = _user_id_key(request)
    if not _strategy.hit(_ai_rate, "ai_calls", key):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: 20 AI calls per minute.",
            headers={"Retry-After": "60"},
        )
