# Phase 7: Legacy Socket Upgrade Compatibility

[Back to phase index](./readme.md)

## Overview

Regression fix for [#208](https://github.com/streetratz/HomeDash/issues/208).
HomeDash v3.1.0 correctly made the Docker endpoint grammar fail closed, but it
did not reconcile existing `docker_connections` rows containing the
previously-valid absolute socket form `/var/run/docker.sock`.

The startup pass now normalizes only unambiguous absolute Unix socket paths to
`unix:///...`. It preserves connection IDs and widget links, is idempotent, and
leaves remote, ambiguous, and invalid endpoint values untouched. Request
validation remains strict, so new submissions without a scheme are rejected.

## Commands Run

Command output is captured in `07-phase-legacy-socket-upgrade/`.

| Command | Result | Sidecar |
|---|---|---|
| Targeted Docker endpoint and upgrade tests | ✅ 58 passed | `vitest-targeted-run-1.log` |
| Backend typecheck | ⚠️ Source passed; test typecheck reached existing unrelated backup/restore/public-snapshot errors | `backend-typecheck-run-1.log` |
| Full local lint gate | ✅ Zero errors and zero warnings in both pre-review and final pre-PR runs | `eslint-run-1.log`, `eslint-run-2.log` |
| Backend test suite | ✅ Baseline preserved: 685 passed, the same 3 calendar Phase 7 failures | `backend-vitest-run-1.log` |
| Backend production build | ✅ Bundle and declarations built | `backend-build-run-1.log` |

## Errors & Fixes

- The backend typecheck completed the source-code pass, then reported existing
  test-only errors in `backup.test.ts`, `restore.test.ts`, and
  `publicWidgetSnapshotCache.test.ts`. None were in the #208 implementation or
  regression tests.
- The full backend suite reported only the three established
  `calendar-phase7.test.ts` failures. All 685 other tests passed, including the
  new startup-upgrade coverage.

## Review

- **Code review:** no significant correctness, security, state-integrity, or
  maintainability findings. The update is transactional, preserves primary
  keys and links, and is idempotent.
- **Security boundary:** only trimmed absolute paths are normalized. Bare
  hosts, `http://`, relative paths, malformed endpoints, and all new
  scheme-less API input remain rejected.
- **UI/design applicability:** not applicable; no frontend files or behavior
  changed.
- **Lint gate:** passed with zero errors and zero warnings.

## Phase Checkpoint

✅ **Complete.** Implementation, regression coverage, code review,
documentation, lint, backend tests, and production build are complete under
[PR #210](https://github.com/streetratz/HomeDash/pull/210). Release promotion
and NAS deployment are intentionally deferred pending investigation of
[#209](https://github.com/streetratz/HomeDash/issues/209).
