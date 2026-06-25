from __future__ import annotations

import datetime
import re
from typing import Literal

from app.models.resume import ResumeSchema

SENIOR_KEYWORDS = {'senior', 'lead', 'principal', 'manager', 'director', 'head', 'vp', 'staff', 'fellow'}

# Regex to split on spaces and common punctuation for word-boundary checks
_WORD_SPLIT_RE = re.compile(r'[\s/,.()\-]+')


def _parse_year(date_str: str | None) -> int | None:
    """Return a 4-digit year from a date string, or None if unparseable."""
    if not date_str:
        return None
    # Try dateutil first (handles most formats)
    try:
        from dateutil import parser as _du_parser  # type: ignore
        return _du_parser.parse(date_str, default=datetime.datetime(1900, 1, 1)).year
    except Exception:
        pass
    # Fallback: extract first 4-digit year from the string
    match = re.search(r'\b(19|20)\d{2}\b', date_str)
    if match:
        return int(match.group())
    return None


def _parse_date(date_str: str | None) -> datetime.date | None:
    """Return a date from a date string, or None if unparseable."""
    if not date_str:
        return None
    try:
        from dateutil import parser as _du_parser  # type: ignore
        return _du_parser.parse(date_str, default=datetime.datetime(1900, 1, 1)).date()
    except Exception:
        pass
    # Fallback: if we can get a year at least, return Jan 1 of that year
    year = _parse_year(date_str)
    if year:
        return datetime.date(year, 1, 1)
    return None


def infer_career_stage(resume: ResumeSchema) -> Literal['student', 'early', 'experienced']:
    """
    Infer career stage from a parsed resume.

    Priority order:
    1. Senior title short-circuit → 'experienced'
    2. Recent grad with < 2 roles → 'student'
    3. Tenure sum >= 5 years → 'experienced'
    4. Tenure sum < 1 year → 'student'
    5. Otherwise → 'early'
    """

    # ------------------------------------------------------------------
    # 1. Senior title short-circuit
    # ------------------------------------------------------------------
    for exp in resume.experience:
        title_words = set(_WORD_SPLIT_RE.split(exp.title.lower()))
        if title_words & SENIOR_KEYWORDS:
            return 'experienced'

    # ------------------------------------------------------------------
    # 2. Recent grad check
    # ------------------------------------------------------------------
    current_year = datetime.date.today().year
    for edu in resume.education:
        year = _parse_year(edu.end_date)
        if year is not None and year >= current_year - 1:
            # Graduated within ~1 year or in the future
            full_time_count = len(resume.experience)
            if full_time_count < 2:
                return 'student'
            break  # Only need to find one qualifying education record

    # ------------------------------------------------------------------
    # 3. Tenure sum
    # ------------------------------------------------------------------
    today = datetime.date.today()
    total_days = 0.0

    for exp in resume.experience:
        start = _parse_date(exp.start_date)
        if start is None:
            # Cannot determine start — contribute 0
            continue
        end = _parse_date(exp.end_date) if exp.end_date else today
        if end is None:
            end = today
        delta = (end - start).days
        if delta > 0:
            total_days += delta

    total_years = total_days / 365.25

    # ------------------------------------------------------------------
    # 4. Final rules
    # ------------------------------------------------------------------
    if total_years >= 5:
        return 'experienced'
    if total_years < 1:
        return 'student'
    return 'early'
