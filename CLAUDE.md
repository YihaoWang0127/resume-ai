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

## Subagent Roster

All specialist subagents live in `.claude/commands/`. For any feature, fix,
or multi-file task, prefer:

    /orchestrator <description of the task>

which classifies the task, dispatches the matching specialist(s) below
(in parallel when their scopes are independent), and always finishes with
the Standard Closing Pipeline.

| Agent | Owns |
|---|---|
| dashboard-agent | Dashboard.tsx |
| editor-agent | Editor.tsx, ResumeEditor.tsx, ResumePreview.tsx, StreamingOutput.tsx, CoverLetterEditor.tsx |
| ui-agent | Navbar.tsx, AuthModal.tsx, Modal.tsx, Home.tsx, ResumeUploader.tsx |
| settings-agent | Settings.tsx + components/settings/* |
| shared-agent | App.tsx, index.css, AuthContext, lib/supabase.ts, services/*.ts, ExportMenu, EmptyState, ErrorBoundary, NotFound, ServerError |
| backend-agent | backend/app/** (routes, services, prompts, models) |

### How to invoke /orchestrator

Describe the **outcome**, not which agent to use — the routing table above
handles that.

    /orchestrator <what should change/be added> <where it's visible> <any constraints>

Examples:
- Frontend-only: `/orchestrator Add a "Duplicate" action to each resume card
  on the Dashboard that copies resume_data into a new row via resumes.ts`
- Full-stack (mention both ends so backend-agent runs first):
  `/orchestrator Add a new /api/cover-letter/regenerate-tone endpoint
  (Sonnet 4.6) and a tone dropdown in CoverLetterEditor that calls it`
- Bug fix (describe symptom + location, not the fix):
  `/orchestrator On mobile, tapping outside AuthModal doesn't close it —
  fix the backdrop click handler`
- Cross-cutting: `/orchestrator Change the primary accent color from
  #0071E3 to #0A84FF across the app` (routes to shared-agent, which flags
  any required follow-ups)

Tips:
- Say "run tests" explicitly to also run test-agent — otherwise it's
  skipped per the Testing Rules below, and only test-enricher/readme/qa run.
- One logical change per call. Split unrelated changes into separate
  `/orchestrator` calls so waves and reports stay clean.
- New page/route not yet in the roster? Describe it anyway — the
  orchestrator's fallback implements it directly rather than guessing an agent.
- Naming the specific file/page short-circuits classification when a
  request is ambiguous (e.g. "the editor" — Editor.tsx or CoverLetterEditor.tsx?).

## Subagent Behavior

Every specialist subagent above operates the same way:
- Read only the files in its own scope — do not scan the whole project
- Make all changes end-to-end without asking for confirmation
- After completing, output a concise summary: files modified, what changed,
  anything skipped, and any follow-up needed from another agent
- If you hit a blocker (e.g. missing type, broken import), fix it inline — do not stop and ask
- Do NOT run npm test or pytest unless the task explicitly says "run tests"
- Verify only with: npx tsc --noEmit (frontend) or
  `source venv/bin/activate && python -c "import app.main"` (backend)

### Mobile Responsive Rules
- Use Tailwind responsive prefixes only: sm: (640px), md: (768px), lg: (1024px)
- Never use hardcoded px widths for layout — use w-full, max-w-*, or flex/grid responsive classes
- Touch targets minimum 44px height/width (use min-h-[44px] min-w-[44px])
- Use CSS variable classes (bg-background, text-primary) — never hardcode hex colors
- Resizable panels → stacked single-column layout on mobile with tab toggle
- Sidebar nav → horizontal scrollable tab bar on mobile (overflow-x-auto)
- All form inputs → w-full on mobile

## Standard Closing Pipeline

`/orchestrator` always runs these after every feature wave, without being told.
Do not skip them even if the user does not mention them. If subagents are
dispatched manually instead of via `/orchestrator`, include all three as the
final tasks before reporting done:

1. test-enricher-agent — adds test coverage for whatever changed
2. readme-agent — updates README to match
3. qa-agent — final tsc/build/import validation

These three are reusable and feature-agnostic — they read the codebase
diff to detect what changed and act accordingly.