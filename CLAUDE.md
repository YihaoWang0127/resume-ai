# Resume AI — Project Guide

## Project
AI-powered resume and cover letter generator. Users upload resumes,
Claude enriches/tailors them, generates cover letters, and exports
as PDF/DOCX/TXT. Supabase for auth and storage.

## Live URLs
- App: https://resume-ai-helper.vercel.app
- API: https://resume-ai-helper-jrqf.onrender.com
- DB: Supabase (resume-ai-helper project)

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI + Python 3.11 + Anthropic SDK
- Database: Supabase (PostgreSQL + Auth)
- PDF: ReportLab (not WeasyPrint)
- DOCX: python-docx
- Deploy: Vercel (frontend) + Render (backend)

## Claude Models
- Haiku 4.5: validation + parsing (fast, cheap)
- Sonnet 4.6: enrichment + tailoring + cover letters (quality)

## Theme
- Apple light/blue style
- Background: #FBFBFD
- Primary accent: #0071E3
- Font: Inter (headings + body)
- CSS variables defined in src/index.css

## Key Files
- Backend entry: backend/app/main.py
- Claude prompts: backend/app/prompts/resume.py
- Claude service: backend/app/services/claude.py
- Frontend routes: frontend/src/App.tsx
- Auth context: frontend/src/contexts/AuthContext.tsx
- Supabase client: frontend/src/lib/supabase.ts
- Resume CRUD: frontend/src/services/resumes.ts
- Cover letter CRUD: frontend/src/services/coverLetters.ts

## Database Tables
- resumes: id, user_id, title, resume_data (JSONB), detected_industry
- cover_letters: id, user_id, resume_id, title, content, company_name, job_description, tone
- Both have Row Level Security enabled

## Testing Rules
- Do NOT run npm test or pytest after each change
- Do NOT run full test suite unless explicitly asked
- Only verify with tsc --noEmit or npm run build
- Run full tests only when I say "run tests"

## Code Rules
- Keep responses concise to save session usage
- Do NOT scan entire project for simple changes
- Only read files that need to be edited
- Use CSS variable classes (bg-background, text-primary, etc.)
  not hardcoded hex colors
- Streaming uses native fetch (not axios) for browser support
- Frontend talks directly to Supabase for CRUD (not through FastAPI)
- Guest mode uses Supabase anonymous sessions

## API Routes
- POST /api/parse — upload + validate + parse resume
- POST /api/enrich — stream enriched resume
- POST /api/tailor — stream tailored resume
- POST /api/export — export resume PDF/DOCX
- POST /api/cover-letter — stream cover letter
- POST /api/cover-letter/export — export cover letter PDF/DOCX/TXT

## Conventions
- Commit messages: feat/fix/docs/test/chore prefix
- Frontend env: .env.local (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Backend env: .env (ANTHROPIC_API_KEY)
- Never commit .env files