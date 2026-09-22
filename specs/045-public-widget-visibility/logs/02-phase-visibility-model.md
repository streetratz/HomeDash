# 02 — Visibility Model

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 02 — Visibility Model
**Task range**: T004–T013
**Date/Time**: 2026-09-18
**Purpose**: Persist per-widget public visibility, bind exposed widgets to the acting administrator, preserve safe import/export/duplicate behavior, and cover the storage lifecycle with tests.

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend db:generate` | ✅ PASS — schema is current after generated `0027_*` and `0028_*` migrations | [drizzle-run-1.log](02-phase-visibility-model/drizzle-run-1.log) |
| 2 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec tsc --noEmit` | ✅ PASS | [backend-tsc-run-2.log](02-phase-visibility-model/backend-tsc-run-2.log) |
| 3 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/dashboards.test.ts tests/integration/dashboardImport.test.ts tests/integration/dashboardExport.test.ts` | ✅ PASS — 73 tests | [vitest-run-3.log](02-phase-visibility-model/vitest-run-3.log) |

## Errors & Fixes

1. The first generated migration added the nullable foreign-key column without
   preserving `ON DELETE SET NULL`, despite recording that action in Drizzle's
   snapshot. Adding the visibility check constraint forced a table recreation,
   but a one-step recreation attempted to select the new columns from the old
   table. The schema change was therefore generated in two safe stages:
   `0027_*` adds the columns with defaults, and `0028_*` recreates the table
   after those columns exist so the check and foreign-key action are applied.
2. The first targeted test run accidentally nested a new Vitest `it()` block
   inside another test. The block was moved to the surrounding `describe`, and
   the final 73-test run passed.

## Phase Checkpoint

✅ Complete. Widgets default to hidden, exposed widgets bind to the acting
administrator, hiding clears the binding, public source identity stays out of
API responses/exports, and import/duplicate paths reset exposure.
