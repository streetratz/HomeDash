# 02 — Unboxed Refinement and Responsive E2E

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 02 — Unboxed Refinement and Responsive E2E
**Task range**: T008–T010
**Date/Time**: 2026-10-24
**Purpose**: Apply the owner's review of the PR #26 preview: remove the Today and
next-collection boxes and the dot ring, and prove the layout across screen sizes
and both themes.

## Changes

- `AgendaView.tsx`: Today keeps `aria-current="date"`, the solid primary badge, and
  the full-strength label, with no border or tinted box. The `ring-2 ring-background`
  was removed from the dots.
- `CollectionGroup.tsx`: the `next` group no longer renders a bordered card.
- `agendaView.test.tsx`: asserts no box on Today, the primary badge, and no ring.
- `calendarAgendaResponsive.spec.ts` (new): 360×740, 390×844, 768×1024, 1280×800, and
  1920×1080, each in light and dark. Uses synthetic, mocked calendar events and a
  synthetic collection stream on the disposable E2E server. It asserts the unboxed
  Today and next-collection groups, an opaque badge, later-day label alpha ≥ 0.7,
  dots without box-shadow centred on the rail within 1.5px, titles inside the
  group, and no horizontal overflow. It attaches a screenshot per size and theme.

## Commands Run (Node 24.18.0)

| Command | Result | Log |
| --- | --- | --- |
| `vitest run tests/unit/agendaView.test.tsx tests/unit/collectionCalendar.test.tsx` | 10 passed | `targeted-tests.log` |
| `pnpm --filter frontend test:unit` | 46 files, 197 tests passed | `unit-tests.log` |
| `pnpm --filter frontend typecheck` | Passed | `typecheck.log` |
| `playwright test calendarAgendaResponsive --project=chromium` | 5 viewports × 2 themes passed | — |
| `playwright test` (full suite) | 44 passed, 1 skipped | `e2e-responsive-and-full.log` |
| `pnpm test:upgrade` | Passed: migrations 35 → 35, 32 tables preserved, 0 FK violations | `upgrade-gate.log` |
| `pnpm lint` | Passed, zero warnings | `lint.log` |

## PR Gates

- **code-review-standard:** No significant findings. Presentation-only class removals
  plus a test-only spec. The E2E test mocks only the calendar read endpoints and
  restores preferences, the dashboard, and collections in `finally`.
- **design-taste / emil-design-eng:** Removing the boxes makes Today and the bin row
  sit on the same quiet surface as other days. Emphasis now comes from the badge and
  type weight alone, which is more restrained. No motion was added.
- **lint-gate:** `pnpm lint` passed under Node 24.
- **pre-pr-upgrade-gate:** Passed on the changed branch.

## Visual Evidence

`calendar-dark.png` (360px, dark) and `calendar-light.png` (1280px, light) were
regenerated from the responsive E2E run.

## Errors & Fixes

- The local preview container held port 3000, which blocked the E2E web server. The
  container was stopped for the test run and restarted afterwards, so the test never
  touched the real-data volume.

## Phase Checkpoint

Complete.
