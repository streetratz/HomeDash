# 01 — Implementation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Implementation  
**Task range**: T001–T033  
**Date/Time**: 2026-09-19 07:25 AEST  
**Purpose**: Implement mobile panel containment, editable Stocks holdings, and static
ICS import/re-import.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm --filter backend db:generate` | ✅ PASS | [01-phase-implementation/drizzle-run-1.log](01-phase-implementation/drizzle-run-1.log) |
| 2 | `pnpm --filter frontend typecheck` | ❌ FAIL | [01-phase-implementation/frontend-tsc-run-1.log](01-phase-implementation/frontend-tsc-run-1.log) |
| 3 | `pnpm --filter backend typecheck` | ⚠️ BASELINE FAIL | [01-phase-implementation/backend-tsc-run-1.log](01-phase-implementation/backend-tsc-run-1.log) |
| 4 | `pnpm --filter frontend typecheck` | ✅ PASS | [01-phase-implementation/frontend-tsc-run-2.log](01-phase-implementation/frontend-tsc-run-2.log) |
| 5 | `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` | ✅ PASS | [01-phase-implementation/backend-tsc-run-2.log](01-phase-implementation/backend-tsc-run-2.log) |
| 6 | `pnpm --filter backend exec vitest run tests/integration/ical-parser.test.ts` | ❌ FAIL | [01-phase-implementation/vitest-backend-run-1.log](01-phase-implementation/vitest-backend-run-1.log) |
| 7 | `pnpm --filter backend exec vitest run tests/integration/ical-parser.test.ts` | ✅ PASS | [01-phase-implementation/vitest-backend-run-2.log](01-phase-implementation/vitest-backend-run-2.log) |
| 8 | `pnpm --filter frontend test:unit` | ✅ PASS | [01-phase-implementation/vitest-frontend-full-run-2.log](01-phase-implementation/vitest-frontend-full-run-2.log) |
| 9 | `pnpm --filter backend exec vitest run tests/integration/ical-parser.test.ts tests/integration/calendar-phase7.test.ts` | ✅ PASS | [01-phase-implementation/vitest-backend-run-4.log](01-phase-implementation/vitest-backend-run-4.log) |
| 10 | `pnpm build` | ✅ PASS | [01-phase-implementation/pnpm-build-run-1.log](01-phase-implementation/pnpm-build-run-1.log) |
| 11 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | ✅ PASS | [01-phase-implementation/eslint-run-1.log](01-phase-implementation/eslint-run-1.log) |
| 12 | `pnpm --filter frontend test:unit` | ✅ PASS — 55 tests | [01-phase-implementation/vitest-frontend-full-run-3.log](01-phase-implementation/vitest-frontend-full-run-3.log) |
| 13 | `pnpm --filter backend exec vitest run tests/integration/ical-parser.test.ts tests/integration/calendar-phase7.test.ts` | ✅ PASS — 44 tests | [01-phase-implementation/vitest-backend-run-5.log](01-phase-implementation/vitest-backend-run-5.log) |
| 14 | `pnpm build` | ✅ PASS | [01-phase-implementation/pnpm-build-run-2.log](01-phase-implementation/pnpm-build-run-2.log) |
| 15 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | ✅ PASS — zero warnings | [01-phase-implementation/eslint-run-3.log](01-phase-implementation/eslint-run-3.log) |
| 16 | Production Docker build and isolated container smoke test | ✅ PASS — healthy container, migrations, ICS create/re-import/readback | [01-phase-implementation/docker-smoke-run-1.log](01-phase-implementation/docker-smoke-run-1.log) |
| 17 | `pnpm --filter backend exec vitest run tests/integration/backup.test.ts tests/integration/restore.test.ts` | ✅ PASS — 14 tests | [01-phase-implementation/vitest-backup-restore-run-1.log](01-phase-implementation/vitest-backup-restore-run-1.log) |
| 18 | `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` | ✅ PASS | [01-phase-implementation/backend-tsc-run-3.log](01-phase-implementation/backend-tsc-run-3.log) |
| 19 | `pnpm build` | ✅ PASS | [01-phase-implementation/pnpm-build-run-3.log](01-phase-implementation/pnpm-build-run-3.log) |
| 20 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | ✅ PASS — zero warnings | [01-phase-implementation/eslint-run-4.log](01-phase-implementation/eslint-run-4.log) |
| 21 | Supplied portable backup restore in Docker | ✅ PASS — unchanged JSON, 10 widgets, zero FK violations | [01-phase-implementation/docker-portable-restore-run-1.log](01-phase-implementation/docker-portable-restore-run-1.log) |
| 22 | Final `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | ✅ PASS — zero warnings | [01-phase-implementation/eslint-run-5.log](01-phase-implementation/eslint-run-5.log) |
| 23 | `main` → branch Docker volume upgrade | ✅ PASS — migration 0029, identical config hashes, zero FK violations | [01-phase-implementation/docker-upgrade-migration-run-1.log](01-phase-implementation/docker-upgrade-migration-run-1.log) |
| 24 | `pnpm --filter frontend test:unit` | ✅ PASS — 59 tests | [01-phase-implementation/vitest-frontend-full-run-4.log](01-phase-implementation/vitest-frontend-full-run-4.log) |
| 25 | `pnpm --filter backend test` | ✅ PASS — 716 tests | [01-phase-implementation/vitest-backend-full-run-1.log](01-phase-implementation/vitest-backend-full-run-1.log) |
| 26 | `pnpm build` | ✅ PASS | [01-phase-implementation/pnpm-build-run-4.log](01-phase-implementation/pnpm-build-run-4.log) |
| 27 | `pnpm test:upgrade` | ✅ PASS — migrations 29 → 30, 27 tables preserved | [01-phase-implementation/docker-upgrade-gate-run-1.log](01-phase-implementation/docker-upgrade-gate-run-1.log) |
| 28 | Final candidate supplied-backup restore | ✅ PASS — credentials sanitized, zero FK violations | [01-phase-implementation/docker-portable-restore-run-2.log](01-phase-implementation/docker-portable-restore-run-2.log) |
| 29 | Final code and UI review | ✅ PASS — all significant findings resolved | [01-phase-implementation/final-review-run-1.log](01-phase-implementation/final-review-run-1.log) |
| 30 | Final `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | ✅ PASS — zero warnings | [01-phase-implementation/eslint-run-6.log](01-phase-implementation/eslint-run-6.log) |

## Errors & Fixes

1. `git log --follow` was initially invoked with two pathspecs. Git requires exactly
   one path with `--follow`; the history audit was rerun without relying on that output.
2. The first frontend typecheck rejected an explicit `undefined` assignment under
   `exactOptionalPropertyTypes`; empty lots now persist as an empty array.
3. The full backend typecheck reports existing strictness errors in untouched
   backup/restore and public snapshot tests. Backend source typecheck, build, and the
   affected integration suites pass.
4. The first ICS test run exposed an all-day timezone shift and a missing test import.
   Date-only values now serialize from local calendar components to UTC midnight, and
   the corrected suite passes.
5. A Docker build forced through `registry.npmjs.org` failed with `ECONNRESET` under
   the local network policy. The Dockerfile's default Microsoft package feed proxy
   completed the production build successfully.
6. The supplied portable backup exposed two pre-existing restore defects: password
   hashes were excluded without restore-time replacement, and dependent records were
   inserted before dashboards/OAuth parents. #216 and #217 track the fixes.
7. Portable credential field names did not match the persisted OAuth/CalDAV columns.
   Exports now omit the actual encrypted fields, and restore always forces those
   integrations into a re-authentication-required state.
8. Final review found additional persisted Pi-hole, UniFi, and integration client
   credentials. Portable export now strips all of them and restore writes safe empty
   credential fields that require explicit reconfiguration.
9. Failed static ICS re-imports could replace source content before parsing completed.
   Replacement content, metadata, event upserts, and pruning now commit atomically.
10. UID validation originally ran only for generated occurrences. It now validates
    every VEVENT before recurrence expansion or date-window filtering.
11. Uploaded birthday files were excluded from all scheduled work, so future yearly
    occurrences could age into the 90-day window without materializing. Stored content
    is now reparsed locally once per day without outbound polling.
12. ISO timestamps were compared lexically to SQLite timestamps. Scheduler due checks
    now normalize stored timestamps with SQLite `datetime()`, with 23/25-hour boundary
    coverage.
13. Stock date validation was initially either too strict for historic Yahoo formats
    or too permissive for malformed input. The boundary now accepts valid ISO,
    `YYYYMMDD`, and `YYYY/MM/DD` dates while rejecting impossible or arbitrary values.

## UI Review

| Before | After | Why |
| --- | --- | --- |
| Opaque black widget sub-panels could cover the configured dashboard background | Shared translucent panel and header surfaces preserve the selected background | Maintains hierarchy and readability without replacing the user's visual identity |
| Stocks holdings were import-only and dense controls did not adapt cleanly to narrow screens | Expandable ticker/lot details use responsive stacked controls and explicit edit/remove actions | Keeps the primary portfolio view calm while making maintenance discoverable and touch-usable |
| Static birthday files had no dedicated import or re-import state | A focused file form and source action expose upload, replacement, validation, loading, and error states | Gives the workflow one clear focal point and makes failure recovery visible |
| No new motion was needed for these high-frequency settings interactions | Existing restrained transitions were retained; no decorative animation was added | Avoids slowing routine editing and respects the dashboard's established interaction language |

## Phase Checkpoint

✅ Complete. The implementation, final code/UI reviews, frontend and backend suites,
production build, isolated Docker restore, reusable upgrade gate, and final Node 22
zero-warning lint gate pass. The supplied portable backup restores unchanged with
sanitized credentials and zero foreign-key violations, and a populated `main` volume
upgrades through migration 0029 without configuration changes. Progress was recorded
on #180 and #214–#217; birthday CSV/manual/export remains tracked as #180 Phase 2.
