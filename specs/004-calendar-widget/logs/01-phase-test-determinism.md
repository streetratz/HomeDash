# 01 — Calendar Test Determinism

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: Backend tests](#run-1-backend-tests)
- [Final Validation](#final-validation)
- [Review](#review)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Calendar test determinism  
**Task range**: GitHub issue #212  
**Date/Time**: 2026-09-18 22:35 AEST  
**Purpose**: Make the iCal sync integration tests independent of the wall clock and isolate them from source creation's asynchronous initial sync.

## Commands Run

| # | Command | Outcome | Log File |
|---|---|---|---|
| 1 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend test` | Failed: 3 calendar tests | [01-phase-test-determinism/vitest-run-1.log](01-phase-test-determinism/vitest-run-1.log) |
| 2 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/calendar-phase7.test.ts` | Failed: 2 remaining fixed-window parser assertions | [01-phase-test-determinism/vitest-run-2.log](01-phase-test-determinism/vitest-run-2.log) |
| 3 | Same targeted Vitest command after the second edit | Failed: unmatched test hook block | [01-phase-test-determinism/vitest-run-3.log](01-phase-test-determinism/vitest-run-3.log) |
| 4 | Same targeted Vitest command after syntax correction | Passed: 22/22 | [01-phase-test-determinism/vitest-run-4.log](01-phase-test-determinism/vitest-run-4.log) |
| 5 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend test` | Passed: 698/698 | [01-phase-test-determinism/vitest-run-7.log](01-phase-test-determinism/vitest-run-7.log) |
| 6 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend typecheck` | Failed on known unrelated test typing debt | [01-phase-test-determinism/backend-tsc-run-1.log](01-phase-test-determinism/backend-tsc-run-1.log) |
| 7 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec tsc --noEmit` | Passed | [01-phase-test-determinism/backend-tsc-run-3.log](01-phase-test-determinism/backend-tsc-run-3.log) |
| 8 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm build` | Passed | [01-phase-test-determinism/pnpm-build-run-1.log](01-phase-test-determinism/pnpm-build-run-1.log) |
| 9 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm format:check` | Failed on 280 pre-existing repository files | [01-phase-test-determinism/prettier-run-2.log](01-phase-test-determinism/prettier-run-2.log) |
| 10 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm exec prettier --check backend/tests/integration/calendar-phase7.test.ts` | Passed after isolated formatting | [01-phase-test-determinism/prettier-run-3.log](01-phase-test-determinism/prettier-run-3.log) |
| 11 | Final targeted Vitest command | Passed: 22/22 | [01-phase-test-determinism/vitest-run-9.log](01-phase-test-determinism/vitest-run-9.log) |
| 12 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm lint` | Passed: zero errors and warnings | [01-phase-test-determinism/eslint-run-3.log](01-phase-test-determinism/eslint-run-3.log) |

## Run 1: Backend tests

The baseline completed with 695 passing and 3 failing tests. All failures were in
`calendar-phase7.test.ts` and expected June 1, 2026 fixture events to be
upserted. The production sync window correctly began on July 1, 2026 when the
suite ran on September 18, so the parser returned no in-window events.

## Final Validation

- The iCal fixture day is generated 14 days ahead in UTC, safely within the
  production two-month-back through 90-days-forward window.
- Parser and API query bounds derive from the same generated date.
- The file defaults external fetches to an empty valid calendar.
- Explicit sync tests wait for source creation's automatic initial sync before
  replacing the fetch fixture.
- Targeted calendar tests pass 22/22.
- The full backend suite passes 698/698.
- Backend source typechecking and the complete production build pass.
- The mandatory repository lint gate passes with zero errors and warnings.
- The touched TypeScript file passes its direct Prettier check. The full
  repository format check remains a separate pre-existing baseline failure
  across 280 files.

## Review

The `code-review-standard` pass found no significant correctness,
state-integrity, security, performance, maintainability, or test-design
findings. Residual risk is limited to ordinary clock movement during a test
process; the fixture is 14 days from the captured module-load time and therefore
has ample margin from both production sync boundaries.

`design-taste` and `emil-design-eng` were run as requested. They are not
applicable to this branch because it changes no frontend, component, styling,
layout, interaction, or animation code.

## Errors & Fixes

1. **Fixed fixture dates aged out of the rolling sync window.**
   - Root cause: the test used fixed June 2026 iCal dates while production uses
     a rolling two-month-back through 90-days-forward window.
   - Fix: implemented runtime-relative UTC fixture dates and
     matching API query bounds.
2. **Initial source sync escaped test control.**
   - Root cause: source creation starts a fire-and-forget sync before the tests
     installed their fetch mocks, causing real 404 requests and closed-database
     teardown noise.
   - Fix: installed an empty-calendar fetch default and awaited the initial
     sync before each
     explicit sync assertion.
3. **Two direct parser tests retained the expired fixed query window.**
   - Root cause: the first edit updated sync/API tests but missed direct
     `fetchAndParseIcal()` calls.
   - Fix: changed those parser bounds to the shared generated range.
4. **Duplicate `afterAll` introduced a syntax error.**
   - Root cause: overlapping hook removal left an unmatched callback.
   - Fix: removed the duplicate declaration and reran the targeted file.
5. **Parallel formatting checks produced inconsistent results.**
   - Root cause: formatting and test processes accessed the same file
     concurrently.
   - Fix: formatted and verified the file sequentially, then reran all final
     read-only gates.

## Phase Checkpoint

Complete. Issue #212 is implemented, reviewed, and validated. The change is
ready for commit and pull request.
