# Tasks: App Shortcuts Widget

**Input**: Design documents from `/specs/013-app-shortcuts/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/app-shortcuts-api.yaml, quickstart.md

**Tests**: Backend service and route tests are REQUIRED (auth/network/data changes). Frontend component tests are REQUIRED (new widget with CRUD). Tests follow TDD — write first, verify they fail, then implement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, migrations, and shared type definitions for the App Shortcuts widget

- [X] T001 Add `shortcutGroups`, `appShortcuts`, and `shortcutPingResults` table definitions to `backend/src/db/schema/index.ts` per data-model.md (includes Drizzle relations)
- [X] T002 Generate and apply Drizzle migration (`pnpm -C backend drizzle-kit generate && pnpm -C backend drizzle-kit push`)
- [X] T003 [P] Add `AppShortcutsConfig` interface (columns field) and shortcut/group/ping view types to `frontend/src/state/dashboards.ts`
- [X] T004 [P] Add Zod validation schemas for shortcut, group, and widget config inputs in `backend/src/services/appShortcutService.ts` (CreateShortcutInput, UpdateShortcutInput, CreateGroupInput, UpdateGroupInput, ReorderInput, configJson schema with columns 2–8 default 4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend service layer that ALL user stories depend on — CRUD operations for shortcuts and groups

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundation ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T005 [P] Write unit tests for shortcut CRUD (create, read, update, delete, list by widgetId) in `backend/tests/services/appShortcutService.test.ts`
- [ ] T006 [P] Write unit tests for group CRUD (create, read, update, delete, list by widgetId) in `backend/tests/services/appShortcutService.test.ts`
- [ ] T007 [P] Write unit tests for reorder operations (shortcuts and groups) in `backend/tests/services/appShortcutService.test.ts`

### Implementation for Foundation

- [X] T008 Implement `appShortcutService.ts` — shortcut CRUD functions (createShortcut, getShortcut, updateShortcut, deleteShortcut, listShortcuts) with Zod validation in `backend/src/services/appShortcutService.ts`
- [X] T009 Implement group CRUD functions (createGroup, updateGroup, deleteGroup, listGroups) in `backend/src/services/appShortcutService.ts`
- [X] T010 Implement reorder functions (reorderShortcuts, reorderGroups) accepting orderedIds array in `backend/src/services/appShortcutService.ts`
- [ ] T011 Verify all T005–T007 tests pass

**Checkpoint**: Foundation ready — schema in place, service layer tested, user story implementation can now begin

---

## Phase 3: User Story 1 — Add and Launch App Shortcuts (Priority: P1) 🎯 MVP

**Goal**: Users can add shortcuts (name + URL), see them in a grid, edit/delete them, and click to open in a new tab. This delivers the core app launcher.

**Independent Test**: Add 3–5 shortcuts, verify each renders in grid and opens correct URL in new tab. Edit one shortcut's URL, delete another, confirm changes.

### Tests for User Story 1 ⚠️

- [ ] T012 [P] [US1] Write route tests for shortcut CRUD endpoints (POST/GET/PUT/DELETE `/admin/app-shortcuts/:widgetId/shortcuts`) verifying auth, CSRF, validation, and response shapes in `backend/tests/services/appShortcutService.test.ts`
- [ ] T013 [P] [US1] Write route tests for shortcut reorder endpoint (POST `/admin/app-shortcuts/:widgetId/shortcuts/reorder`) in `backend/tests/services/appShortcutService.test.ts`
- [ ] T014 [P] [US1] Write component tests for `AppShortcutsWidget` (renders grid of shortcuts, click opens new tab, empty state) in `frontend/tests/components/AppShortcutsWidget.test.tsx`
- [ ] T015 [P] [US1] Write component tests for `AppShortcutsConfigForm` (add shortcut form validation — name/URL required, edit shortcut, delete shortcut) in `frontend/tests/components/AppShortcutsConfigForm.test.tsx`

### Implementation for User Story 1

- [X] T016 [US1] Create admin API routes for shortcut CRUD + reorder in `backend/src/api/admin-app-shortcuts.ts` — register routes under `/admin/app-shortcuts/:widgetId/shortcuts` with admin auth + CSRF middleware (list, create, update, delete, reorder)
- [X] T017 [US1] Register shortcut routes in `backend/src/api/index.ts` (import and register admin-app-shortcuts plugin)
- [X] T018 [P] [US1] Create TanStack Query hooks for shortcuts (useShortcuts, useCreateShortcut, useUpdateShortcut, useDeleteShortcut, useReorderShortcuts) in `frontend/src/state/appShortcutHooks.ts`
- [X] T019 [US1] Create `AppShortcutsWidget.tsx` display component in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — renders shortcut grid (configurable columns via Tailwind grid classes), each item shows name + placeholder icon, click opens URL via `window.open(url, '_blank')`, empty state with "Add shortcut" prompt
- [X] T020 [US1] Create `AppShortcutsConfigForm.tsx` in `frontend/src/components/widgets/AppShortcutsConfigForm.tsx` — form to add/edit/delete shortcuts (name, URL fields with validation), column count slider (2–8), shortcut list with edit/delete actions
- [X] T021 [US1] Register `app_shortcuts` widget type in `frontend/src/components/widgets/registry.tsx` with LayoutGrid icon, defaultConfig `{ columns: 4 }`, DisplayComponent and ConfigFormComponent
- [ ] T022 [US1] Verify all T012–T015 tests pass

**Checkpoint**: User Story 1 complete — functional app launcher with CRUD, grid display, and new-tab launch

---

## Phase 4: User Story 2 — Icon Display and Favicon Fetching (Priority: P2)

**Goal**: Shortcuts display recognisable icons — auto-fetched favicons from target URLs, custom icon uploads, and placeholder fallbacks.

**Independent Test**: Add shortcut to a URL with a known favicon — verify icon appears. Upload a custom icon — verify it replaces the fetched one. Add shortcut to unreachable URL — verify placeholder icon displays.

### Tests for User Story 2 ⚠️

- [ ] T023 [P] [US2] Write unit tests for `faviconFetchService` (successful fetch, timeout after 5s, unreachable URL fallback, HTML parsing for `<link rel="icon">`, `/favicon.ico` fallback) in `backend/tests/services/faviconFetchService.test.ts`
- [ ] T024 [P] [US2] Write route tests for icon upload endpoint (POST `/admin/app-shortcuts/:widgetId/shortcuts/:shortcutId/icon` — valid image formats, reject >512KB, reject non-image, magic-byte validation) in `backend/tests/services/appShortcutService.test.ts`
- [ ] T025 [P] [US2] Write route tests for icon delete and favicon re-fetch endpoints in `backend/tests/services/appShortcutService.test.ts`

### Implementation for User Story 2

- [ ] T026 [US2] Create `faviconFetchService.ts` in `backend/src/services/faviconFetchService.ts` — `fetchFavicon(url: string): Promise<Buffer | null>` that fetches target URL, parses HTML for `<link rel="icon">` href, falls back to `/favicon.ico`, 5s timeout via AbortSignal, stores result as uploaded_asset with kind `'shortcut_icon'`
- [ ] T027 [US2] Integrate favicon fetch into shortcut create flow — call `fetchFavicon` async after shortcut creation (non-blocking), update `iconAssetId` on success in `backend/src/services/appShortcutService.ts`
- [ ] T028 [US2] Add icon upload/delete/re-fetch routes to `backend/src/api/admin-app-shortcuts.ts` — POST `/:shortcutId/icon` (multipart upload, validate format + size via existing asset pattern, set `iconOverrideAssetId`), DELETE `/:shortcutId/icon` (clear override), POST `/:shortcutId/fetch-icon` (trigger re-fetch)
- [ ] T029 [US2] Add resolved `iconUrl` to shortcut list response — compute priority: `iconOverrideAssetId` > `iconAssetId` > null, resolve asset ID to `/api/assets/:id` URL in `backend/src/services/appShortcutService.ts`
- [ ] T030 [US2] Update `AppShortcutsWidget.tsx` to display shortcut icons — show resolved `iconUrl` as `<img>` with fallback to a default LayoutGrid placeholder icon in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T031 [US2] Add icon upload UI to `AppShortcutsConfigForm.tsx` — file input for custom icon (accept PNG/JPEG/SVG/ICO/WebP, max 512KB client-side check), upload button, remove icon button in `frontend/src/components/widgets/AppShortcutsConfigForm.tsx`
- [ ] T032 [P] [US2] Add `useUploadShortcutIcon`, `useDeleteShortcutIcon`, `useRefetchFavicon` mutation hooks in `frontend/src/state/appShortcutHooks.ts`
- [ ] T033 [US2] Verify all T023–T025 tests pass

**Checkpoint**: User Story 2 complete — shortcuts display auto-fetched favicons with custom upload override and graceful fallbacks

---

## Phase 5: User Story 3 — Configurable Grid Layout (Priority: P2)

**Goal**: Users can control the number of grid columns (2–8) and the layout adapts responsively on smaller screens.

**Independent Test**: Change column count from 4 to 3 in config — verify grid re-renders with 3 columns. Resize browser to small viewport — verify columns reduce responsively.

### Tests for User Story 3 ⚠️

- [ ] T034 [P] [US3] Write component tests for column count configuration (slider changes value, grid renders correct column count, responsive breakpoints) in `frontend/tests/components/AppShortcutsWidget.test.tsx`

### Implementation for User Story 3

- [ ] T035 [US3] Implement responsive grid column logic in `AppShortcutsWidget.tsx` — use CSS grid with `grid-template-columns` driven by `config.columns`, add responsive breakpoints (reduce columns below md/sm) via Tailwind classes in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T036 [US3] Add column count configuration UI (number input or slider, min 2, max 8, default 4) with validation and live preview to `AppShortcutsConfigForm.tsx` in `frontend/src/components/widgets/AppShortcutsConfigForm.tsx`
- [ ] T037 [US3] Verify T034 tests pass

**Checkpoint**: User Story 3 complete — configurable and responsive grid layout

---

## Phase 6: User Story 4 — App Grouping and Categories (Priority: P3)

**Goal**: Users can organise shortcuts into named groups (e.g., "Media", "Infrastructure") with visual section headers. Ungrouped shortcuts appear in a default section.

**Independent Test**: Create two groups ("Media", "Tools"), assign shortcuts to each, verify they render under separate section headers. Delete a group — verify its shortcuts move to "Ungrouped".

### Tests for User Story 4 ⚠️

- [ ] T038 [P] [US4] Write route tests for group CRUD endpoints (POST/GET/PUT/DELETE `/admin/app-shortcuts/:widgetId/groups`, reorder) in `backend/tests/services/appShortcutService.test.ts`
- [ ] T039 [P] [US4] Write component tests for group rendering (section headers, ungrouped section, group CRUD in config form) in `frontend/tests/components/AppShortcutsWidget.test.tsx`

### Implementation for User Story 4

- [ ] T040 [US4] Add group CRUD + reorder routes to `backend/src/api/admin-app-shortcuts.ts` — POST/GET/PUT/DELETE `/groups`, POST `/groups/reorder` with admin auth + CSRF
- [ ] T041 [US4] Update shortcut list endpoint to return grouped response shape (`{ groups: GroupView[], shortcuts: ShortcutView[] }`) with shortcuts including `groupId` in `backend/src/api/admin-app-shortcuts.ts`
- [ ] T042 [US4] Update `AppShortcutsWidget.tsx` to render shortcuts grouped by section — group headers with group name, ungrouped shortcuts under "Ungrouped" at the end, preserve order within groups in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T043 [US4] Add group management UI to `AppShortcutsConfigForm.tsx` — create/rename/delete groups, assign shortcuts to groups via dropdown, drag-and-drop group reordering in `frontend/src/components/widgets/AppShortcutsConfigForm.tsx`
- [ ] T044 [P] [US4] Add `useGroups`, `useCreateGroup`, `useUpdateGroup`, `useDeleteGroup`, `useReorderGroups` hooks in `frontend/src/state/appShortcutHooks.ts`
- [ ] T045 [US4] Verify all T038–T039 tests pass

**Checkpoint**: User Story 4 complete — shortcuts organised in named groups with full group management

---

## Phase 7: User Story 5 — Optional Health/Status Ping (Priority: P3)

**Goal**: Users can enable a per-shortcut status ping. The backend periodically checks URL reachability and displays a green (up) or red (down) dot on each shortcut.

**Independent Test**: Enable ping on a shortcut to a running service — expect green dot. Enable ping on a shortcut to a non-existent address — expect red dot. Disable ping — indicator disappears.

### Tests for User Story 5 ⚠️

- [ ] T046 [P] [US5] Write unit tests for `shortcutPingService` (single ping up/down/timeout, batch ping within 30s budget, upsert ping results, cleanup on disable) in `backend/tests/services/shortcutPingService.test.ts`
- [ ] T047 [P] [US5] Write route tests for ping results endpoints (GET `/ping-results`, POST `/ping-results/refresh`) in `backend/tests/services/shortcutPingService.test.ts`
- [ ] T048 [P] [US5] Write component tests for ping status indicators (green/red/unknown dot, no indicator when disabled, auto-refresh) in `frontend/tests/components/AppShortcutsWidget.test.tsx`

### Implementation for User Story 5

- [ ] T049 [US5] Create `shortcutPingService.ts` in `backend/src/services/shortcutPingService.ts` — `runPingCycle(widgetId: string)` that queries all ping-enabled shortcuts for the widget, uses `executeChecks()` from `statusCheckService.ts` pattern (HTTP HEAD with 5s timeout, 2xx/3xx = up), upserts results into `shortcut_ping_results`, completes within 30s total
- [ ] T050 [US5] Add periodic ping scheduling — register a 60s interval timer on backend startup that runs ping cycles for all widgets with ping-enabled shortcuts, handle cleanup on server shutdown in `backend/src/services/shortcutPingService.ts`
- [ ] T051 [US5] Add ping results routes to `backend/src/api/admin-app-shortcuts.ts` — GET `/ping-results` (return cached results), POST `/ping-results/refresh` (trigger immediate cycle and return fresh results)
- [ ] T052 [US5] Include `pingStatus` in shortcut list response — join `shortcut_ping_results` for ping-enabled shortcuts, return `{ status, responseTimeMs, checkedAt, error }` or null in `backend/src/services/appShortcutService.ts`
- [ ] T053 [US5] Update `AppShortcutsWidget.tsx` to display ping status indicators — green dot (up), red dot (down), grey dot (unknown), no dot (ping disabled), use absolute-positioned dot overlay on shortcut icon in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T054 [US5] Add ping toggle to shortcut edit form in `AppShortcutsConfigForm.tsx` — checkbox "Enable status ping" per shortcut in `frontend/src/components/widgets/AppShortcutsConfigForm.tsx`
- [ ] T055 [P] [US5] Add `usePingResults` query hook (auto-refetch every 60s) and `useRefreshPings` mutation hook in `frontend/src/state/appShortcutHooks.ts`
- [ ] T056 [US5] Verify all T046–T048 tests pass

**Checkpoint**: User Story 5 complete — status indicators show live reachability with periodic background checks

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Ensure all shortcut touch targets are ≥44×44px for mobile usability across `AppShortcutsWidget.tsx` in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T058 [P] Add ARIA labels and keyboard navigation support to shortcut grid and drag handles in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T059 [P] Add structured logging for failed favicon fetches and failed ping checks with URL + error reason in `backend/src/services/faviconFetchService.ts` and `backend/src/services/shortcutPingService.ts`
- [ ] T060 Verify large shortcut count performance — test with 50 shortcuts, confirm widget renders in <1s and remains scrollable in `frontend/src/components/widgets/AppShortcutsWidget.tsx`
- [ ] T061 Run full quickstart.md verification checklist (all 6 phases)
- [ ] T062 Run full test suite (`pnpm -C backend vitest run && pnpm -C frontend vitest run`) and type checking (`pnpm -C backend tsc --noEmit && pnpm -C frontend tsc --noEmit`)
- [ ] T063 Run linter (`pnpm eslint .`) and fix any issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — delivers MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2 + partially on US1 routes (icon endpoints extend same route file)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs widget component to exist)
- **User Story 4 (Phase 6)**: Depends on Phase 2 — can run in parallel with US1/US2 if needed
- **User Story 5 (Phase 7)**: Depends on Phase 2 — can run in parallel with US1–US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P2)**: After Foundational — integrates with US1 (adds icon display to existing widget)
- **US3 (P2)**: After US1 (extends existing widget component with grid config)
- **US4 (P3)**: After Foundational — integrates with US1 (adds grouped rendering to existing widget)
- **US5 (P3)**: After Foundational — integrates with US1 (adds ping indicators to existing widget)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/schema before services
- Services before routes
- Backend before frontend hooks
- Hooks before components
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T005, T006, T007 can all run in parallel (same file but independent test suites)
- All test tasks within a phase marked [P] can run in parallel
- T018 (hooks) can run in parallel with T016 (routes) since hooks just define the fetch shape
- T032, T044, T055 (hook additions for US2/US4/US5) are independent of each other
- T057, T058, T059 (polish tasks) can all run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T012: "Route tests for shortcut CRUD endpoints"
Task T013: "Route tests for shortcut reorder endpoint"
Task T014: "Component tests for AppShortcutsWidget"
Task T015: "Component tests for AppShortcutsConfigForm"

# After tests written, launch parallel frontend work:
Task T018: "TanStack Query hooks" (parallel with T016/T017 backend routes)
```

