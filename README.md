# ResumeAI — AI-Powered Resume & Cover Letter Generator

> Upload your resume. Claude enriches it, tailors it to any job, generates cover letters, saves it to your account, and exports it in seconds.

🌐 **Live:** [resume-ai-helper.vercel.app](https://resume-ai-helper.vercel.app)
📦 **GitHub:** [github.com/YihaoWang0127/resume-ai](https://github.com/YihaoWang0127/resume-ai)

---

## Features

### AI-Powered
- **Resume Validation** — Claude checks if uploaded file is a resume before processing
- **Resume Parsing** — extracts and structures all sections from PDF/DOCX
- **AI Enrichment** — rewrites bullets with action verbs and impact metrics (streaming); choose Professional, Concise, or Assertive tone before generating
- **Target Role Tailoring** — rewrites resume to match job description keywords (streaming); validates job description input before processing
- **Cover Letter Generator** — generates cover letters inline in the Resume Editor's right panel; opens full editor via "Open in Full Editor"; includes AI Improve button for refinement
- **Industry Detection** — auto-detects Tech/Finance/Creative/Healthcare/General
- **Live Preview** — 5 style presets with real-time switching
- **ATS Keyword Scoring** — 0-100 keyword-match score with matched/missing chips and AI suggestions; validates job description input; dismissible results panel; tracked per-resume on the Dashboard
- **AI Usage Tracking** — every AI call logged server-side to `ai_usage_log` (backend writes using the user's JWT); surfaced on `/ai` as total calls, monthly count, and action breakdown
- **Monthly Quota Enforcement** — free tier capped at 30 AI calls/month; AI routes return HTTP 402 when the limit is reached; a "Monthly Limit Reached" modal surfaces in the UI instead of a generic error
- **Career Stage Persona Split** — Career Stage selector (Student / Early Career / Experienced) in the AI Enhance step; default is auto-detected from the resume content; enrichment and tailoring prompts are persona-aware based on the selected stage
- **One Click Package Generation** — “One Click Package” button in the Dashboard navbar (registered users only) launches a two-step wizard: enter Company Name, Position/Role + Job Description (Position and JD both AI-validated in real time via `/api/validate-role` and `/api/validate-jd`) → select a saved resume or upload a new one → streams a tailored resume, cover letter, and ATS score in parallel with live progress bars; results appear in a full-screen view with Resume/Cover Letter tabs on the left and a persistent ATS sidebar on the right; Export Resume (PDF), Export CV (PDF), or Save Application Package (saves tailored resume + cover letter to Supabase)

### Auth & Storage
- **Sign in with Google** — OAuth via Supabase; failed redirects show a toast and reopen the auth modal
- **Email/Password Auth** — Supabase Auth with email verification; duplicate-email signup surfaces a clear error
- **Unverified Session Guard** — sessions without a confirmed email are auto-signed out with a verification prompt
- **Email Verification Banner** — dismissible global banner with a "Resend email" action (60s cooldown)
- **Guest Mode** — anonymous sessions, try before signing up
- **Auth Modal** — blurred-background overlay, auto-shows after 10s
- **Save Resumes** — unlimited versions per user
- **Save Cover Letters** — linked to source resume
- **Dashboard** — stats bar + Resumes / Cover Letters / ATS Score sections with grid cards, edit, export, and delete; “One Click Package” button in the navbar for registered users

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
- **Enrich with AI — Review & Compare** — loading overlay with progress bar, then split/unified diff view; accept or discard changes; cancel stream mid-flight
- **Persistent Account Sidebar** — route-aware sidebar for Dashboard, Profile, AI, and Settings; collapses to a horizontal tab bar on mobile
- **Navbar Desktop Links** — center nav with interactive dropdown panels for Features, How It Works, Pricing, Examples, and Blog
- **Three-State Navbar Auth Area** — unauthenticated shows "Get Started Free"; guest shows avatar dropdown with Sign In; signed-in shows full avatar with display name
- **Landing Page Hero Redesign** — two-column hero with badge, headline, feature checklist, and auth-aware CTAs; resume mock card on the right; trust bar below
- **Resume Editor Redesign** — 3-column layout with 4-step stepper, icon-based section nav, rich-text form, live preview panel, and collapse toggle
- **Mobile Editor** — responsive AI tool selector and document tabs on small screens in the editor's AI Enhance and Review & Export steps; Edit/Preview toggle hidden during export step where it has no effect

### Profile (`/profile`)
- **Account** — edit display name and upload an avatar; email is read-only with a Verified/Not Verified pill and resend action
- **Personal Info** — phone, address, and current/target job title, persisted to `profiles`
- **Work Experience** — repeatable entries (company/title/dates/bullets) saved to `profiles.experience` (JSONB) to seed future resume generation
- **Live Navbar Sync** — avatar and display name update immediately after a profile edit

### AI (`/ai`)
- **AI Preferences** — tone, writing style, industry, job level, and ATS mode persisted to `user_preferences` and applied to all AI prompts
- **Models** — read-only info card showing which Claude model powers parsing (Haiku 4.5) vs. enrichment/tailoring/cover letters/ATS scoring (Sonnet 4.6)
- **AI Usage** — total AI calls, calls this month, breakdown by action type, and recent activity, backed by `ai_usage_log`

### Settings & Personalization
- **Settings Page** (`/settings`) — Change Password, Appearance, Notifications, and Danger Zone on a single page; unsaved changes prompt before leaving
- **Change Password** — re-authenticates first, then updates the account password
- **Appearance** — Light / Dark / System theme toggle
- **Notifications** — email toggles for "Export Complete" and "Product Updates", persisted to `user_preferences`
- **Danger Zone** — permanently delete account and all data via a type-to-confirm modal

---

## Architecture

```
User Browser (React + Vite + TypeScript)
    ├── Supabase Client → Auth + PostgreSQL (resumes + cover_letters)
    └── REST/Stream (+ Supabase JWT) → FastAPI Backend → Anthropic Claude API

Models:
├── Haiku 4.5  → validation + parsing (fast, cheap)
└── Sonnet 4.6 → enrichment + tailoring + cover letters (quality)

Security: AI routes are JWT-secured (PyJWT ES256 + Supabase JWKS); rate-limited via slowapi;
          server-side quota enforcement returns HTTP 402 when the free tier limit is reached.
```

---

## Tech Stack

**Frontend:** React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui · Supabase JS · React Router
**Backend:** FastAPI · Python 3.11 · Anthropic SDK · ReportLab · pdfplumber · python-docx
**Database:** Supabase PostgreSQL (resumes + cover_letters tables, RLS enabled)
**Auth:** Supabase Auth (email + anonymous)
**Infra:** Vercel (frontend) · Render (backend) · Supabase (auth + db)
**Testing:** 420+ tests (pytest + Vitest + React Testing Library + MSW)

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/parse | Upload PDF/DOCX → validated + parsed resume JSON |
| POST | /api/enrich | Stream-enriched resume; optional `tone` field: `'professional'` (default) \| `'concise'` \| `'assertive'`; optional `career_stage` field: `'student'` \| `'early'` \| `'experienced'` \| `null` (auto-detect) |
| POST | /api/tailor | Stream-tailored resume to job description; optional `career_stage` field: `'student'` \| `'early'` \| `'experienced'` \| `null` (auto-detect) |
| POST | /api/export | Export resume as PDF or DOCX |
| POST | /api/cover-letter | Stream-generated cover letter |
| POST | /api/cover-letter/export | Export cover letter as PDF/DOCX/TXT |
| POST | /api/ats-score | Score resume against a job description (keyword match, gaps, suggestions) |
| POST | /api/validate-jd | Validate that input text is a real job description; returns `{ valid, reason }` |
| POST | /api/validate-role | Validate that input text is a real position/role name; returns `{ valid, reason }` |
| GET | /health | Health check |

AI routes (`/api/parse`, `/api/enrich`, `/api/tailor`, `/api/cover-letter`, `/api/cover-letter/improve`, `/api/ats-score`) return HTTP 402 with `{"detail": "Monthly AI limit of 30 calls reached. Upgrade to continue."}` when a user's free quota is exhausted.

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
  career_stage TEXT CHECK (career_stage IN ('student', 'early', 'experienced')),
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
│       │   ├── AccountSidebar.tsx     # persistent left nav for Dashboard/Profile/AI/Settings
│       │   ├── AuthModal.tsx          # auth overlay
│       │   ├── ComparisonView.tsx     # Enrich review: split/unified diff view + accept/discard
│       │   ├── EmailVerificationBanner.tsx  # global unverified-email banner + resend
│       │   ├── ErrorBoundary.tsx      # runtime error catch
│       │   ├── Modal.tsx              # generic centered overlay
│       │   ├── Navbar.tsx             # top nav — avatar/display name, user menu
│       │   ├── PackageWizard.tsx      # One Click Package Generation multi-step wizard
│       │   ├── ResumeUploader.tsx     # drag & drop + preview
│       │   ├── ResumeEditor.tsx       # editor + save + cover letter modal
│       │   ├── ResumePreview.tsx      # live preview + style switcher + diff highlights
│       │   ├── StreamingOutput.tsx    # AI streaming display
│       │   └── settings/
│       │       ├── ChangePasswordSettings.tsx # re-authenticate + change password
│       │       ├── AppearanceSettings.tsx    # Light/Dark/System theme
│       │       ├── NotificationSettings.tsx  # export-complete / product-update email toggles
│       │       └── DangerZoneSettings.tsx    # permanently delete account + all data
│       ├── contexts/AuthContext.tsx    # Supabase auth provider
│       ├── lib/
│       │   ├── supabase.ts            # Supabase client
│       │   └── utils.ts               # cn(), getInitials()
│       ├── pages/
│       │   ├── Home.tsx               # landing page
│       │   ├── Editor.tsx             # resume editor
│       │   ├── Dashboard.tsx          # stats bar + Resumes/Cover Letters/ATS Score sections
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
│       └── __tests__/                 # 360 frontend tests (26 files)
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
│       │   ├── career_stage.py        # career stage auto-detection (student / early / experienced)
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
cp .env.example .env   # add ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
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

**Backend → Render:** Root `backend`, Python 3.11, env `ANTHROPIC_API_KEY` + `SUPABASE_URL` + `SUPABASE_ANON_KEY`
**Frontend → Vercel:** Root `frontend`, env `VITE_API_URL` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

Every `git push` → auto-deploys both.

---

## Testing

```bash
cd backend && pytest -v        # 62 backend tests
cd frontend && npm test         # 360 frontend tests (26 files)
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
- [x] Server-side quota enforcement — 30 AI calls/month free tier with 402 response + UI modal
- [x] Resume editor redesign — 3-column layout, step stepper, section nav, live preview panel
- [x] Career stage persona split — Student / Early Career / Experienced selector with auto-detection
- [x] One Click Package Generation — wizard: JD + role (AI-validated) → resume selection → parallel streaming tailor + cover letter + ATS → result view with export and save
- [x] Mobile responsive editor — scrollable AI tool and document tab bars; Edit/Preview toggle scoped correctly per step
- [ ] Stripe monetization
- [ ] Resume version history
- [ ] Generate resume from scratch using Profile work experience

---

*Built with Claude Code + Claude API · Vibe coded in one weekend · Production ready 🚀*
