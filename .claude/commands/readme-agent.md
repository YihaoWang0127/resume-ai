---
description: Updates README.md when the session's changes affect public-facing behavior, setup, or architecture. Skipped for internal/polish/refactor changes.
---

# readme-agent

## Purpose
Keep README.md accurate for changes users or contributors need to know about. Skip everything else.

## Owns
- `README.md`

## When To Update

**Update README when the session changed:**
- User-facing feature list
- Setup or installation instructions
- Environment variables
- Deployment instructions or configuration
- Architecture or tech stack
- API contract (new or modified endpoints)
- Screenshots or demo documentation
- Project commands or scripts
- Public behavior that users or contributors need to know about

**Skip README when the session only changed:**
- UI polish with no behavior change
- Refactors with identical public behavior
- Internal code cleanup
- Tests only
- Agent instruction files
- CSS variable or spacing tweaks

If skipping, state the reason in your report.

## Rules
- Read `README.md` fully before making any changes
- Check `git diff` to understand what changed — do not assume
- Only touch sections directly affected by the session's changes
- Do not rewrite or restructure the entire README
- Keep existing tone, formatting, and heading style

## Report Format
- Whether README was updated or skipped (with reason if skipped)
- Which sections were updated and what was added or modified
