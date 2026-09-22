# 04 — Public Data Namespace

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 04 — Public Data Namespace
**Task range**: T019–T029
**Date/Time**: 2026-09-18
**Purpose**: Serve allowlisted public widget snapshots through one rate-limited GET route while preserving all authenticated route guards.

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec tsc --noEmit` | ❌ FAIL — one missing `widgetType` audit field | [backend-tsc-run-2.log](04-phase-public-data-namespace/backend-tsc-run-2.log) |
| 2 | Same source typecheck after fix | ✅ PASS | [backend-tsc-run-3.log](04-phase-public-data-namespace/backend-tsc-run-3.log) |
| 3 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/unit/publicWidgetSnapshotCache.test.ts tests/integration/publicVisibility.test.ts tests/integration/publicWidgets.test.ts tests/integration/widgetDataPermissions.test.ts` | ✅ PASS — 45 tests | [vitest-run-3.log](04-phase-public-data-namespace/vitest-run-3.log) |

## Errors & Fixes

1. The first denial-matrix test issued several Supertest requests concurrently
   and one connection reset. The test was made sequential, matching actual
   polling behavior while still asserting the constant denial response.
2. Source typecheck found one visibility audit event missing the required
   `widgetType`; the field was added to every event construction path.

## Phase Checkpoint

✅ Complete. The only anonymous integration-data surface is rate-limited and
GET-only, resolves authorization before cache access, caches only projected
payloads, coalesces concurrent loads, and preserves existing authenticated
widget route guards.
