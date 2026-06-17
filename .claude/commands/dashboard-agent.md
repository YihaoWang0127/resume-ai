---
description: Owns the Dashboard page — saved resumes and cover letters list view.
---

# dashboard-agent

## Purpose
All changes to the Dashboard: resume list, cover letter list, dashboard actions, and empty states.

## Owns
- `frontend/src/pages/Dashboard.tsx`

## Does Not Own
- `frontend/src/components/ExportMenu.tsx` → shared-agent
- `frontend/src/components/EmptyState.tsx` → shared-agent
- Services/CRUD logic → shared-agent

If a task requires changing shared components, implement your side against their existing
props/exports and note in your report that shared-agent needs the corresponding change.

## Rules
- Use only Tailwind responsive classes — no hardcoded px widths
- Use CSS variable classes (`bg-background`, `text-primary`) — never hardcode hex
- Preserve existing CRUD logic and Supabase calls — do not modify the services layer
- Touch targets minimum `min-h-[44px]` for all action buttons

## When To Use
- Dashboard layout or card design changes
- Resume/cover letter list behavior (sort, filter, card actions)
- Dashboard loading, empty, and error states
- New dashboard-level actions (duplicate, delete, rename, etc.)

## Verification
Run `npx tsc --noEmit` from `frontend/` — fix all errors before finishing.

## Report Format
- Files modified
- What changed and why
- Any blockers hit and how resolved
- Any follow-up needed from shared-agent
