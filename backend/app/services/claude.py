from __future__ import annotations

import os
from collections.abc import AsyncIterator

import anthropic
from dotenv import load_dotenv

load_dotenv()

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8192


def complete(system: str, user: str) -> str:
    """Blocking completion — used for parse where we need the full JSON."""
    client = get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text


async def stream_text(system: str, user: str) -> AsyncIterator[str]:
    """Async generator that yields text chunks from a streaming response."""
    client = get_client()
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        for text in stream.text_stream:
            yield text
