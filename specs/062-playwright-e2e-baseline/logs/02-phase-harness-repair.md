# 02 — Harness Repair

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 02 — Harness Repair  
**Task range**: T003–T005  
**Date/Time**: 2026-09-24 22:55 AEST  
**Purpose**: Centralize deterministic setup and repair project scoping before updating focused assertions.

## Commands Run

| Command | Result |
|---|---|
| `pnpm --filter frontend typecheck` | Passed under Node 24.18.0 |
| `pnpm --filter frontend build` | Passed under Node 24.18.0 |
| `pnpm --filter frontend exec playwright test --project=chromium` | Reduced the initial repaired run to 8 failures, then passed after focused repairs |
| `pnpm --filter frontend exec playwright test --project=mobile-safari` | 3 passed |

## Errors & Fixes

1. Repeated first-run/login helpers exhausted the production login rate limit.
   A setup project now creates the admin once and saves authenticated storage
   state for both browser projects.
2. Every test ran on the iPhone project. Mobile Safari now runs only explicit
   `*.mobile.spec.ts` coverage.
3. Obsolete `/api/bootstrap` calls, stale settings test IDs, ambiguous text and
   SVG locators, and a fixture that omitted the header CSS chunk were updated to
   current routes and accessible UI.
4. Dashboard export emits schema v2 while the import dialog accepted only v1
   and counted only legacy placeholder links. The dialog now accepts both
   supported versions and previews links in either schema.
5. Appearance field labels were visually present but not associated with their
   inputs. `FieldRow` now supports `htmlFor`, and the tested title, footer,
   clock toggle, and timezone controls expose accessible names.

## Phase Checkpoint

Complete. The production-mode harness starts from isolated state, exercises
desktop Chromium and intentional mobile Safari coverage, and reports API
failures with status and response bodies.
