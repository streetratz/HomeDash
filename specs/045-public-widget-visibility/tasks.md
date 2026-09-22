# Tasks: Public Dashboard Widget Visibility

**Feature**: `045-public-widget-visibility` | **Branch**: `045-public-widget-visibility`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/public-widgets.md](./contracts/public-widgets.md), [quickstart.md](./quickstart.md)

Tests are required by the specification and constitution. Every phase writes a
numbered Markdown log and raw sidecars under `logs/`.

---

## Table of Contents

- [Guardrails](#guardrails)
- [Phase 1: Setup and baselines](#phase-1-setup-and-baselines)
- [Phase 2: Visibility model](#phase-2-visibility-model)
- [Phase 3: Authorization service](#phase-3-authorization-service)
- [Phase 4: Public data namespace](#phase-4-public-data-namespace)
- [Phase 5: Bootstrap pruning](#phase-5-bootstrap-pruning)
- [Phase 6: Frontend public mode](#phase-6-frontend-public-mode)
- [Phase 7: Administration UI](#phase-7-administration-ui)
- [Phase 8: Verification and docs](#phase-8-verification-and-docs)
- [Dependencies](#dependencies)
- [Requirement coverage](#requirement-coverage)

---

## Guardrails

1. Do not change the guard on any existing widget data route.
2. Register no public non-GET route.
3. Resolve public widgets only through the selected unauthenticated dashboard.
4. Docker has no public projection or route.
5. Cache only projected payloads; authorize before cache lookup.
6. Generate migration SQL with Drizzle; never edit generated SQL manually.
7. Dashboard duplicate/import resets exposure to hidden.
8. Commit after each numbered phase with its completed log.

---

## Phase 1: Setup and baselines

- [x] T001 Create `logs/01-phase-setup-baselines.md` and sidecar directory with the constitution-required structure.
- [x] T002 Run and capture `pnpm lint`, `pnpm typecheck`, `pnpm --filter backend test`, and `pnpm --filter backend openapi:lint`; update `logs/readme.md` with exact counts.
- [x] T003 Re-check the Constitution Check after Phase 1 design and record that the public surface is GET-only, additive and default-deny.

**Checkpoint**: exact branch baseline recorded; no behavior change.

---

## Phase 2: Visibility model

- [x] T004 Create `logs/02-phase-visibility-model.md` and sidecar directory.
- [x] T005 Add `publicVisibility` and `publicSourceUserId` to `app_widget_instances` in `backend/src/db/schema/index.ts`.
- [x] T006 Run `pnpm --filter backend db:generate`; verify generated migrations default existing rows to hidden and apply `ON DELETE SET NULL`.
- [x] T007 Add `PublicVisibilitySchema` and visibility fields to layout/widget admin validation in `backend/src/api/adminDashboards.ts`.
- [x] T008 Extend dashboard service row/view/input types and CRUD/layout persistence in `backend/src/services/dashboardService.ts`.
- [x] T009 Bind the authenticated admin as source principal on exposure, clear on hide, and emit structured old→new visibility logs without secrets.
- [x] T010 Ensure duplicate/import creates hidden widgets with no source principal.
- [x] T011 Add migration, CRUD, duplicate/import, and audit-log tests.
- [x] T012 Run targeted backend tests and typecheck; complete phase log and commit.

**Checkpoint**: FR-001–FR-004, FR-019–FR-021 persisted safely.

---

## Phase 3: Authorization service

- [x] T013 Create `logs/03-phase-public-authorization.md` and sidecar directory.
- [x] T014 Add backend-owned intrinsic/exposable/never-public type allowlists in `backend/src/services/publicVisibility.ts`.
- [x] T015 Implement `resolvePublicWidget(deviceContext, widgetId)` through selected dashboard → placeholder → widget.
- [x] T016 Return one internal resolved shape for supported exposed widgets and one constant not-found outcome for all denials.
- [x] T017 Add tests for hidden, missing, wrong dashboard, changed dashboard designation, unsupported/Docker, read-only and visible.
- [x] T018 Run targeted tests and typecheck; complete phase log and commit.

**Checkpoint**: FR-005, FR-006, FR-008, FR-010 structurally enforced.

---

## Phase 4: Public data namespace

- [x] T019 Create `logs/04-phase-public-data-namespace.md` and sidecar directory.
- [x] T020 Write failing contract/integration tests for `GET /api/public/widgets/:widgetId`, safe payloads, uniform 404, rate limit and unchanged authenticated guards.
- [x] T021 Add `publicWidgetRateLimit` in `backend/src/auth/rateLimit.ts`.
- [x] T022 Implement `backend/src/services/publicWidgetSnapshotCache.ts` with bounded map, single-flight refresh, stale window and failure backoff.
- [x] T023 Add cache unit tests with fake timers and injected loaders.
- [x] T024 Implement allowlist projections/loaders in `backend/src/services/publicWidgetProjection.ts` for Pi-hole, UniFi, Sonos, stocks and app shortcuts.
- [x] T025 For Sonos cloud, require the persisted source principal; construct one now-playing snapshot without controls/account metadata.
- [x] T026 Register the GET-only public widget route in `backend/src/api/public.ts`; validate UUID path input and authorize before cache lookup.
- [x] T027 Add recursive credential-shaped-field assertions and concurrent request loader-count assertions.
- [x] T028 Extend the widget-data permission coverage to prove all existing routes retain their guards.
- [x] T029 Run targeted cache/public-permission tests and typecheck; complete phase log and commit.

**Checkpoint**: FR-007, FR-009, FR-011, FR-012 and R-01 covered.

---

## Phase 5: Bootstrap pruning

- [x] T030 Create `logs/05-phase-bootstrap-pruning.md` and sidecar directory.
- [x] T031 Add a pure public-dashboard projection that keeps intrinsic types, keeps exposed supported types, removes never-public/hidden types and then empty placeholders.
- [x] T032 Apply the projection only in `GET /api/public/bootstrap`; authenticated dashboard views remain complete.
- [x] T033 Ensure public widget objects omit visibility/source-principal/admin metadata.
- [x] T034 Add web/mobile selected-dashboard, empty-placeholder, screensaver and no-dashboard tests.
- [x] T035 Run targeted tests and typecheck; complete phase log and commit.

**Checkpoint**: US1 backend complete; public bootstrap contains no broken widgets.

---

## Phase 6: Frontend public mode

- [x] T036 Create `logs/06-phase-frontend-public-mode.md` and sidecar directory.
- [x] T037 Read `frontend/AGENTS.md`; apply `design-taste` and `emil-design-eng` constraints before editing UI.
- [x] T038 Carry an explicit public-view flag from bootstrap/router state and expose `useIsPublicView()`.
- [x] T039 Add typed `usePublicWidgetSnapshot(widgetId)` through `apiClient`.
- [x] T040 Adapt Pi-hole, UniFi, Sonos, stocks and app-shortcut widgets to use public snapshots in public mode and existing hooks when signed in.
- [x] T041 Remove Sonos/Pi-hole controls, fullscreen management, settings links and configuration affordances entirely in public mode.
- [x] T042 Ensure hidden widgets never mount and no authenticated widget route is requested.
- [x] T043 Add frontend unit tests for data-source selection and absent controls.
- [x] T044 Run frontend unit tests, typecheck and build; complete phase log and commit.

**Checkpoint**: FR-013, FR-015, FR-016 complete.

---

## Phase 7: Administration UI

- [x] T045 Create `logs/07-phase-administration-ui.md` and sidecar directory.
- [x] T046 Extend `WidgetView`/`WidgetDraft` and layout save payload with `publicVisibility`.
- [x] T047 Add an accessible visibility selector using existing UI primitives with Hidden, Read-only and Visible labels.
- [x] T048 Show concise consequence copy; use stronger infrastructure-data warning for Pi-hole, UniFi, Sonos and stocks.
- [x] T049 Add an at-a-glance exposure indicator in edit mode without cluttering the normal dashboard.
- [x] T050 Disable or explain public exposure for Docker/unsupported types rather than implying it works.
- [x] T051 Verify 360px layout, keyboard focus, touch targets, light/dark contrast and reduced-motion behavior.
- [x] T052 Add component/unit tests for state display, warnings and save payload.
- [x] T053 Run frontend tests, typecheck and build; complete phase log and commit.

**Checkpoint**: FR-017–FR-019 and SC-003 complete.

---

## Phase 8: Verification and docs

- [x] T054 Create `logs/08-phase-verification-docs.md` and sidecar directory.
- [x] T055 Add Playwright coverage for clean anonymous rendering, public snapshot requests, absent controls and immediate revocation.
- [x] T056 Assert every control route reachable from exposed widget types rejects anonymous requests.
- [x] T057 Update `docs/getting-started.md`, `docs/operations.md` if applicable, README and release notes with default-hidden behavior and no-public-controls rule.
- [x] T058 Run quickstart manual verification, including multiple simultaneous anonymous viewers and loader-count evidence.
- [x] T059 Re-run lint, typecheck, backend tests, frontend tests/build, OpenAPI lint and E2E; compare each with Phase 1 baseline.
- [x] T060 Run `design-taste` and `emil-design-eng` ship review; fix findings.
- [x] T061 Run `code-review-standard` over the complete branch diff; fix high-confidence findings.
- [x] T062 Complete logs index and requirement coverage, commit, push and open PR against `main` with `Closes #66`, threat model and validation table.

---

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
```

The security spine is Phases 2–5. Frontend public mode must not land without it.

---

## Requirement coverage

| Requirements | Tasks |
| --- | --- |
| FR-001–FR-004 | T005–T012 |
| FR-005–FR-006, FR-010 | T014–T018, T031–T034 |
| FR-007–FR-012 | T020–T029 |
| FR-013–FR-016 | T038–T044 |
| FR-017–FR-020 | T009, T046–T053 |
| FR-021–FR-022 | T006, T010, T057 |
| SC-001–SC-007 | T027–T029, T033–T035, T043–T044, T052–T061 |
