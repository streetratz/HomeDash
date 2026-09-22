# Tasks: Dashboard Duplication

**Input**: Design documents from `/specs/011-dashboard-duplication/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Backend unit, integration, and contract tests are included per constitution (auth/data mutation). Frontend E2E test included for full-flow verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- **Tests**: `backend/tests/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project scaffolding needed — this feature is additive to an existing monorepo. This phase ensures validation schemas and type foundations are ready.

- [ ] T001 Add `DuplicateDashboardParamsSchema` (UUID path param) in `backend/src/lib/validation.ts` — reuse existing `UuidSchema` if sufficient, otherwise add a thin wrapper for the `:dashboardId` path parameter

**Checkpoint**: Validation schema available for route registration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service logic that ALL user stories depend on — the `duplicateDashboard()` method and its `generateCopyName()` helper. These must be complete before any story-specific work can proceed.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Implement `generateCopyName(sourceName: string, existingNames: string[]): string` helper in `backend/src/services/dashboardService.ts` — strips trailing " (Copy)" or " (Copy N)" from source name, appends " (Copy)", resolves conflicts with numeric suffix "(Copy 2)", "(Copy 3)", and truncates base name if result exceeds 128 chars (per research.md R-02)
- [ ] T003 Implement `duplicateDashboard(sourceId: string): Promise<DashboardListItem>` method in `backend/src/services/dashboardService.ts` — loads full dashboard tree via `getDashboardWithChildren(sourceId)`, generates copy name, builds import payload preserving `backgroundAssetId` (unlike export which drops it per research.md R-03), delegates to `importDashboard()` within a single SQLite transaction (per research.md R-04), returns the newly created dashboard
- [ ] T004 [P] Write unit tests for `generateCopyName()` in `backend/tests/unit/dashboardDuplication.test.ts` — cover: basic copy, existing "(Copy)" suffix stripping, numeric conflict resolution "(Copy 2)"/"(Copy 3)", 128-char truncation, empty dashboard name edge case, already-suffixed source names like "Foo (Copy) (Copy)"

**Checkpoint**: Foundation ready — `duplicateDashboard()` service method works end-to-end with correct naming. User story implementation can begin.

---

## Phase 3: User Story 1 — Duplicate a Dashboard (Priority: P1) 🎯 MVP

**Goal**: An admin can select any existing dashboard, trigger "Duplicate", and receive a fully independent deep copy with all widgets, links, placeholders, layout, and settings — ready for immediate editing.

**Independent Test**: Select any dashboard → Duplicate → verify the new dashboard appears with all content copied and a unique name. Original dashboard is unchanged.

**Acceptance Criteria (from spec.md US1)**:
1. New dashboard contains copies of all widgets (with configs), links, placeholders, layout positions, and background settings
2. New dashboard named "[Original] (Copy)" with unique ID
3. Original dashboard completely unchanged
4. New copy is immediately editable

### Backend — Route & Integration

- [ ] T005 [US1] Register `POST /:dashboardId/duplicate` route in `backend/src/api/adminDashboards.ts` — apply `requireAdmin()` + `assertCsrf()` middleware (per constitution check), validate path param with schema from T001, call `duplicateDashboard(dashboardId)`, return 201 with `DashboardListItem` response body, handle 404 (source not found) and 500 (duplication failure) with structured error responses per contract `specs/011-dashboard-duplication/contracts/duplicate-dashboard.yaml`
- [ ] T006 [P] [US1] Write contract test for `POST /api/admin/dashboards/:dashboardId/duplicate` in `backend/tests/contract/dashboardDuplication.test.ts` — verify: 201 response shape matches `DashboardListItem` schema, 401 without auth, 403 without CSRF, 404 for non-existent dashboard ID, response includes new UUID ≠ source UUID
- [ ] T007 [P] [US1] Write integration test for full duplication flow in `backend/tests/integration/dashboardDuplication.test.ts` — seed a dashboard with 3+ placeholders, widgets (including `links_list` with items), and background image asset reference; duplicate via service; assert all placeholders/widgets/links copied with new UUIDs, layout positions preserved, `backgroundAssetId` preserved, original dashboard unchanged, `createdAt`/`updatedAt` are new timestamps

