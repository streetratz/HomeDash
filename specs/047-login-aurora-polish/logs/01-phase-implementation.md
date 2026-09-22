# 01 — Implementation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Implementation
**Task range**: T001–T011
**Date/Time**: 2026-09-19 09:15 AEST
**Purpose**: Add login password visibility and enhance the existing CSS Aurora effects.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm --filter frontend test` | PASS — 17 files, 89 tests | [frontend-test.log](frontend-test.log) |
| 2 | `pnpm --filter frontend typecheck` | PASS | [frontend-typecheck.log](frontend-typecheck.log) |
| 3 | `pnpm --filter frontend build` | PASS | [frontend-build.log](frontend-build.log) |
| 4 | Focused Playwright run, Chromium + mobile Safari | PASS — 8 tests | [frontend-e2e.log](frontend-e2e.log) |
| 5 | Changed-file Prettier check | PASS | Console output |
| 6 | `pnpm test:upgrade` | PASS — migrations 30 → 30, 27 tables preserved, 0 FK violations | [docker-upgrade.log](docker-upgrade.log) |
| 7 | Node 22 `pnpm lint` | PASS — zero errors and zero warnings | [lint.log](lint.log) |
| 8 | Code, visual, and animation review | PASS — no significant findings | [review.log](review.log) |

## Errors & Fixes

1. GitHub semantic code search could not resolve the repository and returned HTTP 404.
   Local scoped `rg`, `glob`, and direct file reads were used instead.
2. Running the compiled backend directly from the repository resolved migrations from
   the nonexistent root `drizzle/` path. The local production-style server was instead
   launched from `backend/` through `tsx`, matching the source migration path while the
   Docker upgrade gate separately verified the packaged image.
3. The first browser run exposed reduced-motion cascade ordering, CSS loading before the
   shell route, a desktop-only login locator, and an ambiguous password label locator.
   The rules and fixtures were corrected; the focused matrix then passed 8/8.
4. A later browser rerun defaulted to `localhost:3000` after its explicit base URL was
   omitted. Re-running with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3401` passed 8/8; the
   product code was not implicated.
5. Repository-wide `pnpm format:check` reproduced 278 pre-existing formatting findings.
   Every file changed by this feature passes a scoped Prettier check.

## Design and Animation Review

| Before | After | Why |
| --- | --- | --- |
| A single moving background gradient flattened both Aurora variants | Three restrained radial curtain bands move behind a stable base | Adds recognizable depth without adding DOM, Canvas, or bright generic glow |
| Foreground stacking depended on incidental document order | Aurora content is explicitly layered above decorative pseudo-elements | Prevents gradients and stars from obscuring text or controls |
| Dark treatment carried into every theme | Light mode uses pale bases and lower curtain opacity | Preserves contrast and makes the effect feel native to a light dashboard |
| Aurora motion continued for reduced-motion users | Curtain, star, and animated-title movement is disabled | Honors the user preference while retaining the static visual identity |

Dark and light screenshots were inspected at desktop size, and the login password
control was inspected at a mobile viewport. No significant visual or interaction
finding remained.

## Phase Checkpoint

✅ Complete. Implementation, tests, browser coverage, review, Docker upgrade safety,
and the full Node 22 lint gate passed.
