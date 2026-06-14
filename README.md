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
- **ATS Keyword Scoring** — paste a job description in the editor's "ATS Score" tab to get a 0-100 keyword-match score, matched/missing keyword chips, and AI suggestions for closing gaps; scores can also be run and tracked per-resume from the Dashboard's "ATS Score" tab
- **AI Usage Tracking** — every parse/enrich/tailor/cover-letter/ATS-score call is logged (`ai_usage_log`), surfaced on the new `/ai` page as total calls, calls this month, and a breakdown by action type

### Auth & Storage
- **Sign in with Google** — OAuth sign-in via Supabase (`signInWithOAuth`), available as a "Continue with Google" option in the auth modal alongside email/password and guest sign-in; failed redirects show a toast error and reopen the auth modal to retry
- **Email/Password Auth** — Supabase Auth with email verification; signup clearly errors if the email is already registered (instead of a false "check your email" message), and verification/resend emails link back to the correct app origin via `emailRedirectTo`
- **Unverified Session Guard** — non-anonymous sessions without a confirmed email are automatically signed out (on load and on auth state change) with a toast prompting the user to verify their email; guest/anonymous sessions are never affected
- **Email Verification Banner** — dismissible global banner prompts unverified users to confirm their email, with a "Resend email" action (60s cooldown)
- **Guest Mode** — anonymous sessions, try before signing up
- **Auth Modal** — blurred-background overlay, auto-shows after 10s
- **Save Resumes** — unlimited versions per user
- **Save Cover Letters** — linked to source resume
- **Dashboard** — stats bar (Resumes, Cover Letters, Avg ATS Score, AI Calls This Month) above a tabbed Resumes / Cover Letters / ATS Score view, each with grid view and edit/export/delete

### Export
- **PDF Export** — ReportLab with industry-matched styling
- **DOCX Export** — Word document via python-docx
- **TXT Export** — plain text (cover letters)
- **Native Save As** — File System Access API for choosing location

### UI/UX
- **Apple Light/Blue Theme** — `#FBFBFD` background, `#0071E3` accent, Inter font
- **Light / Dark / System Mode** — toggle in Settings, pre-paint script prevents flash-of-white on reload
- **File Preview** — confirm file before uploading
- **Cancel Upload** — abort in progress
- **Smart Errors** — amber warnings vs red errors
- **Progress Hints** — rotating messages during AI processing
- **Resizable Panels** — drag AI output panel to any size
- **Error Pages** — custom 404/500 with ErrorBoundary
- **Enrich with AI — Review & Compare** — clicking "Enrich with AI" shows a loading overlay (blurred preview + cycling status messages) on the live preview, then opens a side-by-side **Split View** or **Unified View** comparison of the original vs. AI-enriched resume with diff highlights, so you can **Accept** to apply the changes or **Discard** to keep the original

### Profile (`/profile`)
- **Account** — edit display name and upload an avatar (Supabase Storage `avatars` bucket); email is read-only, with a Verified / Not Verified status pill and resend-verification action
- **Personal Info** — phone, address, and current/target job title, persisted to a new `profiles` table
- **Work Experience** — repeatable company/title/dates/bullets entries, persisted to `profiles.experience` (JSONB); this data is intended to seed/generate a resume from scratch
- **Live Navbar Sync** — avatar and display name in the navbar update immediately after a profile edit

### AI (`/ai`)
- **AI Preferences** — tone, writing style, target industry, job level, and ATS mode, persisted to `user_preferences` and used to steer enrichment/tailoring/cover-letter prompts
- **Models** — read-only info card showing which Claude model powers parsing (Haiku 4.5) vs. enrichment/tailoring/cover letters/ATS scoring (Sonnet 4.6)
- **AI Usage** — total AI calls, calls this month, breakdown by action type, and recent activity, backed by `ai_usage_log`

### Settings & Personalization
- **Settings Page** (`/settings`) — sidebar with Appearance / Security / Notifications tabs; tabs stay mounted so edits persist while switching and unsaved changes prompt before leaving
- **Appearance** — Light / Dark / System theme via `next-themes`
- **Security** — change password (re-authenticates first) and permanently delete account + all data via a `DELETE`-to-confirm modal; on success the modal closes, a confirmation toast appears, and the user is redirected to the home page
- **Notifications** — toggles for "Export Complete" emails and "Product Updates" emails, persisted to `user_preferences`

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
**Testing:** 401+ tests (pytest + Vitest + React Testing Library + MSW)

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
| POST | /api/ats-score | Score resume against a job description (keyword match, gaps, suggestions) |
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
  ats_score INTEGER,
  ats_score_updated_at TIMESTAMPTZ,
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

-- User Preferences table (AI page → AI Preferences, Settings → Notifications)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('professional', 'conversational', 'executive')),
  writing_style TEXT NOT NULL DEFAULT 'concise'
    CHECK (writing_style IN ('concise', 'detailed', 'keyword-optimized')),
  industry TEXT NOT NULL DEFAULT '',
  job_level TEXT NOT NULL DEFAULT 'mid'
    CHECK (job_level IN ('junior', 'mid', 'senior', 'executive')),
  ats_mode BOOLEAN NOT NULL DEFAULT false,
  notify_export_complete BOOLEAN NOT NULL DEFAULT true,
  notify_product_updates BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own row

