# 06 — Setup

[← Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Task range**: T001–T004  
**Date**: 2026-10-10  
Implementation and local phase commits are explicitly authorised. No push, PR,
merge, release, dependency-PR action or version preparation is authorised.
Planning snapshot `7d856d1` starts with a clean worktree on branch
`065-bin-collection-calendar`. All 16 requirements checklist items passed.
Root/scoped instructions, constitution and all feature design inputs read.
Use only synthetic test data and existing dependencies. Node 24.18.0 is available.
Current Playwright config manages its own isolated E2E server; scoped historical
comments about a commented-out server are not followed.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| baseline-1 | `node --version; pnpm --version; pnpm --filter backend exec vitest run tests/integration/calendar-phase7.test.ts tests/integration/birthdayCalendar.test.ts tests/integration/backup.test.ts tests/unit/birthdayCalendar.test.ts && pnpm --filter frontend exec vitest run src/lib/calendarDates.test.ts src/components/settings/__tests__/CalendarSourceEditing.test.tsx` | Exit 0 | [06-phase-setup/baseline-run-1.log](06-phase-setup/baseline-run-1.log) |

| prettier-1 | `pnpm format:check` | Exit 1 | [06-phase-setup/prettier-run-1.log](06-phase-setup/prettier-run-1.log) |

| prettier-new-1 | `pnpm exec prettier --write backend/tests/helpers/collectionFixtures.ts frontend/tests/e2e/helpers/collections.ts` | Exit 0 | [06-phase-setup/prettier-new-run-1.log](06-phase-setup/prettier-new-run-1.log) |

| tsc-1 | `pnpm typecheck` | Exit 0 | [06-phase-setup/tsc-run-1.log](06-phase-setup/tsc-run-1.log) |

| eslint-1 | `node --version && pnpm lint` | Exit 0 | [06-phase-setup/eslint-run-1.log](06-phase-setup/eslint-run-1.log) |

## Errors & Fixes

1. Initial checklist inspection used unavailable `python`; rerun with `python3`
   passed (16 complete, zero incomplete). No implementation effect.
2. Inspection assumed a `db.ts` helper and E2E `helpers/` directory. Neither
   exists. Reuse global isolated Vitest setup and existing HTTP/auth helpers.
3. Formatter baseline exits 1 with 266 existing findings. Retained raw baseline;
   do not reformat unrelated source/generated files. This is not a failing
   application test. Changed new source files will be individually formatted.

## Phase Checkpoint

✅ Setup complete: T001–T004 checked after fixture typechecks and full Node 24
lint passed. Calendar/backup baseline: 43 backend and four frontend tests pass.
New fixture files formatted. Existing formatter baseline remains documented.
Ignore files verified against the actual private Node/Docker workspace;
no publishing, Terraform or Helm configuration exists requiring new ignores.
