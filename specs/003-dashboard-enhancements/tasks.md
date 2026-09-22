# Tasks: Dashboard Enhancements

**Input**: Design documents from `/specs/003-dashboard-enhancements/`
**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: Backend integration tests for import/export endpoints (TDD — tests written before implementation). Frontend E2E tests for icon picker, background settings, and import/export round-trip.

**Organization**: Tasks are grouped by phase/user story. Phases 1–2 are frontend-only (no backend changes). Phases 3–5 add import/export backend + frontend. Phase 6 is E2E testing and polish. US1–US2 are P1; US3–US4 are P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `backend/src/`, `frontend/src/`, `backend/tests/`, `frontend/tests/`

---

## Phase 1: Icon Picker Component + Integration (Frontend Only)

**Purpose**: Replace the text-based `iconKey` input with a visual, searchable Lucide icon grid dialog. No backend changes — `iconKey` is already a string field on links.

- [x] T001 [P] [US1] Create `<IconPicker>` dialog component: import `icons` from `lucide-react` to enumerate all icon names; render a shadcn/ui Dialog containing a search input (shadcn/ui Input) and a responsive CSS grid of icon buttons; each button renders the Lucide icon component dynamically and shows the icon name on hover/tooltip; search filters icons by name substring match (case-insensitive) with debounced input; highlight the currently selected icon; call `onSelect(iconName: string)` callback on click; close on selection, Escape, or outside click; grid is 6-col desktop, 3-col mobile; limit initial render to ~200 icons with "load more" or virtual scroll for performance (NFR-004) in frontend/src/components/IconPicker.tsx

- [x] T002 [US1] Integrate `<IconPicker>` into the link edit form: locate the existing `iconKey` text input field; replace it with a button showing the current icon (rendered via Lucide) + icon name label; clicking the button opens the `<IconPicker>` dialog; on icon selection, update the form's `iconKey` value; preserve existing form validation and save behavior in frontend/src/components/LinkEditForm.tsx (or the component that renders the link edit form — find via grep for `iconKey` input)

- [x] T003 [US1] Add empty/clear state to icon picker: add a "Clear icon" option at the top of the picker that sets `iconKey` to `null`; when no icon is selected, the button shows a generic placeholder icon (e.g., Lucide `Image` or `CircleDashed`) with "Choose icon" label in frontend/src/components/IconPicker.tsx and frontend/src/components/LinkEditForm.tsx

**Checkpoint**: Admin can visually browse and select Lucide icons when editing a link. Search filters icons in real time. Selected icon persists after save. US1 is fully functional.

---

## Phase 2: Background Customization UI (Frontend, Existing Backend)

**Purpose**: Build the frontend UI for configuring dashboard backgrounds using the existing backend schema fields (`backgroundType`, `backgroundColor`, `backgroundAssetId`, `backgroundDisplayMode`). No backend changes needed.

- [x] T004 [P] [US2] Create `<BackgroundSettings>` component: render a radio group for background type ("Solid Color" / "Image"); for solid color: render a color picker input (HTML `<input type="color">` styled with shadcn/ui or a shadcn/ui-compatible color picker) bound to `backgroundColor` hex value, with a text input showing the hex code for manual entry; for image: render a file upload dropzone/button that POSTs to `POST /api/admin/assets` (reuse existing upload pattern), displays the uploaded image thumbnail, and stores the returned `assetId` as `backgroundAssetId`; render a display mode selector (radio group: "Fill" / "Stretch") for image mode; include a live preview panel that applies the selected background to a miniature dashboard mockup using inline CSS styles matching DashboardGrid.tsx logic in frontend/src/components/BackgroundSettings.tsx

- [x] T005 [US2] Integrate `<BackgroundSettings>` into dashboard settings: locate the existing dashboard settings dialog/form (DashboardSettingsDialog or equivalent); add a "Background" section/tab containing the `<BackgroundSettings>` component; wire the component's state to the dashboard update mutation (PUT /api/admin/dashboards/:id) so that saving the settings persists `backgroundType`, `backgroundColor`, `backgroundAssetId`, and `backgroundDisplayMode`; ensure Cancel discards background changes in frontend/src/components/DashboardSettingsDialog.tsx (or equivalent)

