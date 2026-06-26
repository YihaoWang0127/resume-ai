from __future__ import annotations

import json
from app.models.resume import ResumeSchema

PARSE_SYSTEM = """Extract resume data into JSON. Return only valid JSON matching the schema exactly. No markdown, no explanation."""

ENRICH_SYSTEM_BY_STAGE: dict[str, str] = {
    'student': """You are a professional resume writer specializing in early-career and student resumes.
Enhance the resume to highlight projects, internships, coursework, leadership, transferable skills, and academic achievements.
Show GPA and honors prominently if present.
Use strong action verbs. Write in a way that is honest and authentic.
CRITICAL: Do NOT invent or fabricate any numbers, percentages, dollar amounts, team sizes, or metrics the candidate cannot verify. If a metric isn't in the original, omit it.
Target: 1 page. Return the improved resume as a complete JSON object with the same structure as the input.""",

    'early': """You are a professional resume writer specializing in early-career professionals (1–4 years experience).
Enhance bullet points to be achievement-oriented using strong action verbs. Highlight genuine accomplishments and growth.
Include real metrics only where they are clearly present in the original — do not invent numbers.
Show expanding scope and impact. Target: 1 page.
Return the improved resume as a complete JSON object with the same structure as the input.""",

    'experienced': """You are a professional resume writer specializing in senior and experienced professionals.
Enhance bullet points to be results-first and quantified — use the STAR method (Situation, Task, Action, Result).
Emphasize leadership, scope, scale, team size, budget, and measurable business impact where present in the original.
Use strong achievement verbs. Lead with the most impressive outcomes. 2 pages OK for 10+ years.
Return the improved resume as a complete JSON object with the same structure as the input.""",
}

TAILOR_SYSTEM_BY_STAGE: dict[str, str] = {
    'student': """You are an expert resume writer tailoring a student or new-grad resume for a specific job posting.
Mirror keywords and terminology from the job description. Highlight the most relevant projects, coursework, and internships.
Adjust the summary to speak directly to this role.
CRITICAL: Do NOT invent or fabricate any numbers, percentages, or metrics. Only use information present in the original.
Return the tailored resume as a complete JSON object with the same structure as the input.""",

    'early': """You are an expert resume writer tailoring an early-career resume for a specific job posting.
Mirror keywords and terminology from the job description. Reorder bullets to lead with most relevant accomplishments.
Highlight transferable skills and genuine growth. Do not invent metrics not present in the original.
Return the tailored resume as a complete JSON object with the same structure as the input.""",

    'experienced': """You are an expert resume writer specializing in tailoring senior-level resumes for specific job postings.
Mirror keywords and terminology from the job description. Lead with quantified impact, leadership, and scope.
Reorder bullet points to lead with the most relevant accomplishments. Adjust the summary to speak directly to this role.
Return the tailored resume as a complete JSON object with the same structure as the input.""",
}


ATS_SCORE_SYSTEM = """You are an expert ATS (Applicant Tracking System) analyst and career coach.
Compare a candidate's resume against a job description to assess keyword and skill alignment.
Consider the resume's summary, experience bullets, skills, projects, and education as the candidate's full set of represented content.
Treat semantically equivalent or closely related terms as matches, not just exact string matches
(e.g. "JS" ~ "JavaScript", "led" ~ "managed a team", "REST APIs" ~ "RESTful services").
Focus on the most important keywords and skills from the job description — not every word.
Return ONLY valid JSON, no markdown fences, no explanation."""


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


def build_enrich_prompt(resume: ResumeSchema, tone: str = 'professional', career_stage: str = 'early') -> tuple[str, str]:
    """Returns (system_prompt, user_message) for enrich."""
    tone_instructions = {
        'professional': 'Use formal, polished language with strong action verbs. Balance detail with clarity.',
        'concise': 'Use punchy, direct language. Trim all filler words. Every bullet should be tight and impactful.',
        'assertive': 'Use bold, confident language. Lead with strong achievement verbs. Emphasize impact and leadership.',
    }
    tone_note = tone_instructions.get(tone, tone_instructions['professional'])

    system = ENRICH_SYSTEM_BY_STAGE.get(career_stage, ENRICH_SYSTEM_BY_STAGE['early'])
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Improve and enrich the following resume. Make bullet points more impactful, achievement-oriented, and quantified where possible.

Writing tone: {tone} — {tone_note}

CURRENT RESUME:
{resume_json}

Return ONLY the improved resume as valid JSON matching the exact same schema. No markdown fences, no explanation."""
    return system, user


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

    if job_description and job_description.strip():
        user = f"""Write a cover letter using:

CANDIDATE RESUME (JSON):
{resume_json}

JOB DESCRIPTION:
{job_description}

COMPANY: {company_name}
TONE: {tone}"""
    else:
        user = f"""Write a cover letter using:

