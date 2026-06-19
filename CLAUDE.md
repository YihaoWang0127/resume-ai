# Resume AI — Claude Code Guide

## Project Summary

AI-powered resume and cover letter generator. Users upload resumes, Claude enriches/tailors them,
generates cover letters, and exports as PDF/DOCX/TXT. Supabase handles auth and storage.

**Live URLs**
- App: https://resume-ai-helper.vercel.app
- API: https://resume-ai-helper-jrqf.onrender.com
- DB: Supabase (resume-ai-helper project)

## Current V1 Architecture

**Tech Stack**
- Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI + Python 3.11 + Anthropic SDK (stateless — no Supabase on backend)
- Database: Supabase (PostgreSQL + Auth + Row Level Security)
- PDF: ReportLab | DOCX: python-docx
- Deploy: Vercel (frontend) + Render (backend)

**Claude Models**
- Haiku 4.5: validation + parsing (fast, cheap)
- Sonnet 4.6: enrichment, tailoring, cover letters (quality)

**Key Files**
- Backend entry: `backend/app/main.py`
- Claude prompts: `backend/app/prompts/resume.py`
- Claude service: `backend/app/services/claude.py`
- Frontend routes: `frontend/src/App.tsx`
- Auth context: `frontend/src/contexts/AuthContext.tsx`
- Supabase client: `frontend/src/lib/supabase.ts`
- Resume CRUD: `frontend/src/services/resumes.ts`
- Cover letter CRUD: `frontend/src/services/coverLetters.ts`

**API Routes**
| Method | Path | Purpose |
|---|---|---|
| POST | /api/parse | Upload + validate + parse resume |
| POST | /api/enrich | Stream enriched resume |
| POST | /api/tailor | Stream tailored resume |
| POST | /api/export | Export resume PDF/DOCX |
| POST | /api/cover-letter | Stream cover letter |
| POST | /api/cover-letter/export | Export cover letter PDF/DOCX/TXT |

**Database Tables**
- `resumes`: id, user_id, title, resume_data (JSONB), detected_industry
- `cover_letters`: id, user_id, resume_id, title, content, company_name, job_description, tone
- Both have Row Level Security enabled

## Agent System

All specialist subagents live in `.claude/commands/`. Use `/orchestrator <task>` for any
feature, fix, or multi-file task.

## Agent Roster

| Agent | Owns |
|---|---|
| ui-agent | `Home.tsx`, `Navbar.tsx`, `AuthModal.tsx`, `Modal.tsx`, `ResumeUploader.tsx` |
| editor-agent | `Editor.tsx`, `ResumeEditor.tsx`, `ResumePreview.tsx`, `StreamingOutput.tsx`, `CoverLetterEditor.tsx` |
| dashboard-agent | `Dashboard.tsx` |
| settings-agent | `Settings.tsx`, `components/settings/*` |
| shared-agent | `App.tsx`, `index.css`, `AuthContext`, `lib/supabase.ts`, `services/*.ts`, `ExportMenu`, `EmptyState`, `ErrorBoundary`, `NotFound`, `ServerError` |
| backend-agent | `backend/app/**` (routes, services, prompts, models) |
| test-enricher-agent | `frontend/src/__tests__/`, `backend/tests/` — adds tests when behavior changed |
| qa-agent | Scoped TypeScript/build/import validation |
| readme-agent | `README.md` — updates when public behavior changed |
| pr-agent | Branch, commit, push, and PR for session changes (runs last) |

**Subagent rules (applies to all specialists)**
- Read only files in your scope — do not scan the whole project for simple changes
- Make changes end-to-end without asking for confirmation
- Fix inline blockers (missing types, broken imports) — do not stop and ask
- Do NOT run `npm test` or `pytest` unless the task explicitly says "run tests"
- Verify with: `npx tsc --noEmit` (frontend) or `python -c "import app.main"` (backend)
- Report: files modified, what changed, anything skipped, follow-up needed

## Routing Rules

