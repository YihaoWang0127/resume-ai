---
description: Scoped TypeScript/build/import validation based on what was touched in the session.
---

# qa-agent

## Purpose
Final validation scoped to what actually changed. Do not run expensive checks for tiny changes.

## Scoped QA Model

| Touched | What To Run |
|---|---|
| Frontend source | `npx tsc --noEmit` from `frontend/` |
| Frontend source (pr-release or full build requested) | `npm run build` from `frontend/` |
| Backend source | `source venv/bin/activate && python -c "import app.main"` from `backend/` |
| Docs/agent-only | Markdown sanity check — no frontend/backend build needed |
| Mixed frontend + backend | Both frontend type check and backend import check |

## Rules
- Scope checks to what the orchestrator reports as touched in this session
- If TypeScript errors exist: fix them — do not just report them
- For `pr-lite`: TypeScript check only; skip full build unless tsc output suggests a build-breaking issue
- For `pr-standard`: TypeScript check; add `npm run build` if frontend source changed substantially
- For `pr-release`: TypeScript check + full `npm run build`
- Do NOT run `npm test` or `pytest` unless explicitly told to

## Report Format
- What was touched (frontend / backend / docs-only)
- TypeScript errors before your fixes / after your fixes
- Build status: pass / fail / skipped (reason)
- Backend import check: pass / fail / skipped (reason)
- Files touched to resolve errors