- [x] T006 [US2] Handle background removal/reset: add a "Reset to Default" button in `<BackgroundSettings>` that sets `backgroundType` to `'solid'`, `backgroundColor` to `null`, `backgroundAssetId` to `null`, and `backgroundDisplayMode` to `null`; verify that saving these null values clears the dashboard background in frontend/src/components/BackgroundSettings.tsx

**Checkpoint**: Admin can configure solid color or image backgrounds via the settings UI. Live preview works. Changes persist after save. US2 is fully functional.

---

## Phase 3: Export Endpoint + Frontend Download

**Purpose**: Add a backend endpoint that serializes a complete dashboard (with all children) to JSON, and a frontend button that triggers a browser file download.

### Tests for Export ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T008)**

- [x] T007 [P] [US3] Add integration tests for GET /api/admin/dashboards/:id/export: 401 without auth, 404 for non-existent dashboard ID, 200 returns JSON with correct Content-Type and Content-Disposition header, response body contains dashboard name/slug/background fields, placeholders array with layout data, nested widgets with type/configJson/orderIndex, nested links with title/url/iconKey/orderIndex; verify export of dashboard with zero placeholders returns empty array; verify export includes a `version` field in backend/tests/integration/dashboardExport.test.ts

### Implementation for Export

- [x] T008 [US3] Add `exportDashboard(dashboardId)` service method: query dashboard by ID; fetch all placeholders for the dashboard; for each placeholder, fetch widgets and links; assemble into a typed export object `{ version: 1, dashboard: { name, slug, backgroundType, backgroundColor, backgroundDisplayMode }, placeholders: [{ stableKey, x, y, w, h, borderColor, widgets: [{ type, configJson, orderIndex }], links: [{ title, url, iconKey, orderIndex }] }] }`; return the assembled object; throw NotFound if dashboard doesn't exist in backend/src/services/dashboardService.ts

- [x] T009 [US3] Add GET /api/admin/dashboards/:id/export route: `requireAdmin()`; call `exportDashboard(id)`; set `Content-Type: application/json` and `Content-Disposition: attachment; filename="{slug}-export.json"`; return the export JSON in backend/src/api/adminDashboards.ts

- [x] T010 [P] [US3] Create `useDashboardExport` hook: call GET /api/admin/dashboards/:id/export via apiClient; on success, create a Blob from the response JSON, generate a URL via `URL.createObjectURL`, trigger download by creating and clicking a temporary `<a>` element with `download` attribute; revoke the Blob URL after download in frontend/src/hooks/useDashboardExport.ts

- [x] T011 [US3] Add "Export" button to dashboard settings or dashboard header: render a download icon button (Lucide `Download`) with label "Export JSON"; on click, trigger the `useDashboardExport` hook; show a loading spinner during download; show toast notification on success/failure in frontend/src/components/DashboardSettingsDialog.tsx (or dashboard header area)

**Checkpoint**: Admin can export any dashboard as a JSON file download. Export contains all dashboard data. Auth is enforced. US3 is fully functional.

---

## Phase 4: Import Endpoint + Frontend Upload UI

**Purpose**: Add a backend endpoint that accepts export JSON and creates a new dashboard with all children, and a frontend dialog for file upload with validation and conflict handling.

### Tests for Import ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T013)**

