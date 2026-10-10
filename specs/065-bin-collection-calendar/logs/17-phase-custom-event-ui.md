# 17 — Custom Event UI Refactor

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Decisions](#decisions)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Date**: 2026-10-10
**Scope**: Frontend UI refactor for the Custom Calendar Events product (CH-03).
Replaces the inline Household-collections editor with a Birthdays-style,
admin-only **Custom Events** launcher beside **Add Birthdays** in the Calendar
sources controls, opening a responsive compact manager. Adds an offline bundled
icon selector, generic honest labels, and updates the agenda/fullscreen presentation
and the collection E2E suite. No backend contract changes in this phase.

## Decisions

- **Admin-only dialog launcher, inline mount removed.** `CalendarSourceList`
  renders a `Custom Events` button gated on `isAdmin`, beside `Add Birthdays`,
  opening a new `CustomEventsDialog` (role `dialog`, title "Custom events") that
  hosts `CollectionManager`. The previous inline `CollectionManager` mount in
  `IntegrationsTab` is removed, so non-admin reads never mount admin config.
- **Honest generic labels over compatibility internals.** The collections API,
  table, and widget keys are retained unchanged as compatibility internals (no
  destructive rename or migration), while every user-facing string is now
  event-generic: region "Custom events", "Manage custom events" / "Set up custom
  events", "Add event", listitem `Custom event N: {name}`, "Event title",
  "Normal date (cycle anchor)", "Save events", "Delete {name}" /
  "Confirm delete event", and a `Repeat` select (off/weekly/fortnightly/custom)
  with an explicit "Confirm repeat change" step when switching across the
  one-off/recurring family on an event that already has a date or exceptions.
- **Offline bundled icon selector.** New `CollectionIconPicker` renders only the
  bundled lucide allowlist from `frontend/src/lib/collectionIcons.ts` (mirrors the
  backend source of truth); no CDN/external icon is requested. The current icon is
  rendered through `createElement(collectionIconComponent(value), …)` so the icon
  lookup never trips the `react-hooks/static-components` rule.
- **One editor expanded at a time.** `CollectionManager` keeps a single
  `expandedId`; adding an event auto-expands it, and the per-event Edit/Close
  toggle enforces one open editor, keeping the manager readable on 360px.
- **Additive bin preset only.** The preset panel appends red weekly General,
  yellow fortnightly Recycling, and alternate-week green Garden as independent,
  individually editable events; it never replaces or deletes existing events.
- **Series vs single-occurrence changes stay distinguished.** Series title/icon/
  colour/rule edits remain in the main editor; reversible Skip/Move/Add
  single-occurrence controls stay behind "Single-occurrence changes (advanced)"
  and are not all expanded at once.

## Commands Run

All under Node 24.18.0 / pnpm 11.

- `pnpm --filter frontend test:unit` — 177 passed (43 files); raw tail in
  [`17-phase-custom-event-ui/vitest-frontend-unit-run-1.log`](17-phase-custom-event-ui/vitest-frontend-unit-run-1.log).
- `pnpm --filter frontend test:e2e -- collections` — 9 passed across chromium and
  mobile-safari in the isolated `.e2e` harness; raw tail in
  [`17-phase-custom-event-ui/playwright-collections-run-1.log`](17-phase-custom-event-ui/playwright-collections-run-1.log).
- `pnpm typecheck` — clean (backend + frontend); raw log in
  [`17-phase-custom-event-ui/typecheck-run-1.log`](17-phase-custom-event-ui/typecheck-run-1.log).
- `pnpm build` — clean; raw log in
  [`17-phase-custom-event-ui/build-run-1.log`](17-phase-custom-event-ui/build-run-1.log).
- `pnpm lint` (`eslint . --max-warnings=0`) — clean after fixes, zero warnings;
  raw log in
  [`17-phase-custom-event-ui/eslint-ui-run-1.log`](17-phase-custom-event-ui/eslint-ui-run-1.log).

## Errors & Fixes

- **E2E selectors on wrapped `<select>`.** `getByLabel('Repeat')` /
  `getByLabel('Collection weekday')` matched the option text in the computed
  label and timed out. Fixed by switching to
  `getByRole('combobox', { name, exact: true })`, whose accessible name is the
  clean control label.
- **Shared-DB stream cap across serial specs.** `collectionReadingSmoke` leaves 32
  streams in the single serial E2E database, so later specs hit the
  `draft.streams.length >= 32` cap and "Add event" is disabled. Added
  `resetCollectionsToEmpty(request, csrf)` to `helpers/collections.ts` and called
  it at the start of the custom specs; added required `icon` fields to all
  API-built streams (the backend now requires `icon`).
- **Cross-family repeat switch needs confirmation.** Switching `Repeat` to weekly
  on a freshly added event (explicit single date) arms a pending "Confirm repeat
  change" rather than switching immediately, so the regular controls stay hidden
  until confirmed. The E2E flows now click "Confirm repeat change" after the
  cross-family switch, and re-expand the collapsed editor (Edit toggle) after a
  save-then-manage round-trip.
- **Lint: component created during render.** `const Current =
  collectionIconComponent(value)` rendered as `<Current/>` tripped
  `react-hooks/static-components`; replaced with
  `createElement(collectionIconComponent(value), …)`. Also dropped an unnecessary
  `icon as CollectionIcon` cast flagged by
  `@typescript-eslint/no-unnecessary-type-assertion`.

## Phase Checkpoint

The Custom Events UI is delivered: admin-only dialog launcher beside Birthdays,
inline household manager removed, offline icon selector, compact one-editor
manager with Add/Edit/Delete, Repeat Off/Weekly/Fortnightly/Custom with first/end
dates and advanced reversible single-occurrence controls, additive bin preset, and
updated agenda/fullscreen presentation. Frontend unit 177/177; collection E2E 9/9
(chromium + mobile-safari); typecheck, build and full root lint clean. A
design-taste pass confirmed the UI reuses the house tokens/spacing/motion
primitives with clear hierarchy and handled empty/disabled states (no anti-slop
tells); no automated or human assistive-technology study was performed. Tasks
R005–R009 complete. R010 documentation/commit and R011 isolated-preview rebuild
and final review remain for the next phase.
