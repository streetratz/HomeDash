# 16 — Custom Event Backend Foundation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Decisions](#decisions)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Date**: 2026-10-10
**Scope**: Backend foundation for the Custom Calendar Events refactor (CH-03):
a bundled offline icon identity plus inclusive first/last recurrence bounds
threaded through the schema, recurrence engine, service, backup, and migrations,
with positive and negative tests. No UI work in this phase.

## Decisions

- **Offline icon allowlist.** A new backend module
  `backend/src/services/collectionIcons.ts` is the single source of truth for the
  curated, bundled lucide icon names (`COLLECTION_ICONS`, default `Trash2`). The
  allowlist is enforced with `z.enum(COLLECTION_ICONS)` at the admin save
  boundary and at backup restore, so unknown keys and external icon URLs are
  rejected rather than stored or rendered. No CDN/external icon is ever requested
  for custom events.
- **Inclusive bounds on regular schedules.** `startDate`/`endDate` are optional,
  nullable, date-only columns on `collection_streams`. `null` preserves the
  prior unbounded anchor-phase semantics for existing rows; new events set a
  concrete first date. The recurrence engine's `withinBounds` gate is ANDed into
  `isBaseDate` so no date before `startDate` or after `endDate` is ever
  generated, and out-of-bounds exception destinations fail with
  `out_of_bounds_actual` (origins already fail `isBaseDate` → `orphan_origin`),
  blocking preview/save rather than being silently discarded.
- **"Repeat Off" one-off events** reuse the existing `explicit` schedule mode
  with a single date — no new stream type. The CHECK constraint forbids
  `start_date`/`end_date` on explicit rows.
- **Compatibility internals retained.** The collections table/API/widget keys are
  unchanged; only additive columns and the icon field were introduced. No
  destructive rename or data move. Backup v2 rows normalise a missing legacy
  `icon` to `Trash2` and missing bounds to `null`, while preserving fresh values;
  pre-refactor readers will not accept the extended rows (noted for operators).
- **DTO projection.** The authenticated/public collection group DTO gains only
  the allowlisted `icon`; recurrence rules, bounds, and private labels remain
  undisclosed.

## Commands Run

All under Node 24.18.0 / pnpm 11.

- `pnpm --filter backend db:generate` — produced the two-step additive migrations
  `0033_charming_secret_warriors.sql` (ADD COLUMN) and
  `0034_uneven_catseye.sql` (CHECK rebuild). Generated only; never hand-edited.
- `pnpm --filter backend typecheck` — clean; raw log in
  [`16-phase-custom-event-foundation/typecheck-run-1.log`](16-phase-custom-event-foundation/typecheck-run-1.log).
- Backend vitest full suite — 835 passed (73 files); raw tail in
  [`16-phase-custom-event-foundation/vitest-backend-run-1.log`](16-phase-custom-event-foundation/vitest-backend-run-1.log).
- `pnpm lint` (`eslint . --max-warnings=0`) — clean, zero warnings; raw log in
  [`16-phase-custom-event-foundation/eslint-foundation-run-1.log`](16-phase-custom-event-foundation/eslint-foundation-run-1.log).

## Errors & Fixes

- **Required `icon` broke existing collection fixtures.** Adding a required
  `icon` field surfaced `exactOptionalPropertyTypes`/union-type widening errors
  and six failing fixtures (`collectionService`, `collectionPublic`,
  `collectionPerformance`, `collectionBackup`, `collectionCustom`,
  `collectionExceptions`). Fixed by adding `icon` to each fixture (using
  `as const` on factory literals to prevent widening to `string`) and updating
  the public-DTO expected key set to `['color','icon','key','name']`.
- **New toggle test reused a stale draft.** The disabled→re-enabled test asserted
  on `previewCollections(disabled)` after `save(disabled)` had already bumped the
  revision, tripping the optimistic-concurrency `checkVersion` guard. Fixed by
  recapturing a fresh draft for the post-save assertion — the guard behaviour is
  correct and unchanged.

## Phase Checkpoint

New `collectionCustomEvents.test.ts` (11 tests) covers one-off create/edit
identity, inclusive first/last bounds with leap-day and exact-end cases,
end-before-start rejection, out-of-bounds move/skip blocked before writes, bad
and external-URL icon rejection, disabled→re-enabled occurrence preservation, and
the allowlisted-icon DTO projection. Full backend suite 835/835, typecheck clean,
full root lint clean. Tasks R002–R004 complete (R001 planning landed in
`d87f61f`; the issue #19 update within R001 is parent-owned and tracked
separately). UI phase (R005–R008) and final validation (R009–R011) remain.