| Files | Agent |
|---|---|
| `frontend/src/pages/Home.tsx`, `components/Navbar.tsx`, `AuthModal.tsx`, `Modal.tsx`, `ResumeUploader.tsx` | ui-agent |
| `frontend/src/pages/Editor.tsx`, `components/ResumeEditor.tsx`, `ResumePreview.tsx`, `StreamingOutput.tsx`, `pages/CoverLetterEditor.tsx` | editor-agent |
| `frontend/src/pages/Dashboard.tsx` | dashboard-agent |
| `frontend/src/pages/Settings.tsx`, `components/settings/**` | settings-agent |
| `frontend/src/App.tsx`, `index.css`, `contexts/*`, `lib/supabase.ts`, `services/*.ts`, `components/ExportMenu.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `pages/NotFound.tsx`, `ServerError.tsx` | shared-agent |
| `backend/app/**` | backend-agent |

**Wave order:** backend-agent and shared-agent run first (dependencies); page/component agents run in parallel after.

**Fallback:** If a task touches files not owned by any agent (e.g. a new page not yet in the roster), the orchestrator implements it directly using the same UI/Styling and Backend Rules below.

## PR-Ready Workflow

This project uses CI/CD. Every real code or documentation change should end in a PR.

**Important:** PR created is not the same as PR ready.

A task is only considered PR-ready when:
- the PR has been created
- `gh pr checks <PR_URL>` has been run after PR creation
- all required GitHub/Vercel checks have passed, or failures/pending checks are clearly reported
- fixable CI failures have been fixed, committed, pushed, and re-checked

After `pr-agent` returns a PR URL, the orchestrator must run Step 6.5 — CI Fix Loop before reporting final completion.

Final summaries must include CI status:
- `passed`
- `failed`
- `pending`
- `not verified`

Do not claim a PR is green unless checks were actually polled and passed.

`/orchestrator` handles this automatically via three modes:

| Mode | Use For |
|---|---|
| pr-lite | Copy changes, spacing/color/visual polish, docs-only, agent-instruction-only |
| pr-standard | Normal feature work, bug fixes, refactors (default) |
| pr-release | Production polish, larger features, changes needing extra verification |

See `.claude/commands/orchestrator.md` for mode-specific behavior.

## Testing Policy

Never run full tests by default. Full suites run only when the user explicitly says "run tests."

**Add targeted tests when:**
- Behavior, parsing, API, data transformation, or auth/session logic changed
- Bug fix with no prior test coverage
- Save/load/delete/export/streaming behavior changed
- Important UI state transitions changed

**Skip tests entirely when:**
- Copy-only or visual-only CSS/spacing/color changes
- Docs-only or agent instruction-only changes
- README-only edits (unless commands/examples changed)

## QA Policy

Scope QA checks to what was touched — do not run expensive checks for every tiny change.

| Touched | QA Check |
|---|---|
| Frontend source | `npx tsc --noEmit` from `frontend/` — fix errors; add `npm run build` for pr-release |
| Backend source | `source venv/bin/activate && python -c "import app.main"` from `backend/` |
| Docs/agent-only | Markdown sanity — no frontend/backend build needed |
| Mixed | Both frontend type check and backend import check |

## README Policy

Run readme-agent **only when** the change affects: user-facing feature list, setup/installation,
environment variables, deployment, architecture, API contract, project commands, or public behavior
users/contributors need to know about.

**Skip README for:** UI polish, refactors with no public behavior change, internal code cleanup,
tests-only changes, agent instruction-only changes.

## UI / Styling Rules

- Use CSS variable classes (`bg-background`, `text-primary`) — never hardcode hex colors
- Theme: Apple light/blue — background `#FBFBFD`, accent `#0071E3`, Inter font (defined in `frontend/src/index.css`)
- Tailwind responsive prefixes only: `sm:` (640px), `md:` (768px), `lg:` (1024px)
- Never hardcode `px` widths for layout — use `w-full`, `max-w-*`, flex/grid
- Touch targets: minimum `min-h-[44px] min-w-[44px]` for interactive elements
- Resizable panels → stacked single-column on mobile with tab toggle
- Sidebar nav → horizontal scrollable tab bar on mobile (`overflow-x-auto`)
- All form inputs → `w-full` on mobile
- Modals must have `max-h-[90vh] overflow-y-auto` and minimum `p-4` padding

## Backend Rules

- Backend is stateless — no Supabase clients or DB calls on the backend
- Frontend talks directly to Supabase for all CRUD (not through FastAPI)
- Guest mode uses Supabase anonymous sessions
- Streaming uses native fetch (not axios) for browser support
- Validate all request bodies via Pydantic — never accept raw dicts
- Keep prompt templates in `backend/app/prompts/resume.py` separate from service/route logic
- Do not change `ANTHROPIC_API_KEY` loading or env var handling

## Data / Privacy Rules

- Do not weaken Row Level Security assumptions in `resumes.ts` / `coverLetters.ts`
- Auth logic lives in `AuthContext` — do not duplicate Supabase auth calls elsewhere
- Never commit `.env` files or secrets

## Git / PR Rules

**Commit prefix → release impact:**
| Prefix | Version Bump |
|---|---|
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | major |
| `feat:` | minor |
| `fix:` | patch |
| `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:` | none |

- Never push directly to `main`; never force-push; never use `--no-verify`
- Stage only files relevant to the session's task — leave unrelated pre-existing changes unstaged
- Pick commit prefix yourself based on what changed — do not ask the user
- **Frontend env:** `.env.local` — `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Backend env:** `.env` — `ANTHROPIC_API_KEY`

## V2 Notes

Do not implement any of the following now — noted as future direction only:

- Supabase JWT verification on the backend (currently stateless)
- Server-side AI usage logging and quota enforcement
- Billing enforcement at the API layer
- Dedicated agents for auth, billing, quota, or privacy concerns

V2 may move persistence and auth concerns partially into the backend. For now, the frontend
handles all Supabase interactions directly.