CANDIDATE RESUME (JSON):
{resume_json}

COMPANY: {company_name}
TONE: {tone}

Generate a strong general cover letter for this company and role based entirely on the candidate's resume. Focus on strongest achievements and skills."""

    return system, user


def build_improve_cover_letter_prompt(
    text: str,
    selection: str | None,
    job_description: str | None,
    tone: str,
    resume_json: str | None,
) -> tuple[str, str]:
    system = "You are an expert cover letter editor. Improve text for clarity, impact, and the requested tone. Return only the improved text with no surrounding commentary or metadata."

    if selection and selection.strip():
        user = (
            f"Improve only this excerpt from a cover letter. Return ONLY the improved version of this excerpt"
            f" — same approximate length, same {tone} tone. No intro, no labels, no context. Just the improved text:"
            f"\n\n{selection}\n\n(Context — do not include in output)\nFull cover letter:\n{text[:600]}"
        )
    else:
        user = (
            f"Improve this cover letter for {tone} tone, clarity, and impact. Return ONLY the body paragraphs"
            f" — no date, no heading, no signature. Paragraphs separated by blank lines.\n\nCOVER LETTER:\n{text}"
        )

    if job_description and job_description.strip():
        user += f"\n\nJOB DESCRIPTION (tailor the improvement to this role):\n{job_description[:1500]}"

    if resume_json:
        user += f"\n\nCANDIDATE RESUME (use for context only):\n{resume_json[:1200]}"

    return system, user


def build_tailor_prompt(resume: ResumeSchema, job_description: str, career_stage: str = 'early') -> tuple[str, str]:
    """Returns (system_prompt, user_message) for tailor."""
    system = TAILOR_SYSTEM_BY_STAGE.get(career_stage, TAILOR_SYSTEM_BY_STAGE['early'])
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Tailor the following resume for the job description below. Optimize for ATS keyword matching and relevance.

JOB DESCRIPTION:
{job_description}

CURRENT RESUME:
{resume_json}

Return ONLY the tailored resume as valid JSON matching the exact same schema. No markdown fences, no explanation."""
    return system, user


VALIDATE_JD_SYSTEM = """You are a text classifier. Determine if the provided text is a real job description or job posting.

A job description typically contains: a job title, responsibilities, requirements, qualifications, salary/benefits, or other professional hiring content.

It is NOT a job description if it:
- Is random characters, numbers, or symbols only
- Is a personal bio, essay, or story
- Is a product/service description unrelated to hiring
- Is a resume or CV
- Is lorem ipsum or test/dummy text
- Is fewer than 20 meaningful words

Return ONLY valid JSON with no markdown fences:
{"valid": true, "reason": "brief reason in one sentence"}"""


VALIDATE_ROLE_SYSTEM = """You are a text classifier. Determine if the provided text is a real job title or role name.

A job title is valid if it is a recognizable professional role, e.g. "Software Engineer", "Product Manager", "Data Scientist", "Marketing Director", "UX Designer", "Sales Representative", "Nurse Practitioner", "Financial Analyst", etc.

It is NOT a valid job title if it:
- Is random characters, numbers, or symbols only
- Is a full sentence or paragraph (not just a title)
- Is a company name, not a role
- Is lorem ipsum or test/dummy text
- Is fewer than 2 meaningful words that don't form a recognizable role

Return ONLY valid JSON with no markdown fences:
{"valid": true, "reason": "brief reason in one sentence"}"""


def build_validate_role_prompt(text: str) -> tuple[str, str]:
    user = f"""Is this a job title or role name?

TEXT:
{text[:500]}"""
    return VALIDATE_ROLE_SYSTEM, user


def build_validate_jd_prompt(text: str) -> tuple[str, str]:
    user = f"""Is this a job description?

TEXT:
{text[:3000]}"""
    return VALIDATE_JD_SYSTEM, user


def build_ats_score_prompt(resume: ResumeSchema, job_description: str) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for ATS keyword scoring."""
    resume_json = resume.model_dump_json(indent=2)
    user = f"""Compare the resume's content (summary, experience bullets, skills, projects, and education) against the job description below.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME (JSON):
{resume_json}

Return ONLY valid JSON (no markdown fences, no explanation) matching exactly:
{{
  "overall_score": <integer 0-100, the percentage of important job-description keywords/skills represented in the resume>,
  "matched_keywords": [<important keywords/skills from the job description that ARE present in the resume>],
  "missing_keywords": [<important keywords/skills from the job description that are NOT present in the resume>],
  "suggestions": [<3-6 concrete, actionable suggestions for incorporating missing keywords or strengthening the match, referencing the candidate's actual experience where possible>],
  "summary": "<1-2 sentence plain-language summary of the match quality>"
}}"""
    return ATS_SCORE_SYSTEM, user
