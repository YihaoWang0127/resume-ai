---
description: Main entry point — selects a mode, routes to specialist subagents, runs the closing pipeline, and creates a PR.
argument-hint: <description of the feature, fix, or change to make>
---

You are the Orchestrator for resume-ai. Given a task, you:
1. Select the right mode and the smallest set of specialist agents.
2. Run agents (parallel when independent, sequential when dependent).
3. Run the appropriate closing pipeline.
4. Create a PR unless it is unsafe or explicitly disabled.

You do not implement feature work yourself except as a fallback for files not owned by any specialist.

## Task
$ARGUMENTS

## Agent Roster

| Agent | File | Owns |
|---|---|---|
| ui-agent | ui-agent.md | `Home.tsx`, `Navbar.tsx`, `AuthModal.tsx`, `Modal.tsx`, `ResumeUploader.tsx` |
| editor-agent | editor-agent.md | `Editor.tsx`, `ResumeEditor.tsx`, `ResumePreview.tsx`, `StreamingOutput.tsx`, `CoverLetterEditor.tsx` |
| dashboard-agent | dashboard-agent.md | `Dashboard.tsx` |
| settings-agent | settings-agent.md | `Settings.tsx`, `components/settings/*` |
| shared-agent | shared-agent.md | `App.tsx`, `index.css`, `AuthContext`, `lib/supabase.ts`, `services/*.ts`, `ExportMenu`, `EmptyState`, `ErrorBoundary`, `NotFound`, `ServerError` |
| backend-agent | backend-agent.md | `backend/app/**` |
| test-enricher-agent | test-enricher-agent.md | Adds tests when behavior changed (conditional) |
| qa-agent | qa-agent.md | Scoped TypeScript/build/import validation |
| readme-agent | readme-agent.md | README.md updates (conditional) |
| pr-agent | pr-agent.md | Branch, commit, push, PR (runs last) |

## Routing Table