- [x] T012 [P] [US4] Add integration tests for POST /api/admin/dashboards/import: 401 without auth, 403 without CSRF, 400 on malformed JSON (missing required fields, wrong types, empty body), 400 on invalid version number, 409 on slug conflict (response includes existing dashboard name), 201 on successful import (verify dashboard + placeholders + widgets + links are created with correct data), verify transaction rollback on mid-import failure (e.g., invalid widget type doesn't leave orphaned placeholders), verify imported dashboard appears in dashboard list in backend/tests/integration/dashboardImport.test.ts

### Implementation for Import

- [x] T013 [US4] Add export JSON Zod validation schema: `DashboardImportSchema` with version (literal 1), dashboard object (name: string, slug: string, backgroundType, backgroundColor, backgroundDisplayMode — all matching existing schemas), placeholders array of objects (stableKey, x, y, w, h, borderColor, widgets array, links array); widgets have type + configJson + orderIndex; links have title + url + iconKey + orderIndex; apply reasonable limits (max 50 placeholders, max 100 widgets per placeholder, max 200 links per placeholder) in backend/src/lib/validation.ts

- [x] T014 [US4] Add `importDashboard(payload, overrideName?)` service method: validate payload via DashboardImportSchema; check if slug already exists — if so and no overrideName, throw SlugConflict error with existing dashboard info; wrap all inserts in a single `db.transaction()`: insert dashboard (with overrideName/auto-slug if provided), insert placeholders with new UUIDs mapped to dashboard, insert widgets mapped to new placeholder IDs, insert links mapped to new placeholder IDs; return the created dashboard in backend/src/services/dashboardService.ts

- [x] T015 [US4] Add POST /api/admin/dashboards/import route: `requireAdmin()` + `assertCsrf()`; parse JSON body; call `importDashboard(body, body.overrideName?)`; on SlugConflict, return 409 with `{ conflict: true, existingName, existingSlug }`; on validation error, return 400 with details; on success, return 201 with created dashboard summary in backend/src/api/adminDashboards.ts

- [x] T016 [P] [US4] Create `<DashboardImportDialog>` component: shadcn/ui Dialog with file input accepting `.json` files; on file select, read file via FileReader, parse JSON, show parsed dashboard name/slug and placeholder/widget/link counts as a preview summary; on "Import" button click, POST to /api/admin/dashboards/import via apiClient with CSRF; on 409 conflict, show inline form to enter new dashboard name (auto-generate slug from name); re-submit with `overrideName`; on 400, show validation error message; on 201 success, close dialog, invalidate dashboard list query, show success toast; loading state during upload in frontend/src/components/DashboardImportDialog.tsx

- [x] T017 [US4] Add import mutation hook and wire import button: create `useImportDashboard` TanStack Query mutation in frontend/src/state/adminDashboards.ts; add "Import Dashboard" button (Lucide `Upload` icon) to the dashboard list page or header that opens `<DashboardImportDialog>` in the appropriate page/layout component

**Checkpoint**: Admin can import a JSON file to create a dashboard. Slug conflicts are handled gracefully. Invalid JSON is rejected with clear errors. Import is atomic. US4 is fully functional.

---

## Phase 5: Integration Tests for Import/Export

**Purpose**: Verify end-to-end round-trip: export a dashboard, import the JSON on a clean state, and verify the imported dashboard matches the original.

- [x] T018 [US3/US4] Add round-trip integration test: create a dashboard with placeholders, widgets, and links via the API; export it via GET /api/admin/dashboards/:id/export; delete the original dashboard; import the exported JSON via POST /api/admin/dashboards/import; fetch the imported dashboard and verify all fields match the original (name, slug, background, placeholder count, widget types/configs, link URLs/icons/order) in backend/tests/integration/dashboardImport.test.ts

- [x] T019 [P] [US4] Add edge-case integration tests: import with all optional fields null/missing (no background, no widgets, no links); import with maximum allowed placeholders (50); import with unicode characters in dashboard name and link titles; verify re-import after conflict resolution creates dashboard with new slug in backend/tests/integration/dashboardImport.test.ts

**Checkpoint**: Import/export round-trip is verified. Edge cases are covered. All integration tests pass.

---

## Phase 6: E2E Tests + Polish

**Purpose**: End-to-end Playwright tests for all three features, performance verification, and final polish.

- [x] T020 [P] [US1] Add E2E test for icon picker: edit mode → edit a link → click icon picker button → verify grid of icons displays → type search term → verify filtered results → click an icon → verify icon name updates in the form → save → verify icon renders on the link in frontend/tests/e2e/iconPicker.spec.ts

- [x] T021 [P] [US2] Add E2E test for background settings: open dashboard settings → select solid color → pick a color → verify preview updates → save → verify dashboard background changes → reopen settings → switch to image → upload image → select display mode → save → verify image background renders in frontend/tests/e2e/backgroundSettings.spec.ts

- [x] T022 [P] [US3/US4] Add E2E test for export/import round-trip: create a dashboard with content → click export → verify file downloads → create a new browser context → import the downloaded file → verify dashboard is created with matching content → import again → verify conflict dialog appears → enter new name → verify second dashboard is created in frontend/tests/e2e/dashboardImportExport.spec.ts

- [x] T023 [P] [US1] Performance verification: verify icon picker search responds within 100ms for search terms across full Lucide icon set (~1500 icons); verify icon grid renders without jank on mobile viewport in frontend/tests/e2e/iconPicker.spec.ts

- [x] T024 [P] Security audit: verify import endpoint rejects unauthenticated requests (401) and requests without CSRF (403); verify export endpoint rejects unauthenticated requests; verify imported JSON with script tags in string fields doesn't cause XSS when rendered; verify icon picker only renders icons from the Lucide registry (no arbitrary SVG injection)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Icon Picker ──────────────────────────────────────────────┐
Phase 2: Background Customization ─────────────────────────────────┤
Phase 3: Export ──► Phase 4: Import ──► Phase 5: Integration Tests ├──► Phase 6: E2E + Polish
```

- **Phase 1** (Icon Picker): No dependencies — start immediately
- **Phase 2** (Background): No dependencies — can parallel with Phase 1
- **Phase 3** (Export): No dependencies — can parallel with Phases 1–2
- **Phase 4** (Import): Depends on Phase 3 — import format depends on export format
- **Phase 5** (Integration Tests): Depends on Phases 3–4 — tests round-trip
- **Phase 6** (E2E + Polish): Depends on all prior phases being complete

### User Story Independence

| Story | Depends On | Can Parallel With | Backend Changes |
|-------|-----------|-------------------|----------------|
| US1 (P1) | — | US2, US3 | None |
| US2 (P1) | — | US1, US3 | None |
| US3 (P2) | — | US1, US2 | New endpoint (GET) |
| US4 (P2) | US3 | — | New endpoint (POST) |

### Within Each Phase

1. Backend tests (if any) → written first (TDD), verified to FAIL
2. Backend services → before routes
3. Backend routes → before frontend hooks
4. Frontend components → can be parallel
5. Integration verification → last in the phase

---

## Implementation Strategy

### MVP First (US1 + US2 = 6 tasks)

1. Complete Phase 1: Icon Picker (T001–T003)
2. Complete Phase 2: Background Customization (T004–T006)
3. **STOP and VALIDATE**: Admin can pick icons visually and configure dashboard backgrounds
4. Deploy/demo if ready — this is a usable product increment

### Incremental Delivery

| Increment | Phases | What It Delivers | Cumulative Tasks |
|-----------|--------|-----------------|-----------------|
| **MVP** | 1–2 | Icon picker + background settings | 6 |
| **+ Export** | 3 | Dashboard JSON export | 11 |
| **+ Import** | 4 | Dashboard JSON import with conflict handling | 17 |
| **+ Tests** | 5 | Integration test coverage | 19 |
| **+ Polish** | 6 | E2E tests, perf/security audits | 24 |

### Parallel Team Strategy

With multiple developers:

1. **Developer A** (frontend focus): Phase 1 (Icon Picker) → Phase 2 (Background)
2. **Developer B** (full-stack focus): Phase 3 (Export) → Phase 4 (Import) → Phase 5 (Tests)
3. **Both**: Phase 6 (E2E + Polish)

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete tasks in the same phase
- **[Story] label** maps each task to a specific user story for traceability
- Phases 1 and 2 require zero backend changes — only frontend components and integration
- Export format includes `version: 1` for future schema evolution
- Import is fully transactional via SQLite `db.transaction()`
- Icon picker enumerates icons from `lucide-react` `icons` export — no hardcoded icon list
- Background settings reuse existing `POST /api/admin/assets` and `PUT /api/admin/dashboards/:id` — no new endpoints
- Commit after each task or logical group for clean git history
- Stop at any checkpoint to validate the story independently
