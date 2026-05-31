# ResumeAI — AI-Powered Resume Generator & Optimizer

> Upload your resume. Claude enriches it, tailors it to any job, and exports it in seconds.

🌐 **Live Demo:** [resume-ai-helper.vercel.app](https://resume-ai-helper.vercel.app)  
🔧 **API:** [resume-ai-helper-jrqf.onrender.com](https://resume-ai-helper-jrqf.onrender.com)  
📦 **GitHub:** [github.com/YihaoWang0127/resume-ai](https://github.com/YihaoWang0127/resume-ai)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Data Schema](#data-schema)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Claude Prompt Strategy](#claude-prompt-strategy)
- [Conclusion](#conclusion)

---

## Overview

ResumeAI is a full-stack monorepo web application that helps job seekers — new graduates and experienced professionals — generate, enrich, and tailor their resumes using Anthropic's Claude AI.

The core value proposition:

```
1. Upload your resume (PDF or DOCX)           ~28 seconds
2. Claude parses and structures it             automatic
3. AI enriches every bullet point             ~20 seconds
4. Paste a job description to tailor it       ~25 seconds
5. Download as PDF or DOCX                    instant

Total: Under 2 minutes to a job-ready, tailored resume
```

---

## Features

| Feature | Description |
|---|---|
| **Resume Upload** | Drag & drop PDF or DOCX (up to 10MB) |
| **AI Parse** | Claude extracts and structures all resume sections |
| **AI Enrichment** | Rewrites bullets to be action-verb led and impact-focused |
| **JD Tailoring** | Paste a job description — Claude rewrites resume to match ATS keywords |
| **Industry Detection** | Claude auto-detects your industry (Tech, Finance, Creative, Healthcare, General) |
| **Live Preview** | Real-time resume preview with 5 style presets |
| **Style Switcher** | Switch between industry-specific typography and accent colors |
| **Streaming Output** | Token-by-token AI output with resizable panel and progress hints |
| **Export PDF** | ReportLab-generated PDF with industry-matched styling |
| **Export DOCX** | python-docx Word document export |
| **Native Save As** | Browser File System Access API for choosing save location |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                             │
│                   React + Vite (TypeScript)                     │
│              https://resume-ai-helper.vercel.app                │
└─────────────────────┬───────────────────────────────────────────┘
                      │  REST API (JSON + Streaming SSE)
                      │  CORS: allow Vercel origin
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                            │
│                    Python 3.11 + Uvicorn                        │
│           https://resume-ai-helper-jrqf.onrender.com           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ POST /parse  │  │POST /enrich  │  │   POST /tailor       │  │
│  │ pdfplumber   │  │  Streaming   │  │   Streaming          │  │
│  │ python-docx  │  │  Claude API  │  │   Claude API         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   POST /export                           │   │
│  │         ReportLab (PDF) + python-docx (DOCX)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │  HTTPS API calls
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Anthropic Claude API                          │
│  Parse:   claude-haiku-4-5   (fast, cheap, structured extract) │
│  Enrich:  claude-sonnet-4-6  (high quality rewriting)          │
│  Tailor:  claude-sonnet-4-6  (high quality ATS optimization)   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Two Claude models** | Haiku for parse (5x faster, ~$0.001), Sonnet for enrich/tailor (better quality) |
| **Streaming responses** | Native `fetch` + `ReadableStream` on frontend — Axios doesn't support browser streaming |
| **ReportLab over WeasyPrint** | Pure Python PDF generation — no system dependencies (pango, cairo) needed on Render |
| **Monorepo** | Single GitHub repo with `frontend/` and `backend/` — easier to manage for solo dev |
| **No database** | MVP scope — resume state lives in React `useState`, no persistence needed yet |
| **Industry detection in parse** | Zero extra API cost — adds one field to the existing parse prompt |

---

## Tech Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18 |
| Build Tool | Vite | 8 |
| Language | TypeScript | 5 (strict) |
| Styling | Tailwind CSS | 3 |
| Components | shadcn/ui + Radix | latest |
| HTTP Client | Axios | latest |
| Streaming | Native Fetch + ReadableStream | — |
| Forms | React Hook Form + Zod | latest |
| Routing | React Router DOM | latest |
| Icons | Lucide React | latest |

### Backend

| Layer | Technology | Version |
|---|---|---|
| Framework | FastAPI | 0.115.6 |
| Language | Python | 3.11 |
| ASGI Server | Uvicorn | 0.32.1 |
| AI SDK | anthropic | 0.43.0 |
| Validation | Pydantic v2 | 2.10.4 |
| PDF Parsing | pdfplumber | 0.11.4 |
| DOCX Parsing | python-docx | 1.1.2 |
| PDF Export | ReportLab | 4.2.5 |
| DOCX Export | python-docx | 1.1.2 |
| Env Config | python-dotenv | 1.0.1 |

### Infrastructure

| Service | Platform | Purpose |
|---|---|---|
| Frontend Hosting | Vercel (free) | Auto-deploy from GitHub on push |
| Backend Hosting | Render (free tier) | Python web service, spins down on idle |
| Version Control | GitHub (public) | Source of truth |
| AI API | Anthropic | Claude Haiku + Sonnet |

---

## Project Structure

```
resume-ai/                              ← GitHub repo root
├── frontend/                           ← React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                     ← shadcn/ui primitives
│   │   │   ├── ResumeUploader.tsx      ← drag & drop file upload
│   │   │   ├── ResumeEditor.tsx        ← main editor (form + streaming panel)
│   │   │   ├── ResumePreview.tsx       ← live resume preview + style switcher
│   │   │   └── StreamingOutput.tsx     ← token-by-token AI output display
│   │   ├── pages/
│   │   │   ├── Home.tsx                ← landing page with upload CTA
│   │   │   └── Editor.tsx              ← full editor page
│   │   ├── services/
│   │   │   └── api.ts                  ← Axios + fetch API calls
│   │   ├── types/
│   │   │   └── resume.ts               ← TypeScript interfaces
│   │   └── App.tsx                     ← React Router routes
│   ├── .env.local                      ← VITE_API_URL (local)
│   └── package.json
│
├── backend/                            ← FastAPI app
│   ├── app/
│   │   ├── main.py                     ← FastAPI app, CORS config
│   │   ├── routes/
│   │   │   ├── parse.py                ← POST /api/parse
│   │   │   ├── enrich.py               ← POST /api/enrich (streaming)
│   │   │   ├── tailor.py               ← POST /api/tailor (streaming)
│   │   │   └── export.py               ← POST /api/export
│   │   ├── services/
│   │   │   ├── claude.py               ← Anthropic SDK wrapper (2 models)
│   │   │   ├── parser.py               ← PDF/DOCX text extraction
│   │   │   └── exporter.py             ← ReportLab PDF + python-docx DOCX
│   │   ├── models/
│   │   │   └── resume.py               ← Pydantic ResumeSchema
│   │   └── prompts/
│   │       └── resume.py               ← Claude prompt builders
│   ├── .env                            ← ANTHROPIC_API_KEY (never commit)
│   ├── .python-version                 ← pins Python 3.11.9 for Render
│   └── requirements.txt
│
├── render.yaml                         ← Render deploy config
├── .gitignore
└── README.md
```

---

## API Reference

### `POST /api/parse`
Parse a PDF or DOCX resume into structured JSON.

**Request:** `multipart/form-data`
```
file: <PDF or DOCX file, max 10MB>
```

**Response:** `ResumeSchema` JSON
```json
{
  "metadata": { "name": "...", "email": "...", ... },
  "summary": "...",
  "experience": [...],
  "education": [...],
  "skills": [...],
  "projects": [...],
  "detected_industry": "tech"
}
```

---

### `POST /api/enrich`
Enrich resume with AI — returns streaming response.

**Request:**
```json
{
  "resume": <ResumeSchema>,
  "target_role": "Senior Software Engineer"
}
```

**Response:** `text/event-stream` — streams enriched `ResumeSchema` JSON token by token.

---

### `POST /api/tailor`
Tailor resume to a job description — returns streaming response.

**Request:**
```json
{
  "resume": <ResumeSchema>,
  "job_description": "..."
}
```

**Response:** `text/event-stream` — streams tailored `ResumeSchema` JSON token by token.

---

### `POST /api/export`
Export resume as PDF or DOCX.

**Request:**
```json
{
  "resume": <ResumeSchema>,
  "format": "pdf",
  "industry": "tech"
}
```

**Response:** Binary file (`application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)

---

### `GET /health`
Health check endpoint.

**Response:**
```json
{ "status": "ok" }
```

---

## Data Schema

```python
class Metadata(BaseModel):
    name: str
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    linkedin: Optional[str]
    github: Optional[str]
    website: Optional[str]

class ExperienceItem(BaseModel):
    company: str
    title: str
    location: Optional[str]
    start_date: str
    end_date: Optional[str]
    bullets: List[str]

class EducationItem(BaseModel):
    school: str
    degree: str
    field: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    gpa: Optional[str]
    honors: Optional[str]

class SkillCategory(BaseModel):
    category: str
    items: List[str]

class ProjectItem(BaseModel):
    name: str
    description: Optional[str]
    technologies: List[str]
    url: Optional[str]
    bullets: List[str]

class ResumeSchema(BaseModel):
    metadata: Metadata
    summary: Optional[str]
    experience: List[ExperienceItem]
    education: List[EducationItem]
    skills: List[SkillCategory]
    projects: List[ProjectItem]
    detected_industry: Optional[str] = "general"
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | v20+ |
| Python | 3.11+ |
| Git | any |

### Clone & Setup

```bash
# Clone the repo
git clone https://github.com/YihaoWang0127/resume-ai.git
cd resume-ai
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate       # Mac/Linux
venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Add your API key
cp .env.example .env
# Edit .env → ANTHROPIC_API_KEY=sk-ant-api03-...

# Start the server
uvicorn app.main:app --reload --port 8000
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set API URL
echo "VITE_API_URL=http://localhost:8000" > .env.local

# Start dev server
npm run dev
# App running at http://localhost:5173
```

---

## Testing

### How to Run Tests

**Backend:**
```bash
cd backend
source venv/bin/activate
pytest -v
# or
make test
```

**Frontend:**
```bash
cd frontend
npm test              # watch mode
npm run test:coverage  # with coverage report
```

### How to Add Tests for New Features

When you add a new feature, follow this pattern:

```
New feature: Cover Letter Generation
        ↓
Backend: add tests/test_coverletter.py
  - test_generate_returns_stream
  - test_generate_missing_resume → 422
  - test_generate_prompt_contains_jd

Frontend: add src/__tests__/CoverLetter.test.tsx
  - test_renders_modal
  - test_submit_triggers_stream
  - test_apply_updates_state
```

---

## Deployment

### Backend → Render

1. Create account at [render.com](https://render.com)
2. New Web Service → connect GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Python Version:** `3.11.9` (via `.python-version` file)
4. Add environment variable: `ANTHROPIC_API_KEY`
5. Deploy

### Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Or connect GitHub repo at [vercel.com](https://vercel.com) for auto-deploy.

Add environment variable in Vercel dashboard:
```
VITE_API_URL = https://your-render-url.onrender.com
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key from console.anthropic.com | ✅ |

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | ✅ |

---

## Claude Prompt Strategy

### Parse Prompt (`claude-haiku-4-5`)
Extracts structured JSON from raw resume text. Uses a compact schema description to minimize tokens and maximize speed. Also detects `detected_industry` from job titles and keywords.

### Enrich Prompt (`claude-sonnet-4-6`)
Rewrites resume bullets using these rules:
- Start every bullet with a strong past-tense action verb
- Include measurable impact where data exists
- Never fabricate metrics — only enhance existing ones
- Keep bullets under 20 words
- Preserve the candidate's actual experience and voice

### Tailor Prompt (`claude-sonnet-4-6`)
Rewrites resume to match a job description:
- Mirror keywords and terminology from the JD
- Highlight the most relevant experience and skills
- Reorder bullets to lead with the most relevant accomplishments
- Adjust the summary to speak directly to the role
- Never add experience the candidate doesn't have

---

## Cost Estimates

| Action | Model | Approx Cost |
|---|---|---|
| Parse resume | Haiku | ~$0.001 |
| Enrich resume | Sonnet | ~$0.01 |
| Tailor to JD | Sonnet | ~$0.015 |
| Full session | — | ~$0.03 |

---

## Roadmap

- [ ] User authentication + resume persistence (Supabase)
- [ ] Multiple resume versions per user
- [ ] Cover letter generation
- [ ] ATS keyword scoring (before/after comparison)
- [ ] More export templates
- [ ] LinkedIn profile optimization
- [ ] Stripe monetization (free tier + Pro)

---

## Built With

- [Anthropic Claude API](https://anthropic.com) — AI backbone
- [FastAPI](https://fastapi.tiangolo.com) — Python web framework
- [React](https://react.dev) — Frontend framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [ReportLab](https://www.reportlab.com) — PDF generation
- [Vercel](https://vercel.com) — Frontend hosting
- [Render](https://render.com) — Backend hosting

---

---

## Conclusion

ResumeAI demonstrates how a small, focused AI application can deliver genuine value quickly. By combining Claude's language understanding with a clean full-stack architecture, the project reduces what used to be hours of manual resume tailoring to under two minutes.

Several technical decisions shaped the final result:

- **Two-model strategy** — using Haiku for fast structured extraction and Sonnet for high-quality rewriting keeps costs low without sacrificing output quality where it matters most.
- **Streaming-first UX** — surfacing token-by-token AI output with cycling progress hints makes the wait feel active rather than opaque, which meaningfully reduces perceived latency.
- **Pure-Python PDF generation** — switching from WeasyPrint (which requires system-level Pango/Cairo) to ReportLab eliminated the biggest production deployment blocker and made the service fully portable.
- **Industry-aware styling** — detecting the candidate's industry at parse time and applying matching typography and accent colors to both the live preview and exported files adds polish with zero extra API calls.
- **No database (intentionally)** — keeping resume state in React `useState` removed an entire infrastructure layer for the MVP, letting the project ship faster without sacrificing the core user experience.

The test suite (42 backend + 39 frontend, all passing) covers the full request lifecycle — from file upload and Claude mocking through streaming response validation and export format enforcement — giving a solid foundation for continued development.

**What's next:** authentication and resume persistence are the natural next step, followed by ATS keyword scoring and cover letter generation. The architecture is designed to support these additions incrementally without requiring a rewrite.

---

*Built with Claude Code + Claude API*