### Frontend — Mutation Hook

- [ ] T008 [US1] Add `useDuplicateDashboard()` mutation hook in `frontend/src/state/adminDashboards.ts` — follow existing `useCreateDashboard()` pattern: `apiClient.post<DashboardListItem>(\`/api/admin/dashboards/${dashboardId}/duplicate\`)`, `onSuccess` → `toast.success()` + `invalidateRelated(queryClient)`, `onError` → `toast.error()` (per quickstart.md pattern)

### Frontend — UI Integration

- [ ] T009 [US1] Add "Duplicate" button to dashboard card actions in `frontend/src/pages/DashboardManagementPage.tsx` — use `Button variant="ghost" size="icon"` with `Copy` icon from lucide-react, wire to `useDuplicateDashboard()` mutation, disable button while `mutation.isPending` (per research.md R-05 debounce strategy), add `aria-label="Duplicate dashboard"` for accessibility

**Checkpoint**: Full duplicate flow works — admin clicks Duplicate, backend creates atomic deep copy, frontend shows success toast. MVP complete.

---

## Phase 4: User Story 2 — Duplicate Dashboard with Unique Naming (Priority: P2)

**Goal**: When duplicating dashboards that already have "(Copy)" in their name, or when name collisions exist, the system generates a distinguishable unique name automatically.

**Independent Test**: Duplicate "Living Room" → get "Living Room (Copy)". Duplicate again → get "Living Room (Copy 2)". Duplicate "Living Room (Copy)" itself → get "Living Room (Copy 2)" or next available.

**Acceptance Criteria (from spec.md US2)**:
1. Duplicating when "(Copy)" name exists → produces "(Copy 2)"
2. Duplicating a dashboard already named "(Copy)" → produces distinguishable name without overwriting

> **Note**: The core naming logic is implemented in T002 (`generateCopyName`). This phase adds targeted tests and any edge-case refinements.

- [ ] T010 [US2] Add unit tests for naming conflict edge cases in `backend/tests/unit/dashboardDuplication.test.ts` — cover: duplicating "Foo (Copy)" produces "Foo (Copy 2)" not "Foo (Copy) (Copy)", duplicating when "Foo (Copy)" through "Foo (Copy 9)" all exist produces "Foo (Copy 10)", duplicating a dashboard with max-length name (128 chars) truncates base before appending suffix, duplicating dashboard named exactly " (Copy)" (edge: empty base name)
- [ ] T011 [P] [US2] Add integration test for sequential duplication naming in `backend/tests/integration/dashboardDuplication.test.ts` — seed "Living Room", duplicate 3 times via endpoint, assert names are "Living Room (Copy)", "Living Room (Copy 2)", "Living Room (Copy 3)" with no collisions

**Checkpoint**: Naming conflict resolution verified for all edge cases. Repeated duplication produces clean, distinguishable names.

---

## Phase 5: User Story 3 — Discover and Access Duplicate Action (Priority: P3)

**Goal**: The "Duplicate" action is easily discoverable in the dashboard management UI with clear feedback during and after the operation.

**Independent Test**: Navigate to dashboard management → verify Duplicate button is visible for each dashboard → trigger it → observe loading indicator and success notification.

**Acceptance Criteria (from spec.md US3)**:
1. "Duplicate" option visible alongside other management actions (edit, delete)
2. Clear feedback: loading indicator during duplication, success/error notification on completion

- [ ] T012 [US3] Enhance Duplicate button UX in `frontend/src/pages/DashboardManagementPage.tsx` — add tooltip "Duplicate dashboard" via shadcn Tooltip component, show spinner icon replacing Copy icon while `mutation.isPending`, ensure button placement is consistent with existing Edit/Delete action buttons in the card row, verify touch-friendly size (min 36×36px target area per constitution mobile-first check)
- [ ] T013 [US3] Add error feedback handling in `frontend/src/pages/DashboardManagementPage.tsx` — on duplication failure display toast with actionable error message (e.g., "Could not duplicate — dashboard may have been deleted"), handle edge case of rapidly navigating away during pending mutation (ensure no stale toast appears)
- [ ] T014 [P] [US3] Write E2E test for full duplicate flow in `frontend/tests/e2e/dashboardDuplication.spec.ts` — test: Duplicate button visible on each dashboard card, clicking triggers duplication and shows success toast, new dashboard appears in list with "(Copy)" name, button disabled during pending state, error toast on failure (mock 404)

