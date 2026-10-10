# 09 — Custom regular streams

[← Back to Logs Index](readme.md)

## Overview

Custom-first entry, independently editable stable UUID/name/colour/weekday
sets/cycle/anchor, reorder/disable/removal with explicit confirmation. No new
stream is selected or published automatically. Carry forward T029's historical
test-order residual; it is not a failed runtime dependency.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| editor-red-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionStreamEditor.test.tsx` | Exit 1 | [09-phase-custom-streams/editor-red-run-1.log](09-phase-custom-streams/editor-red-run-1.log) |

| green-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionStreamEditor.test.tsx tests/unit/CollectionManager.test.tsx && pnpm --filter backend exec vitest run tests/integration/collectionCustom.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck` | Exit 2 | [09-phase-custom-streams/green-run-1.log](09-phase-custom-streams/green-run-1.log) |

| browser-1 | `pnpm --filter frontend exec playwright test tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [09-phase-custom-streams/browser-run-1.log](09-phase-custom-streams/browser-run-1.log) |

| browser-2 | `pnpm --filter frontend exec playwright test tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 0 | [09-phase-custom-streams/browser-run-2.log](09-phase-custom-streams/browser-run-2.log) |

| gate-1 | `pnpm --filter backend exec vitest run tests/integration/collectionCustom.test.ts tests/integration/collectionPreset.test.ts tests/unit/collectionService.test.ts tests/integration/calendar-phase7.test.ts && pnpm --filter frontend exec vitest run tests/unit/CollectionStreamEditor.test.tsx tests/unit/CollectionManager.test.tsx tests/unit/collectionHooks.test.tsx tests/unit/collectionCalendar.test.tsx && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 1 | [09-phase-custom-streams/gate-run-1.log](09-phase-custom-streams/gate-run-1.log) |

| lint-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionStreamEditor.test.tsx && node --version && pnpm lint` | Exit 0 | [09-phase-custom-streams/lint-run-1.log](09-phase-custom-streams/lint-run-1.log) |

## Errors & Fixes

Missing editor red run captured before implementation. Typecheck then required
explicit regular exceptions in a discriminated stream update; corrected without
casts. Client control-character regex failed lint: use character-code validation.
Browser tests passed after typecheck repair. Backend lifecycle tests were added
after the existing foundation implementation; T044's test-first ordering remains
pending, not invented.

## Task Progress

T043/T045–T053 validated and checked. T044 remains pending for historical order.
Independent hand-enumerated seven/three/one-weekday, four/52-week, year-boundary,
same-colour/name, identity, provider isolation and confirmed pruning tests pass.

## Phase Checkpoint

34 backend and 14 frontend regression assertions passed; both typechecks passed.
Chromium custom-first save/disable/re-enable/removal and 360px WebKit keyboard
editor passed. Full Node 24 lint passed with zero warnings. New streams remain
unselected and unpublished. Configured zero streams is an intentional state.
