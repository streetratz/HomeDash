# 05 — Bootstrap Pruning

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 05 — Bootstrap Pruning
**Task range**: T030–T035
**Date/Time**: 2026-09-18
**Purpose**: Remove hidden and unsupported widgets from anonymous bootstrap responses while leaving authenticated dashboard views complete.

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec vitest run tests/integration/publicBootstrap.test.ts tests/integration/publicBootstrapProjection.test.ts tests/integration/publicWidgets.test.ts` | ✅ PASS — 14 tests | [vitest-run-2.log](05-phase-bootstrap-pruning/vitest-run-2.log) |
| 2 | `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" pnpm --filter backend exec tsc --noEmit` | ✅ PASS | [backend-tsc-run-1.log](05-phase-bootstrap-pruning/backend-tsc-run-1.log) |

## Errors & Fixes

1. The first projection test was nested inside the legacy bootstrap suite, and
   both suites reset the same database singleton. It was moved to its own test
   file so each file retains its existing isolated database lifecycle.

## Phase Checkpoint

✅ Complete. Anonymous bootstrap now keeps only intrinsic widgets and explicitly
exposed supported integrations, removes empty placeholders, strips visibility
and source metadata, and leaves authenticated dashboard views unchanged.
