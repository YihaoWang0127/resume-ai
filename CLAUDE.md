# Resume AI — Claude Code Guide

## Project Summary

AI-powered resume and cover letter generator. Users upload resumes, Claude enriches/tailors them,
generates cover letters, and exports as PDF/DOCX/TXT. Supabase handles auth and storage.

**Live URLs**
- App: https://resume-ai-helper.vercel.app
- API: https://resume-ai-helper-jrqf.onrender.com
- DB: Supabase (resume-ai-helper project)

## Current Architecture

**Claude Models**
- Haiku 4.5: validation + parsing (fast, cheap)
- Sonnet 4.6: enrichment, tailoring, cover letters (quality)

**Backend Security**
- All AI routes are JWT-secured (PyJWT ES256 + Supabase JWKS); frontend attaches the Supabase JWT as Bearer token on every AI API call
- Rate-limited via slowapi; server-side quota enforcement (30 AI calls/month free tier) returns HTTP 402 when the limit is reached
- Backend remains stateless for CRUD — all Supabase reads/writes go through the frontend client directly

Tech stack and key files are documented once, in `README.md` (§Tech Stack, §Project Structure).
Full API routes and database schema live in `doc/api.md` and `doc/database.md`, linked from
README's API Endpoints / Database sections. Treat these as the source of truth and don't
re-list them here.

## Agent System

Specialist subagents are defined in `.claude/agents/`; the orchestrator lives in `.claude/commands/orchestrator.md`. Use `/orchestrator <task>` for any feature, fix, or multi-file task — it owns the full Agent Roster, Routing Table, mode selection, wave ordering, and closing/PR pipeline. See `.claude/commands/orchestrator.md` for all of that; don't duplicate those tables here.

**Subagent rules (applies to all specialists)**
- Read only files in your scope — do not scan the whole project for simple changes
- Make changes end-to-end without asking for confirmation
- Fix inline blockers (missing types, broken imports) — do not stop and ask
- Do NOT run `npm test` or `pytest` unless the task explicitly says "run tests"
- Verify with: `npx tsc --noEmit` (frontend) or `python -c "import app.main"` (backend)
- Report: files modified, what changed, anything skipped, follow-up needed

## When to Use /orchestrator vs. Direct Chat

The rule is binary — it depends on whether a file is modified, not on the size of the change:

- **Direct chat:** questions, explanations, reading and analyzing code — anything that does NOT modify a file. Direct chat never commits, never creates PRs, and never touches files in `frontend/`, `backend/`, or `supabase/migrations/`.
- **`/orchestrator`:** ANY modification to a file in `frontend/`, `backend/`, or `supabase/migrations/` — no exceptions for size. A one-line copy fix is still a modification and still goes through `/orchestrator`.

## PR-Ready Workflow

This project uses CI/CD — every real code or doc change should end in a PR, and "PR created" is
not the same as "PR ready." The full procedure (verification gate, PR creation, the capped CI
auto-fix loop, and mode selection) lives in `.claude/commands/orchestrator.md` (Steps 5–7) —
do not claim a PR is green unless checks were actually polled and passed.

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

The following are still deferred — do not implement now:

- Stripe actual billing integration (payment collection, subscription management)
- Dedicated specialist agents for auth, billing, quota, or privacy concerns
- Resume version history
- Generate resume from scratch using Profile work experience

Already shipped (no longer deferred): JWT backend auth, slowapi rate limiting, server-side quota
enforcement with 402 responses, career stage persona split, One Click Package wizard, AI usage
logging and monthly quota modal.
