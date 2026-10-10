# 07 — Foundation

[← Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Task range**: T005–T023  
**Date**: 2026-10-10  
Setup committed as `11cc3cf`. Test strict dates/aggregate/migration/backup before
implementation. Red evidence must include assertions, not merely missing modules.
Shared infrastructure supports all schedule modes before any UI story.
Preserve legacy provider tables; only owning-tool additive migration.
Exception swaps use delete/reinsert after whole-aggregate validation.
Restore sanitization occurs before the service logger, never only at its caller.

## Commands Run

| Run | Command | Outcome | Log File |
|---|---|---|---|

| vitest-red-1 | `pnpm --filter backend exec vitest run tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts` | Exit 1 | [07-phase-foundational/vitest-red-run-1.log](07-phase-foundational/vitest-red-run-1.log) |

| date-red-1 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts` | Exit 1 | [07-phase-foundational/date-red-run-1.log](07-phase-foundational/date-red-run-1.log) |

| drizzle-1 | `pnpm --filter backend db:generate` | Exit 0 | [07-phase-foundational/drizzle-run-1.log](07-phase-foundational/drizzle-run-1.log) |

| dates-green-1 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts` | Exit 0 | [07-phase-foundational/dates-green-run-1.log](07-phase-foundational/dates-green-run-1.log) |

| config-red-1 | `pnpm --filter backend exec vitest run tests/unit/collectionWidgetConfig.test.ts` | Exit 1 | [07-phase-foundational/config-red-run-1.log](07-phase-foundational/config-red-run-1.log) |

| backend-tsc-1 | `pnpm --filter backend typecheck` | Exit 2 | [07-phase-foundational/backend-tsc-run-1.log](07-phase-foundational/backend-tsc-run-1.log) |

| backend-tsc-2 | `pnpm --filter backend typecheck` | Exit 2 | [07-phase-foundational/backend-tsc-run-2.log](07-phase-foundational/backend-tsc-run-2.log) |

| vitest-1 | `pnpm --filter backend exec vitest run tests/unit/collectionService.test.ts tests/unit/collectionWidgetConfig.test.ts tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts` | Exit 1 | [07-phase-foundational/vitest-run-1.log](07-phase-foundational/vitest-run-1.log) |

| backend-tsc-3 | `pnpm --filter backend typecheck` | Exit 2 | [07-phase-foundational/backend-tsc-run-3.log](07-phase-foundational/backend-tsc-run-3.log) |

| vitest-2 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts tests/unit/collectionWidgetConfig.test.ts tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts && pnpm --filter frontend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionRestoreWarning.test.tsx` | Exit 1 | [07-phase-foundational/vitest-run-2.log](07-phase-foundational/vitest-run-2.log) |

| backend-tsc-4 | `pnpm --filter backend typecheck` | Exit 0 | [07-phase-foundational/backend-tsc-run-4.log](07-phase-foundational/backend-tsc-run-4.log) |

| vitest-3 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts tests/unit/collectionWidgetConfig.test.ts tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts && pnpm --filter frontend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionRestoreWarning.test.tsx` | Exit 0 | [07-phase-foundational/vitest-run-3.log](07-phase-foundational/vitest-run-3.log) |

| vitest-4 | `pnpm --filter backend exec vitest run tests/unit/collectionService.test.ts tests/integration/publicBootstrapProjection.test.ts` | Exit 1 | [07-phase-foundational/vitest-run-4.log](07-phase-foundational/vitest-run-4.log) |

| frontend-tsc-1 | `pnpm --filter frontend typecheck` | Exit 0 | [07-phase-foundational/frontend-tsc-run-1.log](07-phase-foundational/frontend-tsc-run-1.log) |

| focused-1 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts tests/unit/collectionWidgetConfig.test.ts tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts tests/integration/migrationIntegrity.test.ts && pnpm --filter frontend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionRestoreWarning.test.tsx` | Exit 0 | [07-phase-foundational/focused-run-1.log](07-phase-foundational/focused-run-1.log) |

| typechecks-1 | `pnpm --filter backend typecheck && pnpm --filter frontend typecheck` | Exit 0 | [07-phase-foundational/typechecks-run-1.log](07-phase-foundational/typechecks-run-1.log) |

| lint-1 | `pnpm lint` | Exit 1 | [07-phase-foundational/lint-run-1.log](07-phase-foundational/lint-run-1.log) |

| final-gates-1 | `pnpm --filter backend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionService.test.ts tests/unit/collectionWidgetConfig.test.ts tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts tests/integration/migrationIntegrity.test.ts && pnpm --filter frontend exec vitest run tests/unit/collectionDates.test.ts tests/unit/collectionRestoreWarning.test.tsx && pnpm --filter backend typecheck && pnpm --filter frontend typecheck && pnpm lint` | Exit 0 | [07-phase-foundational/final-gates-run-1.log](07-phase-foundational/final-gates-run-1.log) |

## Errors & Fixes

1. Recorded meaningful red assertions for uncreated tables, v1 export/warning,
   civil-date oracle and absent widget selection fields. Implemented owning
   schema/date/backup/config behavior after those tests.
2. First typecheck found chained SQLite DELETE `where` and transform-input generic
   mismatch. Use one `and` predicate and Zod's unknown input generic.
3. Next typecheck found nested-union narrowing in swap test; narrow using the
   presence of `exceptions`, not only the nested schedule discriminator.
4. Baseline backup test expected v1; update the export expectation to the
   deliberately changed portable v2 contract. V1 import remains separately tested.
5. A patch placed the new public resolver inside the old resolver function.
   Typecheck/transform caught it; move the export to module scope.
6. Review found v1 payloads would be parsed twice after defaults were added.
   Keep the strict raw v1 boundary and pass raw input from the route; the service
   independently validates before mutation. Do not weaken v1 field rejection.
7. Unchanged-exception equality used JSON property order; replace with explicit
   per-field equality. A delete-trigger regression proves no-op saves do not
   rewrite exception rows. Destination swaps retain IDs and created timestamps.
8. Public fixture expectation used General instead of its saved Recycling
   subset; corrected the test to the actual fixture. Projection preserves
   legacy provider selection while removing hidden collection IDs.
9. Lint found control-character regex and unused destructuring. Check Unicode
   codepoints directly and construct common test fields explicitly. Final full
   lint passes with zero warnings.

**Test-order disclosure**: Table/backup/date/config red runs are recorded.
Service assertions and frontend warning/projection assertions were initially
written alongside their implementation, not run red beforehand. Their expanded
acceptance and rollback suites now pass; no historical red run is claimed.
The 2 MiB HTTP boundary is deliberately exercised/implemented in T025/T030;
foundation owns the bounded schemas, not a route that does not exist yet.

Generated artifacts: `backend/drizzle/0032_cold_wild_pack.sql`,
`backend/drizzle/meta/0032_snapshot.json` and owning-tool `_journal.json` update.
Migration creates only four collection tables/indexes; no provider rewrite/seed.

## Phase Checkpoint

Complete T005–T023. Final raw sidecar `final-gates-run-1.log` records 53 backend
tests, six frontend tests, both workspace typechecks and full root lint passing
under Node 24. No private catalogue route or feature UI exists yet.
All four authoritative backup tables roundtrip exact persisted values;
malicious restore validation and injected rollback/log-sanitizer tests pass.
FK checks and repeated migration preserve synthetic existing provider,
birthday, user, dashboard and widget configuration.
