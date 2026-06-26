from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.resume import (
    EducationItem,
    ExperienceItem,
    Metadata,
    ProjectItem,
    ResumeSchema,
    SkillCategory,
)


def test_resume_schema_valid(sample_resume: dict) -> None:
    r = ResumeSchema.model_validate(sample_resume)
    assert r.metadata.name == "Jane Smith"
    assert r.metadata.email == "jane@example.com"
    assert len(r.experience) == 2
    assert len(r.education) == 1
    assert len(r.skills) == 2


def test_resume_schema_invalid_data() -> None:
    with pytest.raises(ValidationError):
        # bullets must be a list of strings, not a plain string
        ResumeSchema.model_validate(
            {"experience": [{"company": "X", "title": "Y", "start_date": "Jan 2020", "bullets": "not a list"}]}
        )


def test_resume_schema_empty_lists() -> None:
    r = ResumeSchema(
        metadata=Metadata(name="Minimal User", email="min@example.com"),
        experience=[],
        education=[],
        skills=[],
        projects=[],
    )
    assert r.experience == []
    assert r.skills == []
    assert r.projects == []


@pytest.mark.parametrize("industry, expected", [(None, "general"), ("tech", "tech")])
def test_resume_schema_detected_industry(industry: str | None, expected: str) -> None:
    r = ResumeSchema() if industry is None else ResumeSchema(detected_industry=industry)
    assert r.detected_industry == expected


def test_experience_item_present_when_no_end_date() -> None:
    exp = ExperienceItem(company="Corp", title="Dev", start_date="Jan 2022")
    assert exp.end_date is None
    assert exp.bullets == []


def test_education_item_optional_fields() -> None:
    edu = EducationItem(school="MIT", degree="B.S.")
    assert edu.field is None
    assert edu.gpa is None
    assert edu.honors is None


def test_skill_category_requires_category() -> None:
    with pytest.raises(ValidationError):
        SkillCategory(items=["Python"])  # category has no default


def test_project_item_defaults() -> None:
    proj = ProjectItem(name="My Project")
    assert proj.description is None
    assert proj.technologies == []
    assert proj.bullets == []


def test_metadata_all_optional_except_name() -> None:
    m = Metadata(name="Solo User")
    assert m.email is None
    assert m.phone is None
    assert m.location is None
