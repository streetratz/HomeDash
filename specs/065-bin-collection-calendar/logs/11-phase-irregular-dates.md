# 11 — Irregular dates and exceptions

[← Back to Logs Index](readme.md)

## Overview

Finite explicit dates and reversible stable-ID skip/move/add, strict whole-set
collisions including moved-in targets, removal/restoration conflicts, deliberate
mode/destructive confirmation, failed-draft retention and backup durability.
Human safe-reading gates remain pending; proceed with feasible local behavior.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| editors-red-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionExplicitDatesEditor.test.tsx tests/unit/CollectionExceptionEditor.test.tsx` | Exit 1 | [11-phase-irregular-dates/editors-red-run-1.log](11-phase-irregular-dates/editors-red-run-1.log) |

| green-1 | `pnpm --filter frontend exec vitest run tests/unit/CollectionExplicitDatesEditor.test.tsx tests/unit/CollectionExceptionEditor.test.tsx tests/unit/CollectionStreamEditor.test.tsx tests/unit/CollectionManager.test.tsx && pnpm --filter backend exec vitest run tests/integration/collectionExceptions.test.ts tests/integration/collectionBackup.test.ts tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts && pnpm --filter backend typecheck && pnpm --filter frontend typecheck` | Exit 0 | [11-phase-irregular-dates/green-run-1.log](11-phase-irregular-dates/green-run-1.log) |

| browser-1 | `pnpm --filter frontend exec playwright test tests/e2e/collections-irregular.spec.ts tests/e2e/collections-irregular.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 0 | [11-phase-irregular-dates/browser-run-1.log](11-phase-irregular-dates/browser-run-1.log) |

| lint-1 | `node --version && pnpm lint` | Exit 1 | [11-phase-irregular-dates/lint-run-1.log](11-phase-irregular-dates/lint-run-1.log) |

| regression-1 | `pnpm --filter backend exec vitest run tests/integration/collectionExceptions.test.ts tests/integration/collectionBackup.test.ts tests/integration/collectionCustom.test.ts tests/integration/collectionPreset.test.ts tests/integration/collectionPublic.test.ts tests/contract/collections.test.ts tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts && pnpm --filter frontend exec vitest run tests/unit && pnpm typecheck` | Exit 0 | [11-phase-irregular-dates/regression-run-1.log](11-phase-irregular-dates/regression-run-1.log) |

| calendar-1 | `pnpm --filter frontend exec vitest run tests/unit/collectionCalendar.test.tsx && pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts tests/e2e/collections-irregular.spec.ts tests/e2e/collections-irregular.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [11-phase-irregular-dates/calendar-run-1.log](11-phase-irregular-dates/calendar-run-1.log) |

| calendar-2 | `pnpm --filter frontend exec vitest run tests/unit/collectionCalendar.test.tsx && pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts tests/e2e/collections-irregular.spec.ts tests/e2e/collections-irregular.mobile.spec.ts --project=chromium --project=mobile-safari` | Exit 1 | [11-phase-irregular-dates/calendar-run-2.log](11-phase-irregular-dates/calendar-run-2.log) |

| browsers-1 | `pnpm --filter frontend exec playwright test tests/e2e/collections-preset.spec.ts tests/e2e/collections-preset.mobile.spec.ts tests/e2e/collections-custom.spec.ts tests/e2e/collections-custom.mobile.spec.ts tests/e2e/collections-reading.spec.ts tests/e2e/collections-reading.mobile.spec.ts tests/e2e/collections-irregular.spec.ts tests/e2e/collections-irregular.mobile.spec.ts --project=chromium --project=mobile-safari && pnpm typecheck && pnpm lint` | Exit 0 | [11-phase-irregular-dates/browsers-run-1.log](11-phase-irregular-dates/browsers-run-1.log) |

## Errors & Fixes

The initial editor run was intentionally red for missing modules before the UI
implementation. Full lint then found an unnecessary assertion and unescaped
apostrophe; both were corrected without disables. The cross-month unit fixture
initially supplied conflicting household dates and correctly followed the DTO
back to December; it now supplies a consistent January date.

Combined story browsers exposed shared-fixture ordering: preset reload resets
the Integrations sub-tab and the crowded reading fixture leaves 32 streams.
Preset fixtures now deliberately replace unrelated synthetic configuration and
reselect Calendars after reload. Mobile keyboard editing uses an existing stream
when the maximum is reached. All nine combined browser checks subsequently pass.

## Task Progress

T070 and T075–T082 checked after persistent implementation and focused/prior-story
regression validation. Backend acceptance now proves suppressed-base legitimate
targets, rejection of skip-removal restoration collision, atomic resolving
multi-edit, stable other streams, disabled validation and finite dates. Backup
roundtrip includes a disabled stream with its retained move exception. Actual
cross-month target rendering and empty explicit DTOs do not invent origins/dates.

T071–T074 remain pending: these exact broad test-authoring tasks are not fully
satisfied by the narrower cases here (notably all editor error/rebase and
concurrent browser variants and historical test-first ordering). T083 is not
claimed as full story acceptance closure. Human safe-reading prerequisites
remain unavailable; feasible implementation continued under user authorization.

## Phase Checkpoint

Validated implementation increment: 36 backend collection checks, 53 frontend
unit checks plus seven updated Calendar checks, both typechecks, all nine combined
Chromium/WebKit story checks and full zero-warning root lint pass. This commit
does not claim every task or human success criterion is complete.
