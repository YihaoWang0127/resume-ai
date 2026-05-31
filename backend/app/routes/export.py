from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.models.resume import ResumeSchema
from app.services.exporter import generate_docx, generate_pdf

router = APIRouter()


class ExportRequest(BaseModel):
    resume: ResumeSchema
    format: str = "pdf"
    industry: str = "general"


@router.post("/export")
async def export_resume(req: ExportRequest) -> Response:
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
