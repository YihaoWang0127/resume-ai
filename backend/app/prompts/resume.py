from __future__ import annotations

import json
from app.models.resume import ResumeSchema

PARSE_SYSTEM = """Extract resume data into JSON. Return only valid JSON matching the schema exactly. No markdown, no explanation."""

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
  ],
  "detected_industry": "one of: tech | finance | creative | healthcare | general"
}"""


def build_validation_prompt(text: str) -> tuple[str, str]:
    system = """You are a document classifier.
    Analyze the document and determine if it is a resume or CV.
    Always respond with valid JSON only, no explanation."""
    user = f"""Is this document a resume or CV?

Reply with ONLY this JSON, nothing else:
{{"is_resume": true or false, "reason": "one sentence"}}

Document (first 2000 characters):
{text[:2000]}"""
    return system, user


def build_parse_prompt(raw_text: str) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for parse."""
    user = f"""Extract this resume into JSON. Return ONLY valid JSON, no markdown, no explanation.

Fields: metadata(name,email,phone,location,linkedin,github,website), summary, experience(company,title,location,start_date,end_date,bullets[]), education(school,degree,field,start_date,end_date,gpa,honors), skills(category,items[]), projects(name,description,technologies[],url,bullets[]), detected_industry

Use null for missing fields, empty list [] for missing arrays.
For detected_industry: infer the industry from job titles, employers, skills, and keywords. Return exactly one of: tech | finance | creative | healthcare | general

RESUME:
{raw_text}"""
    return PARSE_SYSTEM, user


def build_enrich_prompt(resume: ResumeSchema) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for enrich."""
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Improve and enrich the following resume. Make bullet points more impactful, achievement-oriented, and quantified where possible.

CURRENT RESUME:
{resume_json}

Return ONLY the improved resume as valid JSON matching the exact same schema. No markdown fences, no explanation."""
    return ENRICH_SYSTEM, user


def build_cover_letter_prompt(
    resume_json: str,
    job_description: str,
    company_name: str,
    tone: str = "professional",
) -> tuple[str, str]:
    system = """You are an expert career coach who writes compelling cover letters. Write a personalized cover letter that:
- Opens with a strong, attention-grabbing hook
- Highlights 2-3 most relevant achievements from the resume
- Shows genuine interest in the company and role
- Mirrors keywords from the job description naturally
- Has a clear call to action at the end
- Is concise: 250-400 words, 3-4 paragraphs
- Matches the requested tone exactly

Tone guidelines:
- professional: formal, polished, traditional business tone
- enthusiastic: energetic, passionate, excited about the role
- concise: punchy, direct, no fluff, gets to the point fast

Return ONLY the cover letter body text. No "Dear Hiring Manager", no signature, no markdown. Just the body paragraphs separated by blank lines."""

    user = f"""Write a cover letter using:

CANDIDATE RESUME (JSON):
{resume_json}

JOB DESCRIPTION:
{job_description}

COMPANY: {company_name}
TONE: {tone}"""

    return system, user


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
