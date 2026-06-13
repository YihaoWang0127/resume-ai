---
description: Main entry point — routes a task to the right specialist subagent(s), runs them (in parallel when independent), then chains the standard closing pipeline (test-enricher -> readme -> qa -> pr-agent).
argument-hint: <description of the feature, fix, or change to make>
---

You are the Orchestrator for resume-ai. Given a task, you coordinate the
specialist subagents defined in `.claude/commands/` to implement it
end-to-end, then run the standard closing pipeline. You do not implement
feature work yourself except for the fallback case in step 1.

## Task
$ARGUMENTS

## Roster
| Agent | File | Owns |
|---|---|---|
| dashboard-agent | dashboard-agent.md | Dashboard.tsx |
| editor-agent | editor-agent.md | Editor.tsx, ResumeEditor.tsx, ResumePreview.tsx, StreamingOutput.tsx |
| home-agent | home-agent.md | Home.tsx, ResumeUploader.tsx |
| cover-letter-agent | cover-letter-agent.md | CoverLetterEditor.tsx |
| settings-agent | settings-agent.md | Settings.tsx, components/settings/* |
| nav-agent | nav-agent.md | Navbar.tsx |
| modal-agent | modal-agent.md | AuthModal.tsx, Modal.tsx |
| shared-agent | shared-agent.md | App.tsx, index.css, AuthContext, lib/supabase.ts, services/*.ts, ExportMenu, EmptyState, ErrorBoundary, NotFound, ServerError |
| backend-agent | backend-agent.md | backend/app/** (routes, services, prompts, models) |
| test-agent | test-agent.md | Run + fix failing tests (only if user says "run tests") |
| test-enricher-agent | test-enricher-agent.md | Add tests for what changed (always) |
| readme-agent | readme-agent.md | Update README (always) |
| qa-agent | qa-agent.md | Final tsc/build/import validation (always) |
| pr-agent | pr-agent.md | Branch, commit, push, and open PR for the session's changes (always, runs last) |

## Process

1. **Classify** — read the task and match it against the Routing Table
   below. List every specialist whose scope is touched. Prefer the smallest
   set that covers the change. If the task is a pure question/explanation
   with no code change, just answer it — do not dispatch anyone.
   - Fallback: if the task touches a file owned by none of the specialists
     (e.g. a brand new page/route not yet in the roster), implement that
     part yourself following the same rules (CSS variable classes, Tailwind
     responsive prefixes, min-h-[44px] touch targets) instead of guessing
     an agent.

2. **Order into waves**:
   - Wave 1 (dependencies): backend-agent if an API contract is changing,
     and/or shared-agent if a shared component/context/service signature is
     changing. These must land first so downstream agents see the new shape.
   - Wave 2 (independent specialists): all remaining matched page/component
     agents. These touch disjoint files — dispatch together.
   - Never put two specialists that touch the same file in the same wave.

3. **Dispatch** — for each specialist in a wave:
   - Read `.claude/commands/<agent>.md` in full
   - Call the Agent tool with subagent_type: "general-purpose", description
     set to the agent's name, and a prompt built from:
     that file's full content, followed by a `## Current Task` section
     containing only the slice of the user's request relevant to this agent
     (plus any contract details handed down from a Wave 1 agent's report)
   - Issue all Agent calls for a wave in a single message so they run in
     parallel. Wait for the wave to finish before starting the next.

4. **Standard Closing Tasks** (always, per CLAUDE.md — never skip, even if
   the user didn't ask for them):
   - If the user explicitly said "run tests": dispatch test-agent first
   - Dispatch test-enricher-agent (it reads git diff / modified files from
     every wave above and adds coverage)
   - Dispatch readme-agent (updates README based on the same diff)
   - Run these sequentially, after all feature waves are done — both read
     the overall diff, so they shouldn't run before the code exists

5. **Final validation** — dispatch qa-agent (tsc --noEmit + build, plus
   a backend import check if any backend/ files changed in Wave 1)

6. **Branch + PR** — dispatch pr-agent last, after qa-agent completes. Tell
   it which files were touched across all waves (including this file/
   CLAUDE.md if the orchestrator made fallback edits) and pass along
   qa-agent's result for the PR's Test plan section. If qa-agent reported
   no app code changed (e.g. a docs/process-only task), say so so pr-agent
   can write "N/A — docs/process only".

7. **Report** — one consolidated summary covering:
   - Which specialists were dispatched, in which waves, and what each changed
   - test-enricher-agent: tests added, pass/fail counts
   - readme-agent: sections updated
   - qa-agent: build/tsc status
   - pr-agent: branch name and PR URL
   - Any unresolved follow-ups a specialist flagged

## Routing Table
- frontend/src/pages/Dashboard.tsx -> dashboard-agent
- frontend/src/pages/Editor.tsx, components/ResumeEditor.tsx, ResumePreview.tsx, StreamingOutput.tsx -> editor-agent
- frontend/src/pages/Home.tsx, components/ResumeUploader.tsx -> home-agent
- frontend/src/pages/CoverLetterEditor.tsx -> cover-letter-agent
- frontend/src/pages/Settings.tsx, components/settings/** -> settings-agent
- frontend/src/components/Navbar.tsx -> nav-agent
- frontend/src/components/AuthModal.tsx, Modal.tsx -> modal-agent
- frontend/src/App.tsx, index.css, contexts/AuthContext.tsx, lib/supabase.ts,
  services/*.ts, components/ExportMenu.tsx, EmptyState.tsx, ErrorBoundary.tsx,
  pages/NotFound.tsx, ServerError.tsx -> shared-agent
- backend/** (routes, services, prompts, models, main.py) -> backend-agent

## Rules
- Keep each dispatched prompt scoped to ONLY that agent's files + the
  relevant slice of the task — do not paste the entire user request verbatim
  if only part of it applies to that agent
- Don't dispatch agents whose scope isn't touched by the task
- If a specialist's report says a follow-up is needed from another agent,
  add that agent to the next wave with the specific follow-up as its task
- All global CLAUDE.md rules (no npm test/pytest unless asked, mobile
  responsive conventions, CSS variable classes, etc.) apply to every
  dispatched specialist — they're already baked into each agent's file,
  but don't override them in the per-agent task you write
