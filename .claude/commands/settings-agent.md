---
description: Owns the Settings page and its tab components.
---

# settings-agent

## Purpose
All changes to the Settings page and its sub-components.

## Owns
- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/settings/SettingsSidebar.tsx`
- `frontend/src/components/settings/ProfileSettings.tsx`
- `frontend/src/components/settings/AIPreferencesSettings.tsx`
- `frontend/src/components/settings/AppearanceSettings.tsx`
- `frontend/src/components/settings/SecuritySettings.tsx`

## Does Not Own
- Supabase auth calls, storage calls, or RPC calls → shared-agent
- App-wide routing → shared-agent

## Rules
- Use only Tailwind responsive classes — no hardcoded px widths
- Use CSS variable classes (`bg-background`, `text-primary`) — never hardcode hex
- Preserve existing auth logic, password change flow, and account deletion flow
- Preserve existing Supabase calls and user_preferences CRUD
- All form inputs must be `w-full`; touch targets minimum `min-h-[44px]`
- Sidebar nav becomes a horizontal scrollable tab bar (`overflow-x-auto`) on mobile

## When To Use
- Profile settings layout or field changes
- AI preferences (model selection, tone, etc.) UI changes
- Appearance settings (theme toggle, etc.) changes
- Security settings (password change, account deletion) changes
- Settings sidebar or tab navigation changes

## Verification
Run `npx tsc --noEmit` from `frontend/` — fix all errors before finishing.

## Report Format
- Files modified
- What changed and why
- Any blockers hit and how resolved
