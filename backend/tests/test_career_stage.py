from __future__ import annotations

import datetime

import pytest

from app.models.resume import EducationItem, ExperienceItem, ResumeSchema
from app.services.career_stage import infer_career_stage

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resume(
    experience: list[ExperienceItem] | None = None,
    education: list[EducationItem] | None = None,
) -> ResumeSchema:
    """Construct a minimal ResumeSchema with only the supplied fields."""
    return ResumeSchema(
        experience=experience or [],
        education=education or [],
    )


def _exp(title: str, start_date: str, end_date: str | None = None) -> ExperienceItem:
    return ExperienceItem(company="Acme", title=title, start_date=start_date, end_date=end_date)


def _edu(end_date: str | None) -> EducationItem:
    return EducationItem(school="State U", degree="B.S.", end_date=end_date)


# ---------------------------------------------------------------------------
# 1. Senior title short-circuit → 'experienced'
# ---------------------------------------------------------------------------

def test_senior_title_short_circuits_to_experienced() -> None:
    """A resume with 'Senior' in the title should be 'experienced' regardless of tenure."""
    resume = _resume(
        experience=[_exp("Senior Engineer", "Jan 2023", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "experienced"


def test_senior_title_short_circuits_even_with_short_tenure() -> None:
    """Tenure is only 2 years but 'Senior' title → still 'experienced'."""
    resume = _resume(
        experience=[_exp("Senior Product Manager", "Jan 2023", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "experienced"


# ---------------------------------------------------------------------------
# 2. Lead / other senior-keyword titles → 'experienced'
# ---------------------------------------------------------------------------

def test_lead_title_short_circuits_to_experienced() -> None:
    """'Lead Developer' title (2 yrs) → short-circuit to 'experienced'."""
    resume = _resume(
        experience=[_exp("Lead Developer", "Jan 2023", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "experienced"


def test_principal_title_short_circuits_to_experienced() -> None:
    resume = _resume(
        experience=[_exp("Principal Engineer", "Jan 2023", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "experienced"


def test_director_title_short_circuits_to_experienced() -> None:
    resume = _resume(
        experience=[_exp("Director of Engineering", "Jan 2022", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "experienced"


# ---------------------------------------------------------------------------
# 3. Student / recent grad: edu end_date within ~1 yr, < 2 experience roles
# ---------------------------------------------------------------------------

def test_recent_grad_zero_roles_is_student() -> None:
    """Graduated this year, 0 full-time roles → 'student'."""
    current_year = datetime.date.today().year
    resume = _resume(
        education=[_edu(str(current_year))],
        experience=[],
    )
    assert infer_career_stage(resume) == "student"


def test_recent_grad_next_year_is_student() -> None:
    """Graduation date in the future (current_year + 1), 0 roles → 'student'."""
    current_year = datetime.date.today().year
    resume = _resume(
        education=[_edu(str(current_year + 1))],
        experience=[],
    )
    assert infer_career_stage(resume) == "student"


def test_recent_grad_one_short_role_is_student() -> None:
    """Graduated this year, 1 short internship-length role → 'student'."""
    current_year = datetime.date.today().year
    resume = _resume(
        education=[_edu(str(current_year))],
        experience=[_exp("Intern", "Jun 2024", "Aug 2024")],
    )
    assert infer_career_stage(resume) == "student"


def test_old_grad_two_roles_is_not_student_by_edu() -> None:
    """Graduated 5 years ago (not recent) should NOT trigger the recent-grad branch."""
    current_year = datetime.date.today().year
    resume = _resume(
        education=[_edu(str(current_year - 5))],
        experience=[
            _exp("Software Engineer", "Jan 2020", "Jan 2022"),
            _exp("Senior Engineer", "Jan 2022", "Jan 2025"),
        ],
    )
    # Senior title triggers experienced via short-circuit in this case
    assert infer_career_stage(resume) == "experienced"


# ---------------------------------------------------------------------------
# 4. Early career: 1–4 years tenure, no senior title
# ---------------------------------------------------------------------------

def test_three_years_no_senior_is_early() -> None:
    """3 years of experience, no senior title → 'early'."""
    resume = _resume(
        experience=[_exp("Software Engineer", "Jan 2021", "Jan 2024")]
    )
    assert infer_career_stage(resume) == "early"


def test_two_years_split_across_jobs_is_early() -> None:
    """Two jobs totalling ~2.5 years, no senior title → 'early'."""
    resume = _resume(
        experience=[
            _exp("Junior Developer", "Jan 2022", "Jan 2023"),
            _exp("Software Engineer", "Jan 2023", "Jul 2024"),
        ]
    )
    assert infer_career_stage(resume) == "early"


# ---------------------------------------------------------------------------
# 5. Experienced by tenure: >= 5 years, no senior title
# ---------------------------------------------------------------------------

def test_six_years_no_senior_is_experienced() -> None:
    """6 years of experience, no senior title → 'experienced'."""
    resume = _resume(
        experience=[_exp("Software Engineer", "Jan 2018", "Jan 2024")]
    )
    assert infer_career_stage(resume) == "experienced"


def test_exactly_five_years_is_experienced() -> None:
    """Exactly 5 years (>= 5) → 'experienced'."""
    resume = _resume(
        experience=[_exp("Software Engineer", "Jan 2019", "Jan 2024")]
    )
    assert infer_career_stage(resume) == "experienced"


# ---------------------------------------------------------------------------
# 6. Short tenure → 'student'
# ---------------------------------------------------------------------------

def test_less_than_one_year_tenure_is_student() -> None:
    """6 months of experience, no senior title → 'student'."""
    resume = _resume(
        experience=[_exp("Junior Developer", "Jul 2024", "Jan 2025")]
    )
    assert infer_career_stage(resume) == "student"


def test_no_experience_at_all_is_student() -> None:
    """Empty experience list → 'student' (0 years)."""
    resume = _resume(experience=[])
    assert infer_career_stage(resume) == "student"


# ---------------------------------------------------------------------------
# 7. Tolerant date parsing — never crashes on bad/missing dates
# ---------------------------------------------------------------------------

def test_empty_start_date_does_not_crash() -> None:
    """ExperienceItem with empty start_date contributes 0 days — no exception."""
    resume = _resume(
        experience=[ExperienceItem(company="X", title="Dev", start_date="", end_date=None)]
    )
    result = infer_career_stage(resume)
    assert result in {"student", "early", "experienced"}


def test_garbage_dates_do_not_crash() -> None:
    """Random strings in date fields must not raise an exception."""
    resume = _resume(
        experience=[ExperienceItem(company="X", title="Dev", start_date="not-a-date", end_date="???")]
    )
    result = infer_career_stage(resume)
    assert result in {"student", "early", "experienced"}


def test_none_end_date_treated_as_present() -> None:
    """None end_date means 'Present' — should not crash and should accumulate days."""
    # Start 3 years ago → ~3 years tenure → 'early'
    three_years_ago = (datetime.date.today() - datetime.timedelta(days=3 * 365)).strftime("%b %Y")
    resume = _resume(
        experience=[_exp("Software Engineer", three_years_ago, None)]
    )
    result = infer_career_stage(resume)
    assert result in {"early", "experienced"}


def test_missing_education_end_date_does_not_crash() -> None:
    """Education with no end_date should not trigger a crash."""
    resume = _resume(
        education=[EducationItem(school="MIT", degree="B.S.", end_date=None)],
        experience=[_exp("Developer", "Jan 2021", "Jan 2024")],
    )
    result = infer_career_stage(resume)
    assert result in {"student", "early", "experienced"}


def test_mixed_valid_and_invalid_dates_does_not_crash() -> None:
    """Mix of good and garbage dates across multiple experience entries."""
    resume = _resume(
        experience=[
            ExperienceItem(company="A", title="Dev", start_date="Jan 2020", end_date="Jan 2022"),
            ExperienceItem(company="B", title="Eng", start_date="", end_date="abc"),
            ExperienceItem(company="C", title="Analyst", start_date="xyz", end_date=None),
        ]
    )
    result = infer_career_stage(resume)
    assert result in {"student", "early", "experienced"}
