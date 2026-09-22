# Implementation Plan: 045 — Public Dashboard Widget Visibility

**Branch**: `045-public-widget-visibility` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/045-public-widget-visibility/spec.md`
**Issue**: [#66](https://github.com/streetratz/HomeDash/issues/66)

## Table of Contents

- [Summary](#summary)
- [Technical Context](#technical-context)
- [Constitution Check](#constitution-check)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Implementation Phases](#implementation-phases)
- [Test & Error Logging](#test--error-logging)
- [Risks & Open Questions](#risks--open-questions)
- [Complexity Tracking](#complexity-tracking)

## Summary

Give administrators a per-widget public visibility setting, default it to
hidden, and enforce it server-side through a new, explicitly additive
`/api/public/widgets/...` namespace that is GET-only by construction.

The public dashboard today is broken in a specific way: `/api/public/bootstrap`
hands an anonymous visitor the entire nested dashboard, but every widget data
route requires a session. The visitor therefore sees the layout render and then
fill with 401-driven error states — made more conspicuous by 043's error
surfacing. The fix is not to loosen the data routes. It is to stop sending the
visitor widgets they were never going to be able to load, and to add a narrow,
separate path for the ones an administrator has deliberately exposed.

The central design choice is **additive, not permissive**: no existing
authenticated route changes its guard. Anonymous data is served only by new
routes that live in one file, accept only GET, and resolve the widget through
the designated public dashboard rather than trusting a caller-supplied id.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22
**Primary Dependencies**: Fastify 5, Drizzle ORM, better-sqlite3, `@fastify/rate-limit`; React 18, Vite, TanStack Query
**Storage**: SQLite via Drizzle; migrations in `backend/src/db/migrations/` (next is `0027_*`)
**Testing**: Vitest (backend integration + frontend unit), Playwright for the public view
**Target Platform**: Self-hosted Linux container (amd64/arm64), served to desktop, tablet and kiosk
**Project Type**: Web application — `backend/` + `frontend/` pnpm workspaces
**Performance Goals**: Public bootstrap unchanged (single request); anonymous polling rate-limited per IP
**Constraints**: Public endpoints MUST be GET-only (constitution §I); default-deny; no credentials, endpoint URLs or connection ids in any public payload
**Scale/Scope**: Single-household deployment; one designated public dashboard per device context

### Ground truth established while planning

- `app_widget_instances` (`backend/src/db/schema/index.ts` L254) has `id`,
  `placeholderId`, `type`, `orderIndex`, `configJson`, timestamps. There is **no
  visibility column** — this feature adds one.
- `@fastify/rate-limit` is already registered with `global: false`
  (`backend/src/server.ts` L59), so routes opt in per-route via
  `config.rateLimit`. `backend/src/auth/rateLimit.ts` holds `loginRateLimit` and
  `firstRunRateLimit`; FR-011 adds a third config alongside them.
- `backend/src/api/public.ts` L101-120 calls `getDashboardWithChildren(...)`
  and returns the result wholesale. This is the leak the feature closes.
- Widget data routes are **per-integration, not generic**. The set that matters
  is the one #100 pinned down in
  `backend/tests/integration/widgetDataPermissions.test.ts`: Pi-hole
  (`config`/`stats`/`system`), UniFi (`config`/`stats`), Sonos
  (`mode`/`service-labels`/`status`/`households`), stocks
  (`quotes`/`market-status`) and app shortcuts.
- There is **no audit log table** in the codebase — `grep -rn audit backend/src`
  hits only `dockerSshTransport.ts`. FR-020 cannot assume one exists.

## Constitution Check

*GATE: passed for Phase 0. Re-check after Phase 1 design.*

| Principle | Assessment |
| --- | --- |
| §I Secure-by-Default — public endpoints GET-only | **Pass by construction.** The new namespace registers only `app.get`. Public Sonos control was requested in #66 and is out of scope by the requester's own decision; there is no non-GET public route in this design. |
| §I — default deny | **Pass.** Migration backfills every existing widget to `hidden` (FR-002). The column is `NOT NULL DEFAULT 'hidden'`, so a widget created by any future code path is private unless someone says otherwise. |
| §I — no settings/admin metadata on public routes | **Pass.** Public payloads are built by per-type projection functions, never by returning an internal record. Asserted by test (SC-006), not by review. |
| §I — must not weaken existing authenticated routes | **Pass.** FR-012 is enforced structurally: no existing route's guard changes. A test asserts every route in #100's matrix still rejects anonymous callers. |
| §II Test-first | Contract tests for the public namespace are written before the routes exist, and must be shown failing. |
| §V Logging | `logs/readme.md` exists; a phase log per implementation phase. |

**No violations to justify.** Complexity Tracking is therefore empty.

## Project Structure

### Documentation (this feature)

```text
specs/045-public-widget-visibility/
├── spec.md              # Complete, both clarifications resolved
├── plan.md              # This file
├── research.md          # Phase 0 — complete
├── data-model.md        # Phase 1 — complete
├── contracts/           # Phase 1 — complete
├── quickstart.md        # Phase 1 — complete
├── tasks.md             # Phase 2 — complete
└── logs/
    └── readme.md        # Canonical index (exists)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── public.ts                  # MODIFY — bootstrap filter + GET-only widget namespace
