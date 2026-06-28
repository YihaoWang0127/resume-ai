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
> Highest user-visible value. Pure prompt + light UI, no new infra.
> **The actual feature is the honesty guardrail:** today `ENRICH_SYSTEM` says "quantify where possible,"
> which makes the model invent metrics a new grad can't defend. Persona-splitting fixes that.

**Stage taxonomy (define precisely — detection and prompts must agree):**
| Stage | Definition | Emphasis |
|---|---|---|
| `student` | In school or graduated <1yr, ~0 full-time roles | Projects, coursework, internships, leadership, potential; GPA/honors shown; **no invented metrics**; 1 page |
| `early` | 1–4 yrs full-time | Genuine accomplishments, growth, expanding scope; metrics only where real; 1 page |
| `experienced` | 5+ yrs, or any senior/lead/manager title | Quantified impact, scope/scale, leadership, promotions; results-first; 2 pages OK |

- [ ] **Models** (`backend/app/models/resume.py`): add to **both** `EnrichRequest` and `TailorRequest`:
      `career_stage: Optional[Literal['student','early','experienced']] = None`
      (Optional/None → backward compatible; falls back to auto-detect.)
- [ ] **Detection helper** (`backend/app/services/career_stage.py`) — pure function, **no Claude call**:
  - Sum experience years from `experience[].start_date/end_date` (tolerant date parser; unknown → 0, never throws).
  - `senior_title` keyword check (senior/lead/principal/manager/director/head/vp) — **short-circuits before tenure**.
  - Recent/future `education[].end_date` (within ~1yr) → `student`.
  - Rules: senior title OR ≥5yrs → `experienced`; <1yr OR recent grad → `student`; else `early`.
- [ ] **Resolution precedence** in `enrich.py` / `tailor.py`:
      1. explicit `career_stage` in request (user override) →
      2. `infer_career_stage(resume)` →
      3. map from `user_preferences.job_level` (`junior/mid→early`, `senior/executive→experienced`;
         note: no "student" in prefs, so detection/override is the only path to it).
- [ ] **Prompts** (`prompts/resume.py`): replace single `ENRICH_SYSTEM` / `TAILOR_SYSTEM` with
      `*_BY_STAGE` dicts; `build_enrich_prompt` / `build_tailor_prompt` take `career_stage` and select.
  - **student/early:** projects, internships, transferable skills, entry-level keywords;
    **CRITICAL line: do NOT invent numbers/percentages/dollar amounts/team sizes**; 1-page guidance.
  - **experienced:** quantified impact, scope/scale, leadership; results-first; 2-page guidance.
  - Keep `tone` and `career_stage` **orthogonal** (voice vs. content strategy) — don't merge.
  - Keep the JSON schema contract **identical** across stages so the diff/compare view is unchanged.
- [ ] **Persist** resolved `career_stage` onto the `resumes` row (like `detected_industry`) so the UI preselects it.
- [ ] **UI:** 3-way segmented selector (Student / Early / Experienced) by the Enrich button;
      preselect from stored/detected value; changing it re-runs enrich. It's an override, not a required step.
- [ ] **Tests:**
  - `infer_career_stage`: senior title + 2yrs → `experienced`; 0yrs + recent grad → `student`;
    3yrs no senior title → `early`; messy/empty dates → no crash.
  - `build_enrich_prompt(stage='student')` system contains the "do NOT invent" guardrail;
    `stage='experienced'` mentions "quantified" and omits it.
  - Precedence: explicit request stage overrides detection.
  - One route test: `career_stage` flows request → prompt.

**Guardrails:** detection is just a *default* (user can override) — don't rabbit-hole on perfect date
parsing. Page-length is a prompt hint, not enforcement. The honesty guardrail is the part that matters most.

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
- [ ] Update `README.md` + `CLAUDE.md` (readme-agent) all new change, but not too complicated
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