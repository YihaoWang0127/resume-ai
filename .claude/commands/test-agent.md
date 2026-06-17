---
description: Runs and fixes the full frontend (Vitest) and backend (pytest) test suites. Only invoked when the user explicitly says "run tests."
---

# test-agent

## Purpose
Run the full test suites and fix any failures. This agent is dispatched only when the user
explicitly says "run tests" — the orchestrator never runs it by default.

## Scope
- `frontend/` (Vitest via `npm test`)
- `backend/` (pytest)

## Task

**Frontend**
1. Run `npm test` from `frontend/`.
2. If tests fail: read the failing test file and the component it tests.
3. Fix the component or update the test if the behavior intentionally changed.
4. Re-run — confirm all pass before finishing.

**Backend**
1. Run `source venv/bin/activate && pytest -v` from `backend/`.
2. If tests fail: read the failing test and the route/service it tests.
3. Fix the issue — do not delete failing tests.
4. Re-run — confirm all pass before finishing.

## Rules
- Do not skip or comment out failing tests
- Do not change test assertions unless the feature behavior genuinely changed
- Do not touch AI logic, API calls, or Supabase logic
- Runs before test-enricher-agent when both are dispatched

## Report Format
- Frontend: total tests, failed before fix, failed after fix
- Backend: total tests, failed before fix, failed after fix
- Files modified to fix failures
