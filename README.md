# ResumeAI — AI-Powered Resume & Cover Letter Generator

> Upload your resume. Claude enriches it, tailors it to any job, generates cover letters, saves it to your account, and exports it in seconds.

🌐 **Live:** [resume-ai-helper.vercel.app](https://resume-ai-helper.vercel.app)
📦 **GitHub:** [github.com/YihaoWang0127/resume-ai](https://github.com/YihaoWang0127/resume-ai)

---

## Features

### AI-Powered
- **Resume Validation** — Claude checks if uploaded file is a resume before processing
- **Resume Parsing** — extracts and structures all sections from PDF/DOCX
- **AI Enrichment** — rewrites bullets with action verbs and impact metrics (streaming)
- **JD Tailoring** — rewrites resume to match job description keywords (streaming)
- **Cover Letter Generator** — generates personalized cover letters with tone options
- **Industry Detection** — auto-detects Tech/Finance/Creative/Healthcare/General
- **Live Preview** — 5 style presets with real-time switching

### Auth & Storage
- **Email/Password Auth** — Supabase Auth with email verification
- **Guest Mode** — anonymous sessions, try before signing up
- **Auth Modal** — blurred-background overlay, auto-shows after 10s
- **Save Resumes** — unlimited versions per user
- **Save Cover Letters** — linked to source resume
- **Dashboard** — grid view with edit/export/delete for both

### Export
- **PDF Export** — ReportLab with industry-matched styling
- **DOCX Export** — Word document via python-docx
- **TXT Export** — plain text (cover letters)
- **Native Save As** — File System Access API for choosing location

### UI/UX
- **StockX Theme** — dark background + green accent (#00FF87)
- **File Preview** — confirm file before uploading
- **Cancel Upload** — abort in progress
- **Smart Errors** — amber warnings vs red errors
- **Progress Hints** — rotating messages during AI processing
- **Resizable Panels** — drag AI output panel to any size
- **Error Pages** — custom 404/500 with ErrorBoundary

---

## Architecture

```
User Browser (React + Vite + TypeScript)
    ├── Supabase Client → Auth + PostgreSQL (resumes + cover_letters)
    └── REST/Stream → FastAPI Backend → Anthropic Claude API

Models:
├── Haiku 4.5  → validation + parsing (fast, cheap)
└── Sonnet 4.6 → enrichment + tailoring + cover letters (quality)
```

---

## Tech Stack

**Frontend:** React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui · Supabase JS · React Router
**Backend:** FastAPI · Python 3.11 · Anthropic SDK · ReportLab · pdfplumber · python-docx
**Database:** Supabase PostgreSQL (resumes + cover_letters tables, RLS enabled)
**Auth:** Supabase Auth (email + anonymous)
**Infra:** Vercel (frontend) · Render (backend) · Supabase (auth + db)
**Testing:** 135+ tests (pytest + Vitest + React Testing Library + MSW)

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/parse | Upload PDF/DOCX → validated + parsed resume JSON |
| POST | /api/enrich | Stream-enriched resume |
| POST | /api/tailor | Stream-tailored resume to job description |
| POST | /api/export | Export resume as PDF or DOCX |
| POST | /api/cover-letter | Stream-generated cover letter |
| POST | /api/cover-letter/export | Export cover letter as PDF/DOCX/TXT |
| GET | /health | Health check |

Frontend uses Supabase JS directly for all CRUD operations (save/load/list/delete).

---

## Database

```sql
-- Resumes table
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  resume_data JSONB NOT NULL,
  detected_industry TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cover Letters table
CREATE TABLE cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  company_name TEXT,
  job_description TEXT,
  tone TEXT DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Both tables have Row Level Security enabled
-- Users can only access their own data
```

---

## Project Structure

```
resume-ai/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AuthModal.tsx          # auth overlay
│       │   ├── ErrorBoundary.tsx      # runtime error catch
│       │   ├── ResumeUploader.tsx     # drag & drop + preview
│       │   ├── ResumeEditor.tsx       # editor + save + cover letter modal
│       │   ├── ResumePreview.tsx      # live preview + style switcher
│       │   └── StreamingOutput.tsx    # AI streaming display
│       ├── contexts/AuthContext.tsx    # Supabase auth provider
│       ├── lib/supabase.ts            # Supabase client
│       ├── pages/
│       │   ├── Home.tsx               # landing page
│       │   ├── Editor.tsx             # resume editor
│       │   ├── Dashboard.tsx          # saved resumes + cover letters
│       │   ├── CoverLetterEditor.tsx  # cover letter editor
│       │   ├── NotFound.tsx           # 404
│       │   └── ServerError.tsx        # 500
│       ├── services/
│       │   ├── api.ts                 # FastAPI calls
│       │   ├── resumes.ts             # Supabase resume CRUD
│       │   └── coverLetters.ts        # Supabase cover letter CRUD
│       ├── types/
│       │   ├── resume.ts
│       │   └── coverLetter.ts
│       └── __tests__/                 # 94+ frontend tests
│
├── backend/
│   └── app/
│       ├── main.py
│       ├── routes/
│       │   ├── parse.py               # + Claude validation
│       │   ├── enrich.py
│       │   ├── tailor.py
│       │   ├── export.py              # resume + cover letter export
│       │   └── cover_letter.py        # cover letter generation
│       ├── services/
│       │   ├── claude.py              # Haiku + Sonnet + validate
│       │   ├── parser.py
│       │   └── exporter.py            # ReportLab + python-docx
│       ├── models/resume.py
│       └── prompts/resume.py          # all Claude prompts
│   └── tests/                         # 42+ backend tests
│
├── render.yaml
├── CLAUDE.md
└── README.md
```

---

## Local Setup

### Backend
```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# Create .env.local with:
#   VITE_API_URL=http://localhost:8000
#   VITE_SUPABASE_URL=your-supabase-url
#   VITE_SUPABASE_ANON_KEY=your-anon-key
npm run dev
```

### Supabase
1. Create project at supabase.com
2. Run database schema SQL in SQL Editor
3. Enable Email auth + Anonymous sign-ins
4. Add redirect URLs (localhost + production)

---

## Deployment

**Backend → Render:** Root `backend`, Python 3.11, env `ANTHROPIC_API_KEY`
**Frontend → Vercel:** Root `frontend`, env `VITE_API_URL` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

Every `git push` → auto-deploys both.

---

## Testing

```bash
cd backend && pytest -v        # 42+ backend tests
cd frontend && npm test        # 94+ frontend tests
```

---

## Cost per User Session

| Action | Model | Cost |
|---|---|---|
| Validate | Haiku | ~$0.0005 |
| Parse | Haiku | ~$0.001 |
| Enrich | Sonnet | ~$0.01 |
| Tailor | Sonnet | ~$0.015 |
| Cover Letter | Sonnet | ~$0.01 |
| **Full session** | | **~$0.04** |

---

## Roadmap

- [x] AI resume parse, enrich, tailor
- [x] AI cover letter generator
- [x] Claude resume validation
- [x] Industry style detection
- [x] PDF/DOCX/TXT export
- [x] Email auth + guest mode
- [x] Save to database (resumes + cover letters)
- [x] Dashboard with CRUD
- [x] Error pages (404/500)
- [x] 135+ automated tests
- [ ] Google OAuth sign-in
- [ ] ATS keyword scoring
- [ ] Mobile responsive editor
- [ ] Stripe monetization
- [ ] Resume version history

---

*Built with Claude Code + Claude API · Vibe coded in one weekend · Production ready 🚀*
