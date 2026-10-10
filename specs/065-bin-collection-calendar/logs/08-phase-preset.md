# 08 — Household preset

[← Back to Logs Index](readme.md)

## Overview

T024–T042. Foundation committed as `f96aecf`.
Require protected private/config mutations, exact public widget context/subset,
strict date windows, offline four-Wednesday preset, Calendar-only UI and exact
collection-enabled fullscreen provider selection. Never seed live data.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| http-red-1 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts` | Exit 1 | [08-phase-preset/http-red-run-1.log](08-phase-preset/http-red-run-1.log) |

| http-green-1 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts` | Exit 0 | [08-phase-preset/http-green-run-1.log](08-phase-preset/http-green-run-1.log) |

| backend-tsc-1 | `pnpm --filter backend typecheck` | Exit 2 | [08-phase-preset/backend-tsc-run-1.log](08-phase-preset/backend-tsc-run-1.log) |

| http-expanded-1 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts && pnpm --filter backend typecheck && pnpm lint` | Exit 1 | [08-phase-preset/http-expanded-run-1.log](08-phase-preset/http-expanded-run-1.log) |

| http-expanded-2 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts && pnpm --filter backend typecheck && pnpm lint` | Exit 2 | [08-phase-preset/http-expanded-run-2.log](08-phase-preset/http-expanded-run-2.log) |

| frontend-red-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx` | Exit 1 | [08-phase-preset/frontend-red-run-1.log](08-phase-preset/frontend-red-run-1.log) |

| preset-red-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx` | Exit 1 | [08-phase-preset/preset-red-run-1.log](08-phase-preset/preset-red-run-1.log) |

| current-gates-1 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm lint` | Exit 2 | [08-phase-preset/current-gates-run-1.log](08-phase-preset/current-gates-run-1.log) |

| current-gates-2 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm lint` | Exit 2 | [08-phase-preset/current-gates-run-2.log](08-phase-preset/current-gates-run-2.log) |

| current-gates-3 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm lint` | Exit 1 | [08-phase-preset/current-gates-run-3.log](08-phase-preset/current-gates-run-3.log) |

| current-gates-4 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm lint` | Exit 2 | [08-phase-preset/current-gates-run-4.log](08-phase-preset/current-gates-run-4.log) |

| current-gates-5 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm lint` | Exit 0 | [08-phase-preset/current-gates-run-5.log](08-phase-preset/current-gates-run-5.log) |

| manager-tests-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx` | Exit 0 | [08-phase-preset/manager-tests-run-1.log](08-phase-preset/manager-tests-run-1.log) |

| playwright-1 | `pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [08-phase-preset/playwright-run-1.log](08-phase-preset/playwright-run-1.log) |

| playwright-2 | `pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [08-phase-preset/playwright-run-2.log](08-phase-preset/playwright-run-2.log) |

| playwright-3 | `pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 0 | [08-phase-preset/playwright-run-3.log](08-phase-preset/playwright-run-3.log) |

| checkpoint-1 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts tests/integration/collectionPreset.test.ts tests/integration/collectionBackup.test.ts tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts tests/unit/publicVisibility.test.ts && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionCalendar.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionDates.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [08-phase-preset/checkpoint-run-1.log](08-phase-preset/checkpoint-run-1.log) |

| checkpoint-2 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts tests/integration/collectionPreset.test.ts tests/integration/collectionBackup.test.ts tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionCalendar.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionDates.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [08-phase-preset/checkpoint-run-2.log](08-phase-preset/checkpoint-run-2.log) |

| hook-tests-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx && pnpm --filter frontend typecheck` | Exit 0 | [08-phase-preset/hook-tests-run-1.log](08-phase-preset/hook-tests-run-1.log) |

| final-gate-1 | `pnpm --filter backend exec vitest run tests/contract/collections.test.ts tests/integration/collectionPublic.test.ts tests/integration/collectionPreset.test.ts tests/integration/collectionBackup.test.ts tests/integration/calendar-phase7.test.ts tests/integration/birthdayCalendar.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/publicBootstrap.test.ts tests/integration/backup.test.ts && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx tests/unit/collectionCalendar.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionDates.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [08-phase-preset/final-gate-run-1.log](08-phase-preset/final-gate-run-1.log) |

| final-lint-1 | `node --version && pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx tests/unit/CollectionManager.test.tsx && pnpm lint` | Exit 0 | [08-phase-preset/final-lint-run-1.log](08-phase-preset/final-lint-run-1.log) |

| midnight-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx && pnpm lint` | Exit 1 | [08-phase-preset/midnight-run-1.log](08-phase-preset/midnight-run-1.log) |

| midnight-2 | `pnpm --filter frontend exec vitest run tests/unit/collectionHooks.test.tsx && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 0 | [08-phase-preset/midnight-run-2.log](08-phase-preset/midnight-run-2.log) |

## Errors & Fixes

HTTP red tests preceded registration; frontend group/key/preset red tests
preceded those components. Expanded lifecycle tests and browser paths were
added after the first implementation: their initial browser failures were
fixture locator/orderIndex errors, not pre-implementation evidence. T029
remains pending for its historical test-first requirement; T042 remains open
for that dependency, despite the successful automated checkpoint.

Typechecks exposed exact-optional-prop, shadowed-window and literal HTTP method
issues, all corrected. Lint exposed unnecessary test assertions/import-type and
require-await issues, corrected without disables. An initial durability fixture
lacked a first-run admin; it now uses the supported first-run endpoint. Mixed
Supertest/inject after rate-limit probing produced a socket reset; revocation
checks now use in-process inject consistently. Fake timers must be installed
before the query interval: corrected the deterministic midnight test setup.

## Task Progress

- T024 complete: red/green role/privacy/date/durability obligations recorded.
- T025–T028 and T030–T041 validated and checked. Midnight/range query evidence is
  additionally in `collectionHooks.test.tsx`, not just the rendering file.
- T029/T042 remain open: Chromium and 360px mobile WebKit paths pass, but were
  not historically written before implementation. No fabricated TDD claim.

## Phase Checkpoint

Automated MVP checkpoint passed: 60 backend preset/provider/birthday/public/
backup regression tests, 17 frontend tests, both typechecks, Chromium and mobile
WebKit offline setup/read/reload, and full Node 24 lint with zero warnings.
Closing/reopening the real disposable SQLite connection preserves IDs, rules,
provider/birthday records and widget selections. No live data/server touched.
Historical test-order residual above does not imply a runtime failure.
