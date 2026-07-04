# API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/parse | Upload PDF/DOCX → validated + parsed resume JSON |
| POST | /api/enrich | Stream-enriched resume; optional `tone` field: `'professional'` (default) \| `'concise'` \| `'assertive'`; optional `career_stage` field: `'student'` \| `'early'` \| `'experienced'` \| `null` (auto-detect); optional `model` field (see below) |
| POST | /api/tailor | Stream-tailored resume to job description; optional `career_stage` field: `'student'` \| `'early'` \| `'experienced'` \| `null` (auto-detect); optional `model` field (see below) |
| POST | /api/export | Export resume as PDF or DOCX |
| POST | /api/cover-letter | Stream-generated cover letter; optional `model` field (see below) |
| POST | /api/cover-letter/export | Export cover letter as PDF/DOCX/TXT |
| POST | /api/ats-score | Score resume against a job description (keyword match, gaps, suggestions); optional `model` field (see below) |
| POST | /api/validate-jd | Validate that input text is a real job description; returns `{ valid, reason }` |
| POST | /api/validate-role | Validate that input text is a real position/role name; returns `{ valid, reason }` |
| GET | /health | Health check |

`model` field (optional, on `/api/enrich`, `/api/tailor`, `/api/cover-letter`, `/api/cover-letter/improve`, `/api/ats-score`): `"claude-sonnet-4-6"` (default, unchanged behavior if omitted) \| `"claude-sonnet-5"` \| `"claude-opus-4-7"` \| `"claude-opus-4-8"` \| `"claude-fable-5"` (registered users only — anonymous/guest sessions requesting this get HTTP 403).

AI routes (`/api/parse`, `/api/enrich`, `/api/tailor`, `/api/cover-letter`, `/api/cover-letter/improve`, `/api/ats-score`) return HTTP 402 with `{"detail": "Monthly AI limit of 30 calls reached. Upgrade to continue."}` when a user's free quota is exhausted.

Frontend uses Supabase JS directly for all CRUD operations (save/load/list/delete).
