# 10 — Safe reading

[← Back to Logs Index](readme.md)

## Overview

Visitor-independent civil keys, server-clock plus monotonic elapsed labels,
visible-only bounded polling, resume/revocation/cache isolation, complete names,
keyboard dialog focus and 360px touch. Manual screen-reader/real user evidence
will remain pending if unavailable; no substitute screenshot claim.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| tests-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionRefresh.test.tsx tests/unit/collectionVisibility.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm --filter backend exec vitest run tests/integration/collectionPublic.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck` | Exit 0 | [10-phase-safe-reading/tests-run-1.log](10-phase-safe-reading/tests-run-1.log) |

| browser-1 | `pnpm --filter frontend exec playwright test tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [10-phase-safe-reading/browser-run-1.log](10-phase-safe-reading/browser-run-1.log) |

| browser-2 | `pnpm --filter frontend exec playwright test tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [10-phase-safe-reading/browser-run-2.log](10-phase-safe-reading/browser-run-2.log) |

| browser-3 | `pnpm --filter frontend exec playwright test tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 0 | [10-phase-safe-reading/browser-run-3.log](10-phase-safe-reading/browser-run-3.log) |

| gate-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx tests/unit/collectionRefresh.test.tsx tests/unit/collectionVisibility.test.tsx && pnpm --filter backend exec vitest run tests/integration/collectionPublic.test.ts tests/integration/calendar-phase7.test.ts tests/integration/birthdayCalendar.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [10-phase-safe-reading/gate-run-1.log](10-phase-safe-reading/gate-run-1.log) |

| clock-fix-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx tests/unit/collectionRefresh.test.tsx && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [10-phase-safe-reading/clock-fix-run-1.log](10-phase-safe-reading/clock-fix-run-1.log) |

| final-gate-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/collectionRefresh.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [10-phase-safe-reading/final-gate-run-1.log](10-phase-safe-reading/final-gate-run-1.log) |

| timezone-matrix-1 | `for zone in UTC Australia/Sydney Pacific/Auckland America/Los_Angeles; do TZ="$zone" pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts tests/integration/collectionPublic.test.ts || exit; TZ="$zone" pnpm --filter frontend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionRefresh.test.tsx || exit; done` | Exit 0 | [10-phase-safe-reading/timezone-matrix-run-1.log](10-phase-safe-reading/timezone-matrix-run-1.log) |

| denied-fix-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/collectionRefresh.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm --filter frontend typecheck && pnpm lint` | Exit 0 | [10-phase-safe-reading/denied-fix-run-1.log](10-phase-safe-reading/denied-fix-run-1.log) |

## Errors & Fixes

Lint rejected impure render-time monotonic calls and synchronous effect state
updates. Clock receipts now occur at the asynchronous query boundary; elapsed
labels update from external query-cache events, without an extra interval.
Expanded denial test exposed resetting an active observer by removing its Query:
remove the denied payload while retaining its error state instead. Tests now
prove transient stale → revoked payload removal. Browser fixture corrections:
legacy maxEvents minimum is 5; collection cells show two names then +30, not +29.

## Task Progress

T054 started. Prior hook tests already prove account separation, admin-only
catalogue, offscreen inactivity, immediate resume and 30s midnight range update.
T057/T059–T065 checked with actual hook/browser/API evidence. Cache lifecycle
assertions live primarily in `collectionHooks.test.tsx`, with classification in
`collectionVisibility.test.tsx`; no unrelated provider query cache is cleared.
T055/T056/T058/T066/T067 retain incomplete exact coverage/file-placement items.
T068/T069 remain pending for real manual assistive-technology evidence.

## Phase Checkpoint

Automated reading checkpoint passed: 32 backend provider/birthday/public tests,
12 focused frontend tests including actual logout/stale/revocation, both
typechecks, and full Node 24 lint. Four process timezones each passed 12 backend
and 6 frontend date/privacy checks. LA Chromium and Auckland 360px WebKit each
read 32 80-character same-colour names, complete month detail, focus trapping/
restoration and light/dark/reduced-motion without horizontal overflow.
This is browser automation, not a human screen-reader study. Human gates pending.
