from __future__ import annotations

import json
from app.models.resume import ResumeSchema


PARSE_SYSTEM = """You are an expert resume parser. Extract structured data from raw resume text and return it as valid JSON.
Always return a complete JSON object matching the schema exactly. If a field is not present, use null or an empty list as appropriate."""

ENRICH_SYSTEM = """You are a professional resume writer and career coach. Your task is to enhance and improve the provided resume.
Improve bullet points to be achievement-oriented using the STAR method (Situation, Task, Action, Result).
Quantify achievements where possible. Use strong action verbs. Remove weak or vague language.
Return the improved resume as a complete JSON object with the same structure as the input."""

TAILOR_SYSTEM = """You are an expert resume writer specializing in tailoring resumes for specific job postings.
Analyze the job description and strategically rewrite the resume to:
- Mirror keywords and terminology from the job description
- Highlight the most relevant experience and skills
- Reorder bullet points to lead with the most relevant accomplishments
- Adjust the summary to speak directly to this role
Return the tailored resume as a complete JSON object with the same structure as the input."""


RESUME_JSON_SCHEMA = """{
  "metadata": {
    "name": "string",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "website": "string or null"
  },
  "summary": "string or null",
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "start_date": "string (e.g. Jan 2022)",
      "end_date": "string or null (null means Present)",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string",
      "field": "string or null",
      "start_date": "string or null",
      "end_date": "string or null",
      "gpa": "string or null",
      "honors": "string or null"
    }
  ],
  "skills": [
    {
      "category": "string",
      "items": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string or null",
      "technologies": ["string"],
      "url": "string or null",
      "bullets": ["string"]
    }
  ]
}"""


def build_parse_prompt(raw_text: str) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for parse."""
    user = f"""Parse the following resume text into a structured JSON object.

REQUIRED JSON SCHEMA:
{RESUME_JSON_SCHEMA}

RESUME TEXT:
{raw_text}

Return ONLY valid JSON with no markdown fences, no explanation, and no extra text."""
    return PARSE_SYSTEM, user


def build_enrich_prompt(resume: ResumeSchema) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for enrich."""
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Improve and enrich the following resume. Make bullet points more impactful, achievement-oriented, and quantified where possible.

CURRENT RESUME:
{resume_json}

Return ONLY the improved resume as valid JSON matching the exact same schema. No markdown fences, no explanation."""
    return ENRICH_SYSTEM, user


def build_tailor_prompt(resume: ResumeSchema, job_description: str) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for tailor."""
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Tailor the following resume for the job description below. Optimize for ATS keyword matching and relevance.

JOB DESCRIPTION:
{job_description}

CURRENT RESUME:
{resume_json}

Return ONLY the tailored resume as valid JSON matching the exact same schema. No markdown fences, no explanation."""
    return TAILOR_SYSTEM, user
