from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # must run before any app.* imports read env vars at module level

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import apply, ats_score, cover_letter, enrich, export, parse, tailor, validate_jd

app = FastAPI(title="Resume AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "https://resume-ai-helper.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(apply.router, prefix="/api")
app.include_router(parse.router, prefix="/api")
app.include_router(enrich.router, prefix="/api")
app.include_router(tailor.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(cover_letter.router, prefix="/api")
app.include_router(ats_score.router, prefix="/api")
app.include_router(validate_jd.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
