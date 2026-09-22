# 02 - Schema and Backend

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors and Fixes](#errors-and-fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 02 - Schema and Backend
**Task range**: T003-T006
**Date/Time**: 2026-09-20 18:50 AEST
**Purpose**: Implement ordered multi-link persistence and connection-scoped Docker APIs.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm --filter backend typecheck` | FAIL | [02-phase-schema-and-backend/backend-tsc-run-1.log](02-phase-schema-and-backend/backend-tsc-run-1.log) |
| 2 | `pnpm --filter backend exec tsc --noEmit` | PASS | [02-phase-schema-and-backend/backend-tsc-run-2.log](02-phase-schema-and-backend/backend-tsc-run-2.log) |
| 3 | `pnpm --filter backend db:generate` | PASS | [02-phase-schema-and-backend/drizzle-run-1.log](02-phase-schema-and-backend/drizzle-run-1.log) |
| 4 | `pnpm --filter backend exec vitest run tests/integration/dockerContainers.test.ts tests/integration/dockerAction.test.ts tests/integration/dockerAuth.test.ts tests/integration/dockerMultiHost.test.ts` | FAIL | [02-phase-schema-and-backend/vitest-run-1.log](02-phase-schema-and-backend/vitest-run-1.log) |
| 5 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/dockerContainers.test.ts tests/integration/dockerAction.test.ts tests/integration/dockerAuth.test.ts tests/integration/dockerMultiHost.test.ts` | PASS | [02-phase-schema-and-backend/vitest-run-2.log](02-phase-schema-and-backend/vitest-run-2.log) |
| 6 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/contract/openapi.test.ts tests/integration/dockerContainers.test.ts tests/integration/dockerAction.test.ts tests/integration/dockerAuth.test.ts tests/integration/dockerMultiHost.test.ts` | PASS | [02-phase-schema-and-backend/vitest-run-3.log](02-phase-schema-and-backend/vitest-run-3.log) |
| 7 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/migrationIntegrity.test.ts tests/integration/restore.test.ts` | FAIL | [02-phase-schema-and-backend/vitest-run-4.log](02-phase-schema-and-backend/vitest-run-4.log) |
| 8 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/migrationIntegrity.test.ts tests/integration/restore.test.ts` | FAIL | [02-phase-schema-and-backend/vitest-run-5.log](02-phase-schema-and-backend/vitest-run-5.log) |
| 9 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/migrationIntegrity.test.ts tests/integration/restore.test.ts` | PASS | [02-phase-schema-and-backend/vitest-run-6.log](02-phase-schema-and-backend/vitest-run-6.log) |

## Errors and Fixes

1. The combined backend typecheck passed the source project, then failed in the test
   project on existing unchecked indexed-access findings in backup/restore tests and an
   `unknown` cache value in `publicWidgetSnapshotCache.test.ts`. None of the reported
   files were changed by #190. Source typechecking and focused tests will be used during
   implementation; the final gate will compare these baseline findings against `main`.
2. The first focused integration run used the host's default Node version while
   `better-sqlite3` was built for Node 22, causing `ERR_DLOPEN_FAILED` before test setup.
   Re-run under the repository's required Node 22 PATH.
3. The first migration/restore run proved restore behavior but the handwritten
   migration-0026 fixture lacked the `widget_conn_pk` index created in migration 0013.
   The fixture now reproduces the historical index before migration 0031 replaces it.
4. The second migration/restore run reached the idempotency check after adding a
   second valid Docker link. Its legacy count assertion was updated from one row to two.

## Phase Checkpoint

Schema, API, authorization, migration, and backup/restore coverage is implemented.
Legacy links receive order zero, exact widget/connection ownership is enforced, and
ordered link rows survive export and restore.
