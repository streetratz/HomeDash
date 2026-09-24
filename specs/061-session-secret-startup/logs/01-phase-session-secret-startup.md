# 01 - Session Secret Startup Fix

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 - Session Secret Startup Fix
**Task range**: T001-T005
**Date/Time**: 2026-09-24
**Purpose**: Restore production startup compatibility without reintroducing a known
session secret.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm --filter backend exec vitest run tests/unit/env.test.ts` | PASS (8/8) | [vitest-run-2.log](01-phase-session-secret-startup/vitest-run-2.log) |
| 2 | `pnpm --filter backend typecheck` | PASS | [backend-tsc-run-2.log](01-phase-session-secret-startup/backend-tsc-run-2.log) |
| 3 | `pnpm --filter backend build` | PASS | [pnpm-build-run-1.log](01-phase-session-secret-startup/pnpm-build-run-1.log) |
| 4 | `docker build -t homedash:session-secret-fix .` | PASS | [docker-build-run-1.log](01-phase-session-secret-startup/docker-build-run-1.log) |
| 5 | Production container create, replace, and persistent-secret comparison | PASS | [docker-runtime-run-1.log](01-phase-session-secret-startup/docker-runtime-run-1.log) |
| 6 | Node 24 SQLite native rebuild and ABI/version verification | PASS (`better-sqlite3` 11.10.0, ABI 137, SQLite 3.49.2) | [sqlite-rebuild-run-1.log](01-phase-session-secret-startup/sqlite-rebuild-run-1.log), [sqlite-verify-run-2.log](01-phase-session-secret-startup/sqlite-verify-run-2.log) |
| 7 | `pnpm --filter backend test` | PASS (61 files, 779 tests) | [vitest-run-8.log](01-phase-session-secret-startup/vitest-run-8.log) |
| 8 | `pnpm --filter frontend test` | PASS (32 files, 137 tests) | [frontend-vitest-run-2.log](01-phase-session-secret-startup/frontend-vitest-run-2.log) |
| 9 | `pnpm test` | PASS (backend and frontend) | [pnpm-test-run-1.log](01-phase-session-secret-startup/pnpm-test-run-1.log) |
| 10 | `pnpm typecheck` | PASS | [typecheck-run-2.log](01-phase-session-secret-startup/typecheck-run-2.log) |
| 11 | `pnpm build` | PASS | [pnpm-build-run-3.log](01-phase-session-secret-startup/pnpm-build-run-3.log) |
| 12 | `pnpm lint` | PASS (zero warnings) | [eslint-run-2.log](01-phase-session-secret-startup/eslint-run-2.log) |
| 13 | `pnpm test:upgrade` | PASS (32 migrations, 28 tables, zero FK violations) | [upgrade-gate-run-2.log](01-phase-session-secret-startup/upgrade-gate-run-2.log) |
| 14 | Version state and release workflow tests | PASS (12/12) | [version-check-run-2.log](01-phase-session-secret-startup/version-check-run-2.log), [release-version-test-run-2.log](01-phase-session-secret-startup/release-version-test-run-2.log), [release-workflow-test-run-2.log](01-phase-session-secret-startup/release-workflow-test-run-2.log) |
| 15 | `pnpm --filter frontend test:e2e` exploratory baseline | FAIL (42 unrelated legacy failures; tracked in #12) | [playwright-run-2.log](01-phase-session-secret-startup/playwright-run-2.log) |

## Errors & Fixes

1. `v3.2.10` required an explicit production secret and exited before health signaling.
   The fix creates and reuses a restricted random secret in the persistent data volume.
2. Initial Node 24 backend runs loaded a `better-sqlite3` binary compiled for Node 22
   ABI 127. Reinstall/rebuild shortcuts did not replace it, so the module was rebuilt
   directly under Node 24.18.0 and verified at ABI 137 before rerunning the full suite.
3. One full backend run had a transient OAuth `ECONNRESET`. The affected file passed
   alone, then the complete backend suite passed 779/779.
4. A duplicate frontend unit file retained stale Sonos browse expectations while the
   shipping implementation and colocated tests used the current behavior. Only the
   stale assertions were aligned; no production frontend code changed.
5. The exploratory Playwright run exposed 42 failures on unchanged `main` production
   frontend code. The required PR workflow does not run Playwright; the baseline repair
   is tracked separately in #12 and was explicitly accepted as non-blocking for this
   outage hotfix.

## Phase Checkpoint

Complete. The authoritative local PR/release suite, production container restart test,
Node/SQLite verification, and database upgrade gate are green. The unrelated optional
Playwright baseline is documented in #12.