**Checkpoint**: UX polish complete — duplicate action is discoverable, provides loading + success/error feedback, and works across desktop and mobile viewports.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, atomicity hardening, and operational logging.

- [ ] T015 Add structured logging to `duplicateDashboard()` in `backend/src/services/dashboardService.ts` — log `request.log.info` on duplication start (source dashboard ID), `request.log.info` on success (new dashboard ID + name), `request.log.error` on failure (source ID + error details) per NFR-005 operability requirement
- [ ] T016 Handle edge case: duplicating an empty dashboard (0 placeholders, 0 widgets) in `backend/tests/integration/dashboardDuplication.test.ts` — seed empty dashboard, duplicate, assert new dashboard created with correct name and settings, zero placeholders/widgets (spec edge case)
- [ ] T017 [P] Handle edge case: long dashboard name truncation in `backend/tests/unit/dashboardDuplication.test.ts` — verify that a 128-char name gets its base truncated so that base + " (Copy NNN)" still fits within 128 chars (data-model.md: name is 1–128 chars)
- [ ] T018 Verify atomicity: partial failure rollback in `backend/tests/integration/dashboardDuplication.test.ts` — mock or force a failure mid-transaction (e.g., after dashboard insert but before placeholder insert), verify no partial dashboard rows exist in DB (FR-007 atomicity requirement)

**Checkpoint**: All edge cases covered, operational logging in place, atomicity verified.

---

## Dependencies

```
T001 (validation schema)
  └── T002 + T003 (service methods) — depend on schema
       ├── T004 (unit tests) — parallel with T002/T003
       └── T005 (route) — depends on T003
            ├── T006 (contract test) — parallel with T007
            ├── T007 (integration test) — parallel with T006
            └── T008 (mutation hook) — depends on T005
                 └── T009 (UI button) — depends on T008
                      ├── T010 (naming edge cases) — depends on T002
                      ├── T011 (sequential naming integration) — depends on T005
                      ├── T012 (UX polish) — depends on T009
                      ├── T013 (error handling) — depends on T009
                      └── T014 (E2E test) — depends on T009
T015–T018 (polish) — depend on T003 + T005
```

## Parallel Execution Opportunities

### Within Phase 2 (Foundational):
- T004 (unit tests) can run in parallel with T002/T003 development (TDD)

### Within Phase 3 (US1):
- T006 (contract test) ‖ T007 (integration test) — different test files
- T006/T007 ‖ T008 (mutation hook) — backend tests vs frontend code

### Within Phase 5 (US3):
- T014 (E2E test) can be written in parallel with T012/T013 (different file)

### Within Phase 6 (Polish):
- T017 (name truncation unit test) ‖ T016 (empty dashboard integration) ‖ T018 (atomicity test)

## Implementation Strategy

### MVP (Minimum Viable Product): Phases 1–3
- **Scope**: T001–T009 (9 tasks)
- **Delivers**: Full duplicate flow end-to-end — admin can duplicate any dashboard and get a complete independent copy
- **Test coverage**: Unit tests for naming, contract test for API shape, integration test for deep copy correctness

### Increment 2: Phase 4
- **Scope**: T010–T011 (2 tasks)
- **Delivers**: Robust naming conflict resolution verified for repeated duplication

### Increment 3: Phase 5
- **Scope**: T012–T014 (3 tasks)
- **Delivers**: Polished UX with tooltips, loading states, and E2E test coverage

### Final: Phase 6
- **Scope**: T015–T018 (4 tasks)
- **Delivers**: Production-ready with logging, edge case handling, and atomicity verification
