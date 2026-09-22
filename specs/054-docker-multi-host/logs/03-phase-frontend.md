# 03 - Frontend

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors and Fixes](#errors-and-fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 03 - Frontend
**Task range**: T007-T008
**Date/Time**: 2026-09-20 18:50 AEST
**Purpose**: Add ordered host selection and independent grouped host rendering.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm --filter frontend typecheck` | FAIL | [03-phase-frontend/frontend-tsc-run-1.log](03-phase-frontend/frontend-tsc-run-1.log) |
| 2 | `pnpm --filter frontend typecheck` | FAIL | [03-phase-frontend/frontend-tsc-run-2.log](03-phase-frontend/frontend-tsc-run-2.log) |
| 3 | `pnpm --filter frontend typecheck` | PASS | [03-phase-frontend/frontend-tsc-run-3.log](03-phase-frontend/frontend-tsc-run-3.log) |
| 4 | `pnpm --filter frontend typecheck && pnpm --filter frontend exec vitest run src/hooks/__tests__/useDocker.test.ts src/components/widgets/__tests__/DockerWidget.test.tsx src/components/widgets/__tests__/DockerConnectionPicker.test.tsx` | PASS | [03-phase-frontend/frontend-focused-run-1.log](03-phase-frontend/frontend-focused-run-1.log) |

## Errors and Fixes

1. The first frontend typecheck found the new replacement hook inserted inside the
   existing test-hook mutation and the old hook tests still using single-host
   signatures. The hook was moved to module scope; tests will be updated to include
   connection IDs.
2. The second typecheck found that the persisted widget ID narrowing was not retained
   inside the picker mutation callback. A post-guard constant now carries the narrowed
   string value.

## Phase Checkpoint

Focused hook and component coverage now verifies connection-scoped requests, the
single-host no-chrome experience, ordered multi-host sections, isolated host errors,
and complete ordered replacement payloads.
