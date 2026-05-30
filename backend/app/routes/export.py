from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.resume import ResumeSchema
from app.services.exporter import generate_pdf

router = APIRouter()


@router.post("/export")
async def export_resume(resume: ResumeSchema) -> Response:
    try:
        pdf_bytes = generate_pdf(resume)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc

    filename = f"{resume.metadata.name or 'resume'}.pdf".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
