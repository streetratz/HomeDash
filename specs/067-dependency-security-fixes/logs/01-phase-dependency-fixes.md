# 01 — Dependency Fixes

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 01 — Dependency Fixes
**Task range**: T001–T005
**Date/Time**: 2026-10-16 (rerun after rebase onto `main` at `55d6730`)
**Purpose**: Replace Dependabot PRs #2 and #18 with one change that removes every
known-vulnerable `js-yaml` and `undici` version from the lockfile.

## Commands Run

| Command | Result |
| --- | --- |
| `pnpm install` | Lockfile regenerated; `js-yaml` 4.3.2, `undici` 6.29.0 / 7.30.0 / 8.10.2 |
| `pnpm -r why undici js-yaml --prod` | Production tree unchanged: only `undici` 8.10.2 (backend direct) |
| `pnpm --filter backend test` | Pre-existing `artCacheService` failures (4) plus one intermittent socket reset per run (see below) |
| `vitest run tests/contract/collections.test.ts` ×3 | 4 passed each run |
| `vitest run tests/integration/scheduledJobs.test.ts` ×3 | 8 passed each run |
| `pnpm --filter frontend test:unit` | 195 passed |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |
| `pnpm --filter frontend test:e2e` | 39 passed, 1 intentionally skipped |
| `pnpm lint` | Passed with zero warnings |
| `pnpm test:upgrade` | Passed: migrations 35 → 35, 32 tables preserved, 0 foreign-key violations |
| Container smoke test | `/healthz`, `/readyz`, `/api/public/bootstrap`, `/` all 200; container healthy |
| `pnpm --filter backend openapi:lint` | 5 errors, 39 warnings — identical to `main` (not a CI gate) |

## Errors & Fixes

- `tests/unit/artCacheService.test.ts` fails 4 cases locally. The same 4 cases fail
  identically on a clean `main` checkout in the same environment, and the suite
  passes in GitHub Actions. The service uses Node's built-in `fetch`, not the
  `undici` package, so the failure is environmental and unrelated to this change.
- After rebasing onto `release: v3.2.16`, two full backend runs each hit one
  intermittent `ECONNRESET` / `socket hang up` from supertest
  (`collections.test.ts` once, `scheduledJobs.test.ts` once, never both). Each
  file passes 3/3 in isolation. Supertest uses `node:http`, not the `undici`
  package, so these are load-related flakes rather than a regression; raw
  output is in `validation.log` and `backend-rerun.log`.
- `openapi:lint` reports the same 5 errors and 39 warnings on `main` and on this
  branch; the redocly upgrade introduces no new findings.
- `@redocly/cli` 1.34.17 (Dependabot PR #2) still pulled `js-yaml` 4.2.0 and
  `undici` 6.27.0, which carry high-severity advisories, so this change targets
  1.34.20 and adds overrides instead.

## Phase Checkpoint

Complete. The UI review is not applicable: the change touches only dependency
manifests and the lockfile, with no layout, styling, interaction, or animation
changes.
