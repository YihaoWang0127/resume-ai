# Release Automation

This repo uses [release-please](https://github.com/googleapis/release-please)
(via `googleapis/release-please-action@v4`) to automate versioning,
changelog generation, and GitHub Releases based on
[Conventional Commits](https://www.conventionalcommits.org/).

## Workflow: `release.yml`

**Trigger:** every push to `main`.

**What it does:**
1. Scans commit messages on `main` since the last release.
2. Opens or updates a "Release PR" containing:
   - The next version number (computed from commit prefixes)
   - An updated `CHANGELOG.md` summarizing the changes
3. When that Release PR is merged into `main`, the action runs again and:
   - Creates a Git tag (e.g. `v1.2.0`)
   - Publishes a GitHub Release with the changelog notes for that version

No manual version bumping or changelog editing is required.

## Commit prefix → version bump

release-please follows Conventional Commits to decide the next version:

| Commit prefix | Version bump |
|---|---|
| `fix:` | PATCH (1.0.0 → 1.0.1) |
| `feat:` | MINOR (1.0.0 → 1.1.0) |
| `feat!:` or any commit with a `BREAKING CHANGE:` footer | MAJOR (1.0.0 → 2.0.0) |
| `docs:`, `chore:`, `test:`, `refactor:`, etc. | No version bump (still recorded in changelog history) |

This matches the commit prefix convention already used in this repo
(see the root `CLAUDE.md` → Conventions).

## First run / bootstrapping

On the very first run, release-please has no prior release to compare
against. It will open a bootstrap Release PR that creates:
- `.release-please-manifest.json` — tracks the current released version
- `release-please-config.json` — release configuration (if not already present)
- An initial `CHANGELOG.md`

Merging that PR establishes the baseline version (starts at `0.1.0` for
`release-type: simple`) and all future pushes to `main` are diffed against it.

## Permissions

- `contents: write` — push the Release PR branch, create tags, and publish releases
- `pull-requests: write` — open and update the Release PR

## Notes

- The default `GITHUB_TOKEN` does **not** re-trigger other workflows when it
  pushes the Release PR commit or the release tag (a GitHub Actions
  limitation). If a downstream workflow needs to run off the release tag
  (e.g. a deploy or publish step), pass a personal access token via
  `with: token:` instead.
- If PRs are squash-merged into `main`, make sure the squash commit
  message (or PR title) follows the `feat:` / `fix:` / `feat!:` convention —
  that's the message release-please actually sees on `main`.
