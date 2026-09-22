# 04 — Phase User Story 2: Shell Customization + Theme

[<- Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: vitest (PASS)](#run-1-vitest-pass)
- [Run 2: backend-tsc (PASS)](#run-2-backend-tsc-pass)
- [Run 3: frontend-tsc (PASS)](#run-3-frontend-tsc-pass)
- [E2E Status](#e2e-status)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 04 — User Story 2: Shell Customization + Theme  
**Task range**: T061–T077, T122–T125  
**Date/Time**: 2026-02-21 ~18:00 (evening session)  
**Purpose**: Per-user preferences (theme, dashboard selection), global shell settings (title, clocks, footer, unauth dashboard), logo/favicon upload, dark-mode support.

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `cd backend && pnpm test` | ✅ PASS — 73/73 across 8 files | [04-phase-shell-customization-theme/vitest-run-1.log](04-phase-shell-customization-theme/vitest-run-1.log) |
| 2 | `cd backend && pnpm run typecheck` | ✅ PASS — 0 errors (src + tests) | [04-phase-shell-customization-theme/backend-tsc-run-1.log](04-phase-shell-customization-theme/backend-tsc-run-1.log) |
| 3 | `cd frontend && npx tsc --noEmit` | ✅ PASS — 0 errors | [04-phase-shell-customization-theme/frontend-tsc-run-1.log](04-phase-shell-customization-theme/frontend-tsc-run-1.log) |
| 4 | `cd frontend && playwright test` | ⚠️ SKIPPED — requires live server | — |

## Run 1: vitest (PASS)

**Command**: `cd backend && pnpm test`  
**Time**: 2026-02-21 ~18:10  
**Exit**: 0  

73 tests across 8 files. All passing. Cumulative run includes all tests from Phases 2–4.

| Test file | Tests | Result |
|-----------|-------|--------|
| `tests/contract/openapi.test.ts` | 11 | ✅ |
| `tests/integration/firstRun.test.ts` | 5 | ✅ |
| `tests/integration/auth.test.ts` | 13 | ✅ |
| `tests/integration/publicBootstrap.test.ts` | 8 | ✅ |
| `tests/integration/rateLimit.test.ts` | 2 | ✅ |
| `tests/integration/adminShell.test.ts` | 14 | ✅ |
| `tests/integration/userPreferences.test.ts` | 11 | ✅ |
| `tests/integration/logoUpload.test.ts` | 9 | ✅ |
| **Total** | **73** | **✅ PASS** |

**Known non-fatal stderr**: During `logoUpload.test.ts`, `sharp` logs favicon generation warnings for synthetic test buffers. These are caught at `warn` level; all 9 tests pass. No fix required.

**New test coverage added this phase**:

- **`userPreferences.test.ts`** (11 tests): GET/PUT auth guards, CSRF checks, `themeMode` update/persist/revert, schema validation, partial updates, null `webDashboardId`.
- **`adminShell.test.ts`** (14 tests): GET/PUT auth guards, CSRF, field updates (title, clocks, footer, unauth dashboard IDs), timezone limits (max 5 extra), strict schema rejection.
- **`logoUpload.test.ts`** (9 tests): Auth guards, PNG/JPEG acceptance → 201 with asset shape, `logoAssetId` update, `/favicon.ico` response, `logoUrl` in bootstrap, 415 (non-image), 413 (>5 MiB).

## Run 2: backend-tsc (PASS)

**Command**: `cd backend && pnpm run typecheck`  
**Time**: 2026-02-21 ~18:15  
**Exit**: 0  

0 errors across `src/` and `tests/`.

## Run 3: frontend-tsc (PASS)

**Command**: `cd frontend && npx tsc --noEmit`  
**Time**: 2026-02-21 ~18:20  
**Exit**: 0  

0 errors. New components (`ClockStrip`, `ThemeToggle`, `UserMenu`, `ShellLayout`), new pages (`SettingsPage`), and state modules (`settings.ts`, `bootstrap.ts`) all type-check clean.

## E2E Status

Playwright E2E specs were **written** but not executed (require a live server).

| File | Covers | Tests |
|------|--------|-------|
| `tests/e2e/theme.spec.ts` | T064 | 2 |
| `tests/e2e/shellSettings.spec.ts` | T065 | 3 |

All specs include `test.skip()` guards for server-less environments.

## Errors & Fixes

*No errors recorded in automated tests. Three runtime bugs were discovered during Phase 5 Docker-based human testing and fixed before Phase 5 sign-off (see Phase 05 log for details).*

## Phase Checkpoint

✅ **PASS** — 73/73 tests passing; all TypeScript checks clean; E2E specs written. Proceed to Phase 5 Docker validation.
