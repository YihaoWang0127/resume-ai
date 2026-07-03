from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class Metadata(BaseModel):
    name: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None


class ExperienceItem(BaseModel):
    company: str = ""
    title: str = ""
    location: Optional[str] = None
    start_date: str = ""
    end_date: Optional[str] = None  # None means "Present"
    description: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    school: str = ""
    degree: str = ""
    field: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None
    honors: Optional[str] = None


class SkillCategory(BaseModel):
    category: str
    items: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str = ""
    description: Optional[str] = None
    technologies: list[str] = Field(default_factory=list)
    url: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)


class ResumeSchema(BaseModel):
    metadata: Metadata = Field(default_factory=Metadata)
    summary: Optional[str] = None
    experience: list[ExperienceItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    skills: list[SkillCategory] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    detected_industry: Optional[str] = "general"


class TailorRequest(BaseModel):
    resume: ResumeSchema
    job_description: str
    career_stage: Optional[Literal['student', 'early', 'experienced']] = None


class EnrichRequest(BaseModel):
    resume: ResumeSchema
    tone: Optional[Literal['professional', 'concise', 'assertive']] = 'professional'
    career_stage: Optional[Literal['student', 'early', 'experienced']] = None


class ATSScoreRequest(BaseModel):
    resume: ResumeSchema
    job_description: str


class ATSScoreResponse(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    summary: str = ""


class ValidateJdRequest(BaseModel):
    text: str


class ValidateJdResponse(BaseModel):
    valid: bool
    reason: str = ""