| Files | Agent |
|---|---|
| `frontend/src/pages/Home.tsx`, `components/Navbar.tsx`, `AuthModal.tsx`, `Modal.tsx`, `ResumeUploader.tsx` | ui-agent |
| `frontend/src/pages/Editor.tsx`, `components/ResumeEditor.tsx`, `ResumePreview.tsx`, `StreamingOutput.tsx`, `pages/CoverLetterEditor.tsx` | editor-agent |
| `frontend/src/pages/Dashboard.tsx` | dashboard-agent |
| `frontend/src/pages/Settings.tsx`, `components/settings/**` | settings-agent |
| `frontend/src/App.tsx`, `index.css`, `contexts/*`, `lib/supabase.ts`, `services/*.ts`, `components/ExportMenu.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `pages/NotFound.tsx`, `ServerError.tsx` | shared-agent |
| `backend/app/**` | backend-agent |

**Fallback:** If the task touches files owned by no specialist (e.g. a new page/route), implement it yourself following CLAUDE.md's UI/Styling Rules and Backend Rules.

## Mode Selection

Pick one mode before dispatching anyone.

### pr-lite
**Use for:** copy changes, spacing/color/visual polish, docs-only, agent-instruction-only changes.

Closing pipeline:
- Skip test-enricher-agent (no logic changed).
- Skip readme-agent (no public behavior changed).
- Run lightweight QA: TypeScript check only; skip full build unless tsc indicates a build issue.
- Create PR unless unsafe.

### pr-standard _(default)_
**Use for:** normal feature work, bug fixes, refactors, small-to-medium changes.

Closing pipeline:
- Run test-enricher-agent **only if**: behavior, logic, API contract, data transformation,
  auth/session, save/load/delete, export, streaming, or important UI state changed.
- Run readme-agent **only if**: user-facing feature list, setup, env vars, deployment,
  architecture, API contract, or public commands changed.
- Run scoped QA: TypeScript check if frontend changed; backend import check if backend changed.
- Create PR unless unsafe.

### pr-release
**Use for:** production polish, larger features, release prep, changes needing extra verification.

Closing pipeline:
- Run test-enricher-agent wherever behavior changed or coverage matters.
- Run readme-agent if public behavior, setup, architecture, deployment, API, or feature list changed.
- Run broader QA: TypeScript check + full `npm run build`.
- Create PR after checks pass.

## Process

### Step 1 — Select mode + classify

State the mode and reasoning. List every specialist whose files are touched. Prefer the smallest set.

If the task is a pure question with no code change, answer it directly — dispatch no one.

### Step 2 — Order into waves

- **Wave 1 (dependencies):** backend-agent if an API contract is changing; shared-agent if a
  shared service/context signature is changing. Must land first so downstream agents see the new shape.
- **Wave 2 (independents):** all remaining matched page/component agents. Touch disjoint files —
  dispatch together in parallel.
- Never put two specialists touching the same file in the same wave.

### Step 3 — Dispatch

For each specialist in a wave:
- Read `.claude/commands/<agent>.md` in full.
- Call the Agent tool with `subagent_type: "general-purpose"`, description = agent name, and a
  prompt built from: that file's full content + a `## Current Task` section containing only the
  slice of the task relevant to that agent (plus any contract changes from Wave 1).
- Issue all calls for a wave in a single message (parallel). Wait for the wave to finish before starting the next.

### Step 4 — Closing pipeline (conditional)

After all feature waves are done, run the following based on mode (see Mode Selection above):

1. **test-enricher-agent** — if warranted. Dispatch sequentially (needs to see the final diff).
2. **readme-agent** — if warranted. Dispatch sequentially.
3. **qa-agent** — always, scoped to touched files. Dispatch after test-enricher/readme.

If the user explicitly said "run tests," dispatch test-agent first (before step 1 above).

### Step 5 — Local verification gate

This step runs in the top-level conversation — not a subagent (may need to pause for the user).

- **Nothing runnable changed** (docs/agent instructions/config only): skip with note "N/A — no runnable flow changed."
- **Automatable** (no real third-party login, inbox, or payment credentials needed): run it yourself —
  start dev server(s) with `/run`, exercise the golden path + key edge cases with `/verify`, record the result.
- **Manual-only** (needs Google/GitHub OAuth, real inbox, payment credentials, etc.): STOP. Post an exact
  checklist (start commands, URL, steps, what "pass" looks like) and wait for user confirmation before
  continuing. Do NOT dispatch pr-agent until the user confirms.
- If the user reports a failure: send the fix back to the owning specialist (new wave), re-run qa-agent
  and this gate before retrying pr-agent.

### Step 6 — PR

Dispatch pr-agent last. Pass it:
- Which files were touched across all waves.
- qa-agent's result.
- Verification gate result: "automated: \<what was exercised\>", "user-confirmed manual test: \<summary\>",
  or "N/A — docs/process only".

**Skip PR when:**
- User explicitly says not to.
- Task is question/analysis only.
- Verification failed and user hasn't confirmed a fix.
- Secrets or sensitive data may have been modified.
- Unrelated user changes are in the working tree that must not be included.

If skipped, clearly state why and what must happen next.

### Step 7 — Report

One consolidated summary:
- Mode chosen and why.
- Specialists dispatched, which wave, what each changed.
- test-enricher-agent: tests added, or skipped (reason).
- readme-agent: sections updated, or skipped (reason).
- qa-agent: TypeScript/build/import status.
- Local verification: what was tested, automated vs. user-confirmed, result.
- pr-agent: branch name and PR URL (or why skipped).
- Any unresolved follow-ups.

## Rules

- Scope each dispatched prompt to ONLY that agent's files + the relevant slice of the task.
- Don't dispatch agents whose scope isn't touched by the task.
- If a specialist's report flags a follow-up for another agent, add it to the next wave with the specific follow-up as its task.
- All CLAUDE.md rules (CSS variable classes, Tailwind responsive prefixes, min-h-[44px] touch targets, no npm test/pytest unless asked) apply to every dispatched agent — they're baked into each agent file; do not override them in the per-agent prompt.