## Parallel Example: User Story 2

```bash
# Launch all tests together:
Task T023: "Unit tests for faviconFetchService"
Task T024: "Route tests for icon upload endpoint"
Task T025: "Route tests for icon delete and re-fetch"

# After tests, parallel frontend work:
Task T032: "Icon mutation hooks" (parallel with T028 backend routes)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + types)
2. Complete Phase 2: Foundational (service CRUD + tests)
3. Complete Phase 3: User Story 1 (routes + widget + config form)
4. **STOP and VALIDATE**: Test by adding 3–5 shortcuts, verifying grid display and new-tab launch
5. Deploy/demo if ready — functional app launcher

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo **(MVP! 🎯)**
3. Add US2 (icons) + US3 (grid config) → Test independently → Deploy/Demo
4. Add US4 (groups) → Test independently → Deploy/Demo
5. Add US5 (ping) → Test independently → Deploy/Demo
6. Polish → Final validation → Release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (core shortcuts) → US3 (grid config)
   - Developer B: US2 (icons/favicons)
   - Developer C: US4 (groups) → US5 (ping)
3. Stories integrate independently into the same widget

---

## Notes

- [P] tasks = different files, no dependencies on in-progress tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Widget type key is `'app_shortcuts'` throughout (matches registry pattern)
- Reuse existing `executeChecks()` pattern from `statusCheckService.ts` for ping service
- Reuse existing asset upload pattern for icon management
- `configJson` stores only `{ columns: 4 }` — shortcuts/groups live in dedicated DB tables
