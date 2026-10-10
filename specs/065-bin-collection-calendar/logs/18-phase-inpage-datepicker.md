# 18 — CH-04 In-Page Editor & Date Picker Correction

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Decisions](#decisions)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Date**: 2026-10-10 (owner correction received 15:07 UTC+11)
**Scope**: Owner correction CH-04 to the Custom Calendar Events product. The
owner confirmed the UI is better but reported two breaks of HomeDash settings
standards: (1) the Custom Events manager opened in a **popup/modal dialog**, and
settings never use popups for editing anywhere in the app; (2) the date picker
"is missing" — the native date control rendered invisibly in the dark theme and
read as bare text. This phase replaces the modal with an **in-page expandable
panel** and makes the date controls a real, theme-visible, touch-friendly date
picker, then updates the spec artifacts (spec, plan, UI contract, changelog,
tasks) and behaviour docs. No backend contract changes in this phase.

## Decisions

- **In-page panel, no modal.** `CalendarSourceList` no longer mounts the Radix
  `CustomEventsDialog` (deleted). The admin-only **Custom Events** control is now
  a disclosure button with `aria-expanded` / `aria-controls="custom-events-panel"`
  and a rotating chevron. Expanding it renders an in-page
  `<section id="custom-events-panel">` (heading "Custom events", description,
  Close button) that hosts `CollectionManager` directly — the same compact
  button/list/one-expanded-editor UX, but managed in-page using the established
  settings disclosure pattern rather than a modal overlay.
- **No duplicate region role.** `CollectionManager`'s own root is
  `<section aria-label="Custom events">` (role `region`, the node the E2E suite
  targets). The new wrapper `<section>` is intentionally left **without** an
  accessible name so it does not create a second `region` named "Custom events",
  keeping `getByRole('region', { name: 'Custom events' })` unambiguous.
- **Theme-visible date picker via `color-scheme`.** Root cause of the "missing"
  picker was no `color-scheme` declaration, so the native `<input type="date">`
  indicator/segments rendered dark-on-dark in the `.dark` theme. Added scoped
  `color-scheme: light` on `input[type='date']` / `input[type='time']` and
  `color-scheme: dark` for the same inputs under `.dark`, so the browser-native
  picker (keyboard + touch calendar) is fully visible in both themes. The fix is
  scoped to date/time inputs — not the document root — to avoid churning the
  appearance of every other native control app-wide.
- **Touch target sizing.** Under `@media (pointer: coarse)`, date/time inputs get
  `min-height: 2.75rem` (44px) so the mobile picker is comfortably tappable,
  matching the existing coarse-pointer control sizing in the sheet.
- **Owner-requested ColorPicker unchanged.** The established palette ColorPicker
  is explicitly owner-requested; "no popups" applies to the settings manager /
  editor modal UI, so the ColorPicker's portalled palette behaviour is preserved.
- **Other dialogs out of scope.** `BirthdaySourceDialog` / `ICalSourceForm`
  remain Radix dialogs; the owner correction was specific to the Custom Events
  manager/editor, so those are left unchanged to stay in scope.

## Commands Run

All under Node 24.18.0 / pnpm 11.

- `pnpm typecheck` — clean (backend + frontend); raw log in
  [`18-phase-inpage-datepicker/typecheck.log`](18-phase-inpage-datepicker/typecheck.log).
- `pnpm --filter frontend test:unit` — 177 passed; raw log in
  [`18-phase-inpage-datepicker/vitest-unit.log`](18-phase-inpage-datepicker/vitest-unit.log).
- `pnpm --filter frontend test:e2e -- collections` — 9 passed across chromium and
  mobile-safari (includes touch flows) in the isolated `.e2e` harness; raw log in
  [`18-phase-inpage-datepicker/playwright-collections.log`](18-phase-inpage-datepicker/playwright-collections.log).
- `pnpm build` — clean; raw log in
  [`18-phase-inpage-datepicker/build.log`](18-phase-inpage-datepicker/build.log).
- `pnpm lint` (`eslint . --max-warnings=0`) — clean, zero warnings; raw log in
  [`18-phase-inpage-datepicker/eslint.log`](18-phase-inpage-datepicker/eslint.log).
- `pre-pr-upgrade-gate` / `pnpm test:upgrade` (repo-local `TMPDIR`) — **passed**:
  migrations 32 → 35, 28 tables preserved, 0 FK violations. The gate builds the
  baseline image from `main` (no collection tables) and the candidate image from
  this worktree, starts the candidate on the baseline-created database volume, and
  confirms the candidate startup migrations create all new collection tables /
  columns without data loss or FK violations. Raw log in
  [`18-phase-inpage-datepicker/upgrade-gate.log`](18-phase-inpage-datepicker/upgrade-gate.log).

## Errors & Fixes

- **Duplicate `region` role risk.** An early draft gave the wrapper
  `<section aria-label="Custom events">`, which would have created a second
  `region` with the same accessible name as `CollectionManager`'s root and made
  the E2E `getByRole('region', { name: 'Custom events' })` ambiguous. Fixed by
  dropping the wrapper's `aria-label` (an unnamed `<section>` exposes no `region`
  role). All 9 collection E2E specs pass unchanged.
- **Date control read as bare text.** The native picker was present but invisible
  in dark mode (no `color-scheme`). Fixed with scoped `color-scheme` on date/time
  inputs rather than replacing the control, preserving native keyboard/touch
  calendar behaviour the existing settings already rely on.

## Phase Checkpoint

The CH-04 owner correction is delivered: the Custom Events manager is now an
in-page expandable disclosure panel (no modal/popup), consistent with the rest of
the settings surface, and the one-off/first/end date controls render a real,
theme-visible, touch-friendly native date picker in both light and dark themes.
Spec FR-024, the UI contract, plan, changelog (CH-04) and tasks (R012–R014) record
the correction with honest chronology; behaviour docs are updated. Frontend unit
177/177; collection E2E 9/9 (chromium + mobile-safari); typecheck, build and full
root lint clean. A design-taste pass confirmed the in-page panel reuses the house
disclosure/spacing/motion primitives; no automated or human assistive-technology
study was performed.
