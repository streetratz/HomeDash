# 22 — Pull Request Preparation

[Back to Logs Index](readme.md)

## Table of Contents

- [Scope](#scope)
- [Reviews](#reviews)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Scope

Owner authorized PR creation, work-item update, merge after CI passes, then
feature-branch cleanup and stopping this task's local preview. Fetched
origin/main matches the reviewed local main. Main Version advances 3.2.14 →
3.2.15 using the repository version tool; release remains 3.2.12.

## Reviews

Final code-review-standard and design-taste/emil-design-eng results from phase
21 apply to the unchanged runtime diff. Reviewed the only additional product
surfaces: versions.json.main and blue README badge change together; release
version/package/green badge unchanged. No new significant finding. Existing
minor terminology cleanup and physical-device/assistive evidence gaps remain.
No separate widget, no settings-editor modal; icon/colour palettes are anchored.

## Commands Run

Node 24.18.0 / pnpm 11, no dependency changes. Raw outputs retained in
`22-phase-pr-preparation/`.

| Command | Result | Output |
| --- | --- | --- |
| `node scripts/version-state.mjs validate-pr origin/main` | Passed, Main 3.2.15 / Release 3.2.12 | [validation-run-1.log](22-phase-pr-preparation/validation-run-1.log) |
| `pnpm --filter backend test` | 835 passed / 73 suites, includes all migration and backup suites | Same log |
| `pnpm --filter frontend test:unit` | 179 passed / 43 suites | Same log |
| `pnpm typecheck && pnpm build` | Passed both packages | Same log |
| `pnpm --filter frontend exec playwright test collections` | 9 passed, desktop Chromium / mobile WebKit | Same log |
| `pnpm lint` | Zero errors / warnings | Same log |
| `pnpm test:upgrade`, repository-local TMPDIR | Passed, migrations 32 → 35, 28 baseline tables preserved, zero FK violations, original admin login retained | [upgrade-run-1.log](22-phase-pr-preparation/upgrade-run-1.log) |

## Errors & Fixes

No failure in this phase. Existing build chunk-size warnings remain; phase 21
documents earlier intermittent test/wrapper failures and unchanged reruns.

## Phase Checkpoint

Final gates passed. Version/badge and audit-only changes since the independently
reviewed runtime candidate. Ready to commit, push and open a PR closing #19.
Merge remains conditional on passing CI for the exact pushed candidate.
