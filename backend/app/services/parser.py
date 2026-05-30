from __future__ import annotations

import io
from pathlib import Path

import pdfplumber
import docx


def extract_text_from_pdf(data: bytes) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_from_docx(data: bytes) -> str:
    doc = docx.Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(data)
    if suffix in (".docx", ".doc"):
        return extract_text_from_docx(data)
    raise ValueError(f"Unsupported file type: {suffix}. Only PDF and DOCX are supported.")
