# 01 — Setup & Baselines

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: ESLint](#run-1-eslint)
- [Run 1: TypeScript](#run-1-typescript)
- [Run 1: Backend Vitest](#run-1-backend-vitest)
- [Run 1: Redocly](#run-1-redocly)
- [Constitution Re-check](#constitution-re-check)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Setup & Baselines  
**Task range**: T001–T003  
**Date/Time**: 2026-09-18 14:45 AEST  
**Purpose**: Capture exact pre-implementation validation results for the
feature branch. The completion gate is no new findings relative to this phase,
not a clean repository-wide run.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm lint` | ⚠️ BASELINE — 81 problems (54 errors, 27 warnings) | [01-phase-setup-baselines/eslint-run-1.log](01-phase-setup-baselines/eslint-run-1.log) |
| 2 | `pnpm typecheck` | ⚠️ BASELINE — 23 backend-test errors | [01-phase-setup-baselines/backend-tsc-run-1.log](01-phase-setup-baselines/backend-tsc-run-1.log) |
| 3 | `pnpm --filter backend test` under Node 26 | ❌ INVALID ENVIRONMENT — native ABI mismatch | [01-phase-setup-baselines/vitest-run-1.log](01-phase-setup-baselines/vitest-run-1.log) |
| 4 | `pnpm --filter backend test` after native rebuild under Node 26 | ❌ INVALID ENVIRONMENT — native ABI mismatch persisted | [01-phase-setup-baselines/vitest-run-2.log](01-phase-setup-baselines/vitest-run-2.log) |
| 5 | `pnpm --filter backend test` after second Node 26 attempt | ❌ INVALID ENVIRONMENT — native ABI mismatch persisted | [01-phase-setup-baselines/vitest-run-3.log](01-phase-setup-baselines/vitest-run-3.log) |
| 6 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend test` | ⚠️ BASELINE — 638 pass, 3 known calendar failures | [01-phase-setup-baselines/vitest-run-4.log](01-phase-setup-baselines/vitest-run-4.log) |
| 7 | `pnpm --filter backend openapi:lint` | ⚠️ BASELINE — 5 errors, 39 warnings | [01-phase-setup-baselines/redocly-run-1.log](01-phase-setup-baselines/redocly-run-1.log) |

## Run 1: ESLint

81 findings: 54 errors and 27 warnings. This matches the feature planning
baseline.

## Run 1: TypeScript

23 errors, all in `backend/tests/integration/backup.test.ts` and
`backend/tests/integration/restore.test.ts`. Frontend typecheck passed.

## Run 1: Backend Vitest

Runs 1–3 were invalid because the active shell was Node 26 (ABI 147) while the
installed `better-sqlite3` binary was built for Node 22 (ABI 127). The
repository's intended runtime is Node 22; run 4 pinned local Node `v22.22.3`.

Valid baseline: 638 tests passed and the three known
`calendar-phase7.test.ts` tests failed.

## Run 1: Redocly

5 errors and 39 warnings, matching the planning baseline.

## Constitution Re-check

Phase 1 design remains conformant:

- the anonymous surface is registered only in `backend/src/api/public.ts`;
- every new public route is GET-only and read-only;
- existing authenticated route guards remain unchanged;
- visibility defaults to hidden and unknown widget types default to denied;
- authorization runs before cache lookup or outbound integration work;
- public source identities and integration configuration never enter public
  payloads.

No constitutional exception is required.

## Errors & Fixes

1. **Native module ABI mismatch**
   - **Observed**: Runs 1–3 failed before application setup because Node 26
     attempted to load a `better-sqlite3` binary compiled for Node 22.
   - **Root cause**: The interactive shell selected Node `v26.8.2`; this
     repository is developed and packaged on Node 22.
   - **Fix**: Pin all project commands in this implementation session to local
     Node `v22.22.3` by prepending its `bin` directory to `PATH`.
   - **Result**: Run 4 reached the expected baseline of three calendar failures.

## Phase Checkpoint

✅ Complete. Baselines are captured and the Phase 1 design remains compliant
with the constitution. No implementation behavior changed.
