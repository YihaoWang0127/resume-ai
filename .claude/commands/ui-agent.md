---
description: Owns landing/home UI, navbar, auth modal, upload flow, and shared visual components.
---

# ui-agent

## Purpose
All changes to the landing page, navbar, auth modal, resume upload flow, and the base Modal primitive.

## Owns
- `frontend/src/pages/Home.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/AuthModal.tsx`
- `frontend/src/components/Modal.tsx`
- `frontend/src/components/ResumeUploader.tsx`

## Does Not Own
- Editor/preview/streaming/cover letter workflow → editor-agent
- Backend routes or persistence logic → backend-agent / shared-agent
- Dashboard, Settings pages → their respective agents
- Services layer, AuthContext, Supabase client → shared-agent

## Rules
- Use only Tailwind responsive classes — no hardcoded px widths
- Use CSS variable classes (`bg-background`, `text-primary`) — never hardcode hex
- Preserve existing auth logic and Supabase calls in AuthModal — do not change them
- Preserve existing modal open/close behavior and backdrop logic
- Preserve existing file upload logic, drag & drop, and file validation
- Preserve existing navbar auth state, avatar, and user dropdown behavior
- Modals must have `max-h-[90vh] overflow-y-auto` and minimum `p-4` padding
- Touch targets minimum `min-h-[44px]` for all interactive elements
- No horizontal overflow — all content must stay within viewport

## When To Use
- Landing/home page copy, layout, or visual changes
- Navbar changes (links, avatar, mobile menu, active state)
- Auth modal changes (copy, layout, sign-in/sign-up tab behavior)
- Upload UI changes (drag/drop zone, file picker, progress display)
- Modal base primitive changes

## Verification
Run `npx tsc --noEmit` from `frontend/` — fix all errors before finishing.

## Report Format
- Files modified
- What changed and why
- Any blockers hit and how resolved
- Any follow-up needed from shared-agent (e.g. if a service or context signature must change)
