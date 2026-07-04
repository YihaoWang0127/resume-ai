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
- **Career Stage Persona Split** — Student / Early Career / Experienced selector (auto-detected by default) makes enrichment and tailoring prompts persona-aware
- **One Click Package Generation** — wizard collects company, role, and JD (AI-validated), then streams a tailored resume + cover letter + ATS score in parallel; results view supports PDF export and saving the full package to Supabase (registered users only)

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
- **Navbar Desktop Links** — center nav with interactive dropdown panels for Features, How It Works, Pricing, and Examples; the Examples panel lists Resume, Cover Letter, and ATS Score, each opening its own sample modal (before/after comparison, sample cover letter, or mock score breakdown)
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
- **Models** — info card showing Haiku 4.5 stays fixed for parsing; enrichment/tailoring/cover letters/ATS scoring use a user-selectable model, with a "Default AI Model" setting here as the fallback when no per-screen override is chosen
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

10 REST endpoints under `/api/*` (parse, enrich, tailor, export, cover letter, ATS score,
JD/role validation) plus `/health`. All AI routes are JWT-secured, support an optional
`model` override, and return HTTP 402 once the free-tier quota is hit.

Full endpoint list, request fields, and status codes: [`doc/api.md`](doc/api.md).

---

## Database

Supabase Postgres with RLS on every table: `resumes`, `cover_letters`, `user_preferences`,
`profiles`, and `ai_usage_log`, plus an `avatars` storage bucket and a `delete_user_account()`
RPC for account deletion.

Full schema, storage, and RPC details: [`doc/database.md`](doc/database.md).

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

## Roadmap

Shipped capabilities are listed under [Features](#features) above. What's left:

- [ ] Stripe monetization
- [ ] Resume version history
- [ ] Generate resume from scratch using Profile work experience

---

*Built with Claude Code + Claude API · Vibe coded in one weekend · Production ready 🚀*
