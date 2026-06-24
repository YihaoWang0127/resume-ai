from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.auth import get_current_user
from app.models.resume import ResumeSchema
from app.services.exporter import generate_cover_letter_docx, generate_cover_letter_pdf, generate_docx, generate_pdf

router = APIRouter()


class ExportRequest(BaseModel):
    resume: ResumeSchema
    format: Literal["pdf", "docx"] = "pdf"
    industry: str = "general"


@router.post("/export")
async def export_resume(
    req: ExportRequest,
    _user_id: str = Depends(get_current_user),
) -> Response:
    name = req.resume.metadata.name or "resume"
    fmt = req.format.lower()

    if fmt == "docx":
        try:
            content = generate_docx(req.resume, req.industry)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"DOCX generation failed: {exc}") from exc
        filename = f"{name}.docx".replace(" ", "_")
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    try:
        content = generate_pdf(req.resume, req.industry)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc
    filename = f"{name}.pdf".replace(" ", "_")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class CoverLetterExportRequest(BaseModel):
    content: str
    company_name: str
    format: Literal["pdf", "docx", "txt"]


@router.post("/cover-letter/export")
async def export_cover_letter(
    req: CoverLetterExportRequest,
    _user_id: str = Depends(get_current_user),
) -> Response:
    slug = re.sub(r"[^\w]+", "_", req.company_name.strip().lower()) or "company"
    filename = f"cover_letter_{slug}"

    if req.format == "txt":
        return Response(
            content=req.content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.txt"'},
        )

    if req.format == "docx":
        try:
            data = generate_cover_letter_docx(req.content, req.company_name)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"DOCX generation failed: {exc}") from exc
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'},
        )

    try:
        data = generate_cover_letter_pdf(req.content, req.company_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )
