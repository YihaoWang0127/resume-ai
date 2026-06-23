# ResumeAI — V2 Roadmap

> One week of off-hours. Each phase ships its own PR to `main` so the app is never broken.
> The version bump (`v2.0` tag) lands in **Phase 6** — until then they're incremental deploys on the road to V2.

**Sequencing principle:** harden the trust boundary first (know *who* is calling), then ship the
quality lever (personas), then the workflow win ("Apply to this job"), then the retention hook (tracker).

**Minimum shippable V2 if the week runs short:** Phase 1 + 3 + 4 (secure + personalized + one-click apply).
Phases 2 and 5 can slip to a **v2.1** weekend without anything feeling half-done.

---

## Phase 0 — Prep _(½ evening)_
- [ ] Branch `v2` off `main`; keep `main` deployable all week.
- [ ] Add this file (`docs/V2.md`) so progress survives between evenings.
- [x] Confirm an **active JWT signing key** is in use (Supabase → Settings → JWT Keys →
      JWT Signing Keys). No secret to copy — asymmetric keys verify via a public JWKS URL.
- [ ] Add `SUPABASE_JWKS_URL` to backend `.env` (and to Render before Phase 1 merges):
      `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
      _(project-ref = the subdomain already in your frontend `VITE_SUPABASE_URL`)_.
- [ ] Confirm Render + Vercel env vars are documented (one new backend var this week).

---

## Phase 1 — Lock the backend 🔴 _(Day 1 — non-negotiable foundation)_
> Today any caller with the Render URL can burn Anthropic credits. Fix before adding features.
> Uses **asymmetric (ES256) verification** — Supabase signs with its private key; your backend
> only fetches the **public** key from the JWKS URL. No secret lives on Render.

- [ ] Add `pyjwt[crypto]` (and `httpx` if not present) to `backend/requirements.txt`.
- [ ] Add `backend/app/auth.py` with `get_current_user`:
  - Read `Authorization: Bearer <token>`; reject if missing.
  - Use `PyJWKClient(SUPABASE_JWKS_URL)` (cached) to fetch the signing key by the token's `kid`.
  - Verify signature (ES256), `exp`, and `aud="authenticated"`.
  - Return the user id (`sub` claim). Raise `401` on any failure.
- [ ] Apply `Depends(get_current_user)` to every route in `backend/app/routes/`
      (`parse`, `enrich`, `tailor`, `export`, `cover_letter`, `ats_score`, `validate_jd`).
- [ ] Frontend `services/api.ts`: attach `supabase.auth.getSession()` access token as
      `Authorization: Bearer …` to all FastAPI fetches (including the streaming calls).
- [ ] Add `slowapi` rate limiting keyed on user id (e.g. 20 AI calls/min) → returns `429`.
- [ ] Guest-mode policy: allow Supabase **anonymous** JWTs (they're still valid signed tokens)
      but apply a tighter rate limit; or block guests from AI — decide and note it.
- [ ] Tests: `401` without token, `401` on expired/invalid token, `200` with valid token, `429` over limit.
- [ ] **Add `SUPABASE_JWKS_URL` to Render before merging** (otherwise every route 500s), then PR + deploy.

---

## Phase 2 — Server-side quota _(Day 1–2, small)_
> Turns `ai_usage_log` from cosmetic into enforced — and is the seam Stripe plugs into later.

- [ ] Log usage server-side after each successful AI call (user id now comes from the JWT).
- [ ] Before each AI call, count this month's usage; over free quota (e.g. 30/mo) → return `402`.
- [ ] Frontend: catch `402` → "You've hit your free limit" upsell modal (stub, no Stripe yet).
- [ ] PR + deploy.

---

## Phase 3 — Persona split: fresh grad vs. experienced ⭐ _(Day 2–3 — the quality lever)_
> Highest user-visible value. Pure prompt + light UI work, no new infra.

- [ ] Add `career_stage` (`'student' | 'early' | 'experienced'`) to request models;
      default-derive from existing `user_preferences.job_level`.
- [ ] Auto-detect stage at parse time (grad year / total years); store it; allow user override.
- [ ] Branch `build_enrich_prompt` / `build_tailor_prompt` in `backend/app/prompts/resume.py`:
  - **Student / early:** projects, coursework, internships, transferable skills, potential;
    no fabricated metrics; entry-level keywords; 1-page guidance.
  - **Experienced:** quantified impact, scope/scale, leadership, promotions; results-first bullets; 2-page guidance.
- [ ] UI: segmented stage selector in the editor that re-runs enrich.
- [ ] Tests: each stage yields its distinct system prompt.
- [ ] PR + deploy. _(Headline V2 feature — worth a changelog note.)_

---

## Phase 4 — "Apply to this job" one-shot 🚀 _(Day 4–5 — the workflow win)_
> Collapses parse → tailor → cover → ATS into the single action users actually want.

- [ ] Backend `/api/apply`: input = saved resume id + JD (pasted text first).
      Orchestrate tailor → cover letter → ATS score; stream progress.
- [ ] Reuse existing services — composition, not new AI logic.
- [ ] Frontend: one "Apply to this job" entry point → JD input → progress →
      tailored resume + cover letter + ATS score side by side.
- [ ] **Stretch:** URL → JD scrape (server fetch + Haiku extract), gated behind existing `validate-jd`.
- [ ] PR + deploy.

---

## Phase 5 — Application tracker 🔁 _(Day 6 — the retention hook)_
> Plays to your strength: CRUD + RLS, the part of the stack that's already solid.

- [ ] Migration: `applications` table (`user_id`, `resume_id`, `cover_letter_id`, `company`,
      `role`, `job_url`, `status`, `applied_at`, timestamps) with RLS — mirror existing pattern.
- [ ] `services/applications.ts` (Supabase direct CRUD, like `resumes.ts`).
- [ ] Dashboard tab: simple board (Applied / Interviewing / Offer / Rejected);
      status dropdown is enough — skip drag-drop.
- [ ] On "Apply to this job" completion → offer "Save to tracker."
- [ ] Tests for the new service.
- [ ] PR + deploy.

---

## Phase 6 — Polish & guardrails _(Day 7)_
- [ ] **Render cold start:** keep-warm cron ping (or paid tier) so first stream isn't broken.
- [ ] Mobile editor pass — at least make the new selectors usable on phone.
- [ ] Update `README.md` + `CLAUDE.md` (readme-agent) for new endpoints, `career_stage`,
      quota behavior, and `applications` table.
- [ ] Tag **`v2.0`** release. ✅ This is the moment it becomes V2.

---

## Scope guardrails
**In scope (V2):** Phases 1–6.
**Defensive (protect the wallet):** 1, 2 — don't skip even though they're the least fun.
**Offensive (product value):** 3, 4.  **Habit:** 5.

### V3 candidates — park here, do NOT start this week
- Quantification coach (interview the user for missing numbers; never fabricate)
- Recruiter 7-second-scan simulation + rationale
- Semantic JD ↔ resume gap analysis (beyond keyword match)
- Honesty / red-flag checker (gaps, inflated titles, length)
- Interview-prep handoff (questions from JD + resume)
- LinkedIn import; human-looking visual templates
- Stripe monetization (plugs into Phase 2's `402`)

---

## Definition of done for V2
> Secured backend (1–2) + persona-aware AI (3) + one-shot apply (4) + tracker (5), polished and tagged (6).
> If short on time, ship **1 + 3 + 4** and tag the rest v2.1.