│   ├── services/
│   │   ├── publicVisibility.ts        # NEW — the single authorization decision
│   │   └── publicWidgetProjection.ts  # NEW — per-type safe payload projection
│   │   └── publicWidgetSnapshotCache.ts # NEW — shared single-flight public snapshots
│   ├── auth/rateLimit.ts              # MODIFY — publicWidgetRateLimit
│   └── db/
│       ├── schema/index.ts            # MODIFY — publicVisibility column
│       └── migrations/0027_*.sql      # NEW
└── tests/integration/
    ├── publicWidgetVisibility.test.ts # NEW — the enforcement net
    └── widgetDataPermissions.test.ts  # EXTEND — assert #100 guards unchanged

frontend/
├── src/
│   ├── hooks/useIsPublicView.ts       # NEW — does not exist today
│   ├── state/bootstrap.ts             # MODIFY — carry public flag
│   ├── components/admin/              # MODIFY — visibility control + indicator
│   └── widgets/*/                     # MODIFY — public data source per widget
└── tests/
```

**Structure Decision**: existing `backend/` + `frontend/` workspaces. The new
backend files are deliberately small and single-purpose so the authorization
decision has exactly one home.

## Design Decisions

### D-01: A separate public namespace, not a public-aware guard

**Decision.** Serve anonymous widget data from new `GET /api/public/widgets/...`
routes. Do **not** teach existing routes to accept anonymous callers.

**Why.** The alternative — a `requirePublicOrAuth(...)` guard swapped into each
widget data route — spreads the anonymous path across a dozen files and makes
every future route a chance to leak by omission. That is the shape of the bug
043 had to close (#189). A separate namespace is additive (FR-012), GET-only by
construction (§I), and puts the whole anonymous surface in one reviewable file.

**Cost.** The frontend needs to select a data source by view mode. FR-013
requires exactly that anyway: the public view must not call authenticated
routes at all.

### D-02: Resolve the widget through the public dashboard, never from the URL

**Decision.** A public request carries a widget id, but the server does not
trust it. It resolves the designated public dashboard for the request's device
context, walks placeholders → widgets, and only then matches the id.

**Why.** This makes FR-006 structural rather than a check someone can forget,
and it satisfies FR-010 for free: a widget on a private dashboard and a widget
that does not exist both simply fail to be found, so they return the same 404.
It also mirrors 043's rule of resolving the target server-side by identity.

### D-03: Visibility and source principal on the widget instance

**Decision.** Add `public_visibility TEXT NOT NULL DEFAULT 'hidden'` to
`app_widget_instances`, values `hidden` | `read-only` | `visible`.

Add nullable `public_source_user_id` referencing `users(id)` with `ON DELETE
SET NULL`. Public requests have no identity, while Sonos cloud credentials are
user-scoped. When an admin exposes a supported integration widget, the server
binds that admin as the internal source principal; clients cannot choose this
field and public APIs never return it.

`read-only` and `visible` are distinct in the schema because the spec asks for
three modes (FR-001), but they are **identical in effect** for this feature: no
anonymous caller can change state regardless (FR-007, and the Sonos decision).
`visible` exists so a future feature can grant interaction without a migration.
The plan will not build any behaviour that distinguishes them, and the tasks
must not pretend otherwise.

**Why columns, not `configJson`.** Visibility is queried when filtering the
bootstrap payload and when authorizing every public fetch. It must be indexable
and enforceable in SQL, not parsed out of per-type JSON. The source principal is
an authorization-sensitive relationship, not display configuration.

### D-04: Per-type projection functions, allowlist style

**Decision.** Each publicly-exposable widget type gets an explicit
`toPublicPayload(...)` that names the fields it emits. No spreading of internal
records, no deny-list.

**Why.** FR-009 and SC-006. A deny-list fails the moment an integration adds a
field. The credential-shaped-field assertion from #100's test is extended to
cover every public payload.

### D-05: Filter the bootstrap dashboard rather than leave it and hide client-side

**Decision.** `/api/public/bootstrap` prunes non-public widgets — and
placeholders left empty by that pruning — before returning.

**Why.** FR-005 and FR-014. Returning the full dashboard and hiding widgets in
React is not a permission; the layout is already public information leakage
(it names every widget type the household runs). Pruning server-side also gives
FR-014's "no conspicuous gap" naturally, since the layout engine never sees the
widget.

### D-06: FR-020 audit — record, but do not build a subsystem

**Decision.** There is no audit log table today. Satisfy FR-020 with structured
server logging of visibility changes (who, which widget, old → new, when) via
the existing Fastify logger. Do not introduce an audit table in this feature.

**Why.** An operator can grep it after the fact, which is what FR-020 asks for.
A durable audit trail is a general capability and should not be smuggled in as
a side effect of a visibility setting. Flag it as a candidate follow-up issue.

### D-07: Which widget types get a public path in v1

Public data routes are built only for types where the spec's user stories need
them and the payload is genuinely safe to project: **Pi-hole stats**, **UniFi
stats** (normal read payload — `summary` mode is out of scope per the resolved
clarification), **Sonos now-playing state (read-only)**, **stocks**, and **app
shortcuts**. Self-contained widgets (clock, markdown, links, iframe, photo
frame) already render from their own stored config and need no new route.

**Docker is explicitly excluded** — no public route, no visibility mode that
does anything, in either direction (FR-008).

## Implementation Phases

Each phase ends with a commit and a phase log under `logs/`.

| Phase | Name | Outcome |
| ----- | ---- | ------- |
| 1 | Setup & baselines | Re-capture the four baselines on this branch; write the phase 1 log. No behaviour change. |
| 2 | Visibility model | `publicVisibility` column + migration `0027_*`, backfill all existing widgets to `hidden`, schema types. Proves FR-002/FR-004 with a migration test. |
| 3 | Authorization service | `publicVisibility.ts`: resolve public dashboard → placeholder → widget, return a decision. Unit-tested in isolation, including the "indistinguishable from missing" case (FR-010). |
| 4 | Public data namespace | New routes in `public.ts` + projections + `publicWidgetRateLimit`. **Contract tests written first and shown failing.** Covers FR-005/006/007/009/010/011. |
| 5 | Bootstrap pruning | Filter the dashboard in `public.ts`; empty placeholders removed (FR-005, FR-014). |
| 6 | Frontend public mode | `useIsPublicView()`, data-source selection per widget, no authenticated calls in public view, no control affordances (FR-013/014/015/016). |
| 7 | Administration UI | Per-widget control + at-a-glance indicator + the exposure warning copy (FR-017/018/019). |
| 8 | Verification & docs | Playwright pass over a real public dashboard; negative coverage of every control route (SC-005); README/CHANGELOG behaviour-change note (FR-022). |

Phases 2→5 are the security spine and should land before any UI work. Phase 6
is useless without them and phase 7 is cosmetic without phase 6.

## Test & Error Logging

Per constitution §V, each phase writes `logs/NN-phase-<name>.md` with the
commands run, their exit codes, and raw output in a sidecar directory.

**The gate is "no NEW problems versus baseline", never "clean".** Baselines to
re-capture in phase 1 (carried forward for reference):

| Command | Baseline |
| --- | --- |
| `pnpm lint` | 81 problems (54 errors, 27 warnings) |
| `pnpm typecheck` | 23 errors, all in backend test files |
| `pnpm --filter backend test` | 3 known `calendar-phase7.test.ts` failures |
| `pnpm --filter backend openapi:lint` | 5 errors, 39 warnings |

Known flakes: `rateLimit.test.ts` and `auth.test.ts` under full-suite load.
Note that phase 4 adds a rate-limited route, so `rateLimit.test.ts` flakiness
needs watching rather than assuming.

**Testing gotchas carried from #100:**

- `pnpm --filter backend test -- <file>` does **not** filter. Use
  `pnpm --filter backend exec vitest run <file>`.
- `/api/sonos/status` and `/api/sonos/households` fall through to live device
  discovery when authenticated and exceed vitest's 5s default. Assert on them
  anonymously, or give them an explicit timeout.

## Risks & Open Questions

| # | Risk | Mitigation |
| - | ---- | ---------- |
| R-01 | Anonymous polling becomes an outbound amplifier against the integration host (a public URL + a 10s poll is a free proxy). | **Resolved in [research.md](./research.md):** a demand-driven, per-widget public snapshot cache with single-flight refresh, bounded stale-on-error and failure backoff. Per-IP rate limiting remains an independent inbound control. |
| R-02 | A future widget type ships without a projection and leaks its internal record. | Projection is allowlist-only (D-04) and the public route refuses to serve a type with no registered projection. |
| R-03 | `read-only` vs `visible` invites someone to implement a difference that §I forbids. | D-03 states the two are identical in effect; phase 4 tests assert both behave the same. |
| R-04 | Pruning the bootstrap breaks the screensaver/kiosk path, which renders a public dashboard. | Spec edge case; phase 5 must cover the screensaver explicitly. |
| R-05 | Public exposure follows the widget rather than the dashboard if a widget appears on two dashboards. | D-02 resolves through the public dashboard, so exposure is per-dashboard by construction. Needs an explicit test. |

**Open — not blocking:** durable audit logging (D-06) is deferred and should
become its own issue. R-01 is resolved by [research.md](./research.md); no
implementation-blocking research questions remain.

## Complexity Tracking

No constitutional violations. Nothing to justify.
