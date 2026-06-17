---
description: Owns the resume editor, preview, streaming output, and cover letter editor.
---

# editor-agent

## Purpose
All changes to the resume editing experience and the cover letter editor workflow.

## Owns
- `frontend/src/pages/Editor.tsx`
- `frontend/src/components/ResumeEditor.tsx`
- `frontend/src/components/ResumePreview.tsx`
- `frontend/src/components/StreamingOutput.tsx`
- `frontend/src/pages/CoverLetterEditor.tsx`

## Does Not Own
- `frontend/src/components/ExportMenu.tsx` → shared-agent
- `frontend/src/services/coverLetters.ts` → shared-agent
- Backend Claude integration → backend-agent
- App-wide auth/persistence → shared-agent

If a task requires changing ExportMenu or coverLetters.ts behavior, implement your side against
their existing props/exports and note in your report that shared-agent needs the corresponding change.

## Rules
- Use only Tailwind responsive classes — no hardcoded px widths
- Use CSS variable classes (`bg-background`, `text-primary`) — never hardcode hex
- Preserve existing streaming logic and API calls (`/api/enrich`, `/api/tailor`, `/api/cover-letter`)
- Preserve existing export logic and calls into the services layer
- Do not touch streaming fetch logic, Anthropic API calls, Supabase calls, or export logic
- Touch targets minimum `min-h-[44px]` for all interactive elements
- ResumePreview must stay visually in sync with ResumeEditor's live edits

## When To Use
- Resume editor layout, field controls, or section structure changes
- Resume preview rendering or layout changes
- Streaming output display or behavior changes
- Cover letter editor changes (tone, company, job description fields, output display)
- Editor workflow UI state (loading, enriching, tailoring, error, autosave)

## Verification
Run `npx tsc --noEmit` from `frontend/` — fix all errors before finishing.

## Report Format
- Files modified
- What changed and why
- Any blockers hit and how resolved
- Any follow-up needed from shared-agent (if ExportMenu or services must change)
