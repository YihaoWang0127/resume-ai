# V3 Roadmap

## Phase 0 — Prep (½ evening)
- [ ] Branch v3 off main; keep main deployable.
- [ ] Add doc/v3-roadmap.md (this file).
- [ ] Tag the current state v2.0 first — V3 needs a clean baseline (the V2 tag never landed).
- [ ] Confirm no new env vars until Phase 5 (Stripe keys).

## Phase 1 — Quantification Coach ⭐ (Day 1–2 — the quality lever)
*V2's persona split stops the model inventing numbers. This helps the user supply real ones. Highest user-visible value; pure prompt + light UI.*

- [ ] Backend /api/quantify: input = a resume (or selected bullets). Claude (Sonnet) returns, per weak bullet, a short interview question ("How many users did this serve?", "What % faster?") — never a fabricated number.
- [ ] Strict contract: output is questions + the bullet id, not rewritten text. Rewriting happens only after the user answers.
- [ ] Frontend: a "Coach" panel in the Resume Editor — lists bullets missing impact, inline answer fields; on submit, re-runs enrich with the user-supplied facts injected into the prompt.
- [ ] Reuse the persona/honesty guardrail so answers are woven in truthfully.
- [ ] Tests: questions reference real bullet ids; no numeric fabrication when the user skips a question.
- [ ] PR + deploy.

## Phase 2 — Semantic JD ↔ Resume Gap Analysis (Day 3 — deepen ATS)
*Move beyond keyword matching ("missing: Kubernetes") to capability gaps ("no demonstrated experience leading a migration").*

- [ ] Backend /api/gap: input = resume + JD. Claude returns structured gaps: missing_skills, underdemonstrated (skill present but thin), strengths_to_lead_with.
- [ ] Build on existing ATS infra/route — composition, not new plumbing.
- [ ] Frontend: a "Gap Analysis" tab next to the ATS sidebar in the Package view; each gap links to the Quantification Coach or enrich.
- [ ] Tests: structured output shape; graceful empty-JD handling.
- [ ] PR + deploy.

## Phase 3 — Recruiter 7-Second Scan + Red-Flag Checker (Day 4 — credibility lever)
*Two cheap, high-trust signals from one route.*

- [ ] Backend /api/review: returns (a) a 7-second scan simulation — what a recruiter notices first, and what's buried; (b) a red-flag pass — unexplained gaps, inflated titles, length, vague verbs.
- [ ] Honesty-positive framing: flags risks, never auto-rewrites to hide them.
- [ ] Frontend: a dismissible "Recruiter View" card on the resume preview.
- [ ] Tests: flag detection on a seeded bad resume; clean resume → no false positives.
- [ ] PR + deploy.

## Phase 4 — Application Package Lifecycle 🔁 (Day 5 — retention)
*You already save packages. This adds the status layer that turns saved packages into a tracker — minimal new infra.*

- [ ] Migration: add status (saved / applied / interviewing / offer / rejected), job_url, applied_at to the existing saved-package row (or a thin application_status table keyed to it), with RLS mirroring resumes.
- [ ] services/applications.ts: status CRUD over saved packages (Supabase direct, like resumes.ts).
- [ ] Dashboard: a board view of saved packages grouped by status; status dropdown (skip drag-drop).
- [ ] On Package "Save" → default status='saved', with a one-click "Mark as applied."
- [ ] Tests for the status service + RLS.
- [ ] PR + deploy.

## Phase 5 — Stripe Monetization 💳 (Day 6 — the payoff)
*Phase 2 of V2 already returns 402 and ships an upsell modal stub. This wires it up.*

- [ ] Stripe checkout + webhook → set a plan on the user; raise/remove the monthly quota for Pro.
- [ ] Backend: quota check reads plan; free = 30/mo, Pro = unlimited (or higher cap).
- [ ] Frontend: upsell modal → real checkout; "Manage subscription" in Settings.
- [ ] Gate the heaviest V3 features (Coach re-runs, Gap, Recruiter View) behind Pro if desired.
- [ ] Tests: webhook sets plan; quota respects plan; downgrade reverts.
- [ ] Add Stripe keys to Render; PR + deploy.

## Phase 6 — Polish & Tag (Day 7)
- [ ] Render keep-warm cron so first stream isn't a cold-start.
- [ ] Mobile pass on the new Coach / Gap / Recruiter panels.
- [ ] Update README.md + CLAUDE.md for new endpoints, status field, and plan/Stripe behavior.
- [ ] Tag v3.0. ✅

## Scope guardrails
* **In scope (V3):** Phases 1–6.
* **Quality levers (the differentiation):** 1, 2, 3 — honesty-positive, never fabricate.
* **Retention:** 4.
* **Revenue:** 5.

## V4 candidates — park, do NOT start
* Interview-prep handoff (questions generated from JD + resume)
* LinkedIn / profile import
* Human-looking visual resume templates (multi-template PDF engine)
* Outcome analytics ("packages with ATS > 80 got more interviews")
* Browser extension to pull JDs from job boards (the real "apply" integration you can't do today)

## Definition of done for V3
Quantification Coach (1) + deeper analysis (2–3) + package lifecycle tracker (4) + Stripe (5), polished and tagged (6). **If short, ship 1 + 4 + 5.**