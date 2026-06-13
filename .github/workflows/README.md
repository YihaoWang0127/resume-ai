# Release Automation

This repo automatically tags and publishes a GitHub Release on every push
to `main`, based on [Conventional Commits](https://www.conventionalcommits.org/)
prefixes. There is no release-please, no Release PR, and no changelog file —
the tag and release are created instantly on push.

## Workflow: `release.yml`

**Trigger:** every push to `main`.

**What it does:**
1. Finds the most recent tag (or starts from `v0.0.0` if there is none yet).
2. Scans the commit messages between that tag and `HEAD`.
3. Picks the highest-priority version bump found:
   - `feat!:` / `fix!:` / any commit with a `BREAKING CHANGE:` footer → **MAJOR**
   - `feat:` → **MINOR**
   - `fix:` → **PATCH**
   - anything else (`docs:`, `chore:`, `test:`, `refactor:`, etc. only) → no release
4. If a bump applies, creates and pushes the new tag (e.g. `v1.2.0`) and
   publishes a GitHub Release for it via
   [`softprops/action-gh-release@v2`](https://github.com/softprops/action-gh-release),
   with release notes auto-generated from the commits/PRs in that range.

This matches the commit prefix convention already used in this repo
(see the root `CLAUDE.md` → Conventions).

## Permissions

- `contents: write` — create and push the new tag and publish the release.

## Notes

- If PRs are squash-merged into `main`, make sure the squash commit
  message (or PR title) follows the `feat:` / `fix:` / `feat!:` convention —
  that's the message this workflow sees when scanning commits on `main`.
- Pushing the release tag with the default `GITHUB_TOKEN` does **not**
  re-trigger other workflows (a GitHub Actions limitation). If a downstream
  workflow needs to run off the release tag (e.g. a deploy step), pass a
  personal access token via `with: token:` instead.