-- Profiles table (Profile page → Personal Info + Work Experience)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own row

-- AI Usage Log table (AI page → AI Usage)
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('parse', 'enrich', 'tailor', 'cover_letter', 'ats_score')),
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own rows
-- Indexed on (user_id, created_at DESC) for the AI Usage card
```

**Storage:** `avatars` bucket (public read, owner-only write/update/delete by `user_id` folder) for Profile → Account avatar uploads.

**RPC:** `delete_user_account()` — `SECURITY DEFINER` function called from Settings → Security → Delete Account. Cascades through `cover_letters`, `resumes`, `user_preferences`, `profiles`, and `ai_usage_log`, then removes the `auth.users` row.

See `supabase/migrations/20260611_user_preferences.sql` and
`supabase/migrations/20260613_profile_and_ai_usage.sql` for the full migrations.

---

## Project Structure

```
resume-ai/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AuthModal.tsx          # auth overlay
│       │   ├── ComparisonView.tsx     # Enrich review: split/unified diff view + accept/discard
│       │   ├── EmailVerificationBanner.tsx  # global unverified-email banner + resend
│       │   ├── ErrorBoundary.tsx      # runtime error catch
│       │   ├── Modal.tsx              # generic centered overlay (used by Settings)
│       │   ├── Navbar.tsx             # top nav — avatar/display name, user menu
│       │   ├── ResumeUploader.tsx     # drag & drop + preview
│       │   ├── ResumeEditor.tsx       # editor + save + cover letter modal
│       │   ├── ResumePreview.tsx      # live preview + style switcher + diff highlights
│       │   ├── StreamingOutput.tsx    # AI streaming display
│       │   └── settings/
│       │       ├── SettingsSidebar.tsx       # tab nav (mobile + desktop)
│       │       ├── AppearanceSettings.tsx    # Light/Dark/System theme
│       │       ├── SecuritySettings.tsx      # password change + delete account
│       │       └── NotificationSettings.tsx  # export-complete / product-update email toggles
│       ├── contexts/AuthContext.tsx    # Supabase auth provider
│       ├── lib/
│       │   ├── supabase.ts            # Supabase client
│       │   └── utils.ts               # cn(), getInitials()
│       ├── pages/
│       │   ├── Home.tsx               # landing page
│       │   ├── Editor.tsx             # resume editor
│       │   ├── Dashboard.tsx          # stats bar + Resumes/Cover Letters/ATS Score tabs
│       │   ├── Profile.tsx            # /profile — account, personal info, work experience
│       │   ├── AI.tsx                 # /ai — AI preferences, models info, AI usage
│       │   ├── CoverLetterEditor.tsx  # cover letter editor
│       │   ├── Settings.tsx           # /settings — appearance/security/notifications
│       │   ├── NotFound.tsx           # 404
│       │   └── ServerError.tsx        # 500
│       ├── services/
│       │   ├── api.ts                 # FastAPI calls + AI usage logging
│       │   ├── resumes.ts             # Supabase resume CRUD + ATS score updates
│       │   ├── coverLetters.ts        # Supabase cover letter CRUD
│       │   ├── preferences.ts         # Supabase user_preferences CRUD
│       │   ├── profile.ts             # Supabase profiles CRUD
│       │   └── aiUsage.ts             # Supabase ai_usage_log CRUD + stats
│       ├── types/
│       │   ├── resume.ts
│       │   ├── coverLetter.ts
│       │   ├── preferences.ts
│       │   ├── profile.ts
│       │   └── aiUsage.ts
│       └── __tests__/                 # 339 frontend tests (25 files)
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
│   └── tests/                         # 62 backend tests
│
├── supabase/
│   └── migrations/                    # SQL migrations (user_preferences, profiles, ai_usage_log, ATS score columns)
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
cd backend && pytest -v        # 62 backend tests
cd frontend && npm test         # 339 frontend tests (25 files)
```

**CI:** `.github/workflows/ci.yml` runs on every pull request to `main` with
two required checks — `frontend` (`tsc --noEmit`, `npm test`, `npm run build`)
and `backend` (`pytest -v`) — matching branch protection on `main`.

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
- [x] User settings — appearance, security, notifications
- [x] Dark mode (Light/Dark/System) with no-flash reload
- [x] 400+ automated tests
- [x] Google OAuth sign-in
- [x] ATS keyword scoring + Dashboard ATS Score tracking
- [x] Profile page — personal info & work experience capture
- [x] AI usage tracking and model transparency (`/ai` page)
- [ ] Mobile responsive editor
- [ ] Stripe monetization
- [ ] Resume version history
- [ ] Generate resume from scratch using Profile work experience

---

*Built with Claude Code + Claude API · Vibe coded in one weekend · Production ready 🚀*
