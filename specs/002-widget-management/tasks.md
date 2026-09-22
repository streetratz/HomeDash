# Tasks: Widget Management & Widget Types

**Input**: Design documents from `/specs/002-widget-management/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Backend integration tests are included for new proxy endpoints (status-check, weather) and per-type config validation. Frontend E2E tests cover the widget management flow and per-type rendering. Tests follow TDD where applicable (backend tests written before implementation).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. User stories US1–US2 (P1) form the MVP; US3–US5 (P2) extend management and add simple widget types; US6–US8 (P3) deliver advanced widgets requiring backend proxy endpoints.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3…)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `backend/src/`, `frontend/src/`, `backend/tests/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and prepare project structure for widget development.

- [x] T001 Install frontend runtime dependencies: `pnpm add react-markdown@^10 remark-gfm@^4 @hello-pangea/dnd@^18` in frontend/
- [x] T002 [P] Create frontend/src/components/widgets/ directory for all new widget type modules
- [x] T003 [P] Install @tailwindcss/typography as devDependency (`pnpm add -D @tailwindcss/typography@^0.5`) and add the typography plugin to the plugins array in frontend/tailwind.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core widget infrastructure that MUST be complete before ANY user story can be implemented — registry, validation, draft state, and renderer refactor.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational (backend config validation) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T008)**

- [x] T004 [P] Add integration tests for per-type configJson validation on layout save: test that valid clock/markdown/iframe/weather/system_status configs pass and invalid configs (wrong types, missing fields, out-of-range values) return 400 — extend backend/tests/integration/dashboards.test.ts

### Implementation for Foundational

- [x] T005 [P] Define WidgetTypeDefinition interface (type, displayName, description, icon, defaultConfig, DisplayComponent, ConfigFormComponent), WidgetDisplayProps, WidgetConfigFormProps interfaces and create widgetRegistry Map; register existing links_list type (DisplayComponent: LinksListWidget, ConfigFormComponent: null) in frontend/src/components/widgets/registry.ts
- [x] T006 [P] Add per-type widget config Zod schemas: ClockConfigSchema, MarkdownConfigSchema, IframeConfigSchema, WeatherConfigSchema, SystemStatusConfigSchema (with ServiceEntrySchema), and a widgetConfigSchemas map keyed by type string in backend/src/lib/validation.ts
- [x] T007 [P] Add per-type widget config TypeScript interfaces (ClockConfig, MarkdownConfig, IframeConfig, WeatherConfig, SystemStatusConfig, ServiceEntry) and StatusCheckResult, WeatherResponse, GeocodingResult response types to frontend/src/state/dashboards.ts
- [x] T008 Add per-type configJson validation dispatch inside the layout save handler: for each widget in the payload, look up the Zod schema by widget type from widgetConfigSchemas map and validate configJson; reject with 400 on validation failure in backend/src/api/adminDashboards.ts
- [x] T009 Refactor WidgetRenderer to resolve display component via `widgetRegistry.get(widget.type)?.DisplayComponent` instead of switch/case; keep "Unknown widget type" fallback for unregistered types in frontend/src/components/WidgetRenderer.tsx
- [x] T010 [P] Extend useEditMode hook with widget draft operations: addWidget(stableKey, type, initialConfig) adds a new widget with temp UUID, removeWidget(stableKey, widgetId) removes from draft, reorderWidgets(stableKey, orderedIds) recomputes orderIndex values, updateWidgetConfig(stableKey, widgetId, config) updates configJson; mark dirty on all operations; include widgets array in saveEdit payload per LayoutWidgetInputSchema in frontend/src/state/useEditMode.ts

**Checkpoint**: Foundation ready — widget type registry, config validation, draft state, and renderer all operational. User story implementation can now begin.

---

## Phase 3: User Story 1 — Widget Picker & Adding Widgets (Priority: P1) 🎯 MVP

**Goal**: Admins can open a widget picker dialog, see all available widget types, select one, and add it to a placeholder. Saving persists the widget and it renders in view mode.

**Independent Test**: Enter edit mode → open a placeholder's widget management → add a widget from the picker → save layout → confirm the widget appears in view mode.

### Implementation for User Story 1

- [x] T011 [US1] Create WidgetPicker dialog component: iterate widgetRegistry.values() to display a responsive grid of available types (icon, displayName, description); clicking a type calls an onSelect(type, defaultConfig) callback; use shadcn/ui Dialog + responsive grid (2-col desktop, 1-col mobile per NFR-004) in frontend/src/components/widgets/WidgetPicker.tsx
- [x] T012 [US1] Add "Manage Widgets" section to PlaceholderConfigDialog: show current widget list (type icon + name for each), an "Add Widget" button that opens WidgetPicker, and wire onSelect to useEditMode.addWidget(stableKey, type, defaultConfig) in frontend/src/components/PlaceholderConfigDialog.tsx
- [x] T013 [P] [US1] Add edit-mode widget actions overlay on PlaceholderWidget: when isEditing is true, show an "Add Widget" floating button on empty placeholders and a subtle settings icon per widget; clicking "Add Widget" opens the widget picker scoped to that placeholder in frontend/src/components/PlaceholderWidget.tsx
- [x] T014 [US1] Wire end-to-end flow: WidgetPicker selection → addWidget draft → saveEdit (PUT layout with widgets) → verify new widget appears in view mode via WidgetRenderer; ensure Cancel discards added widgets per FR-006

**Checkpoint**: Admins can add widgets to placeholders via the picker. Widgets persist after save and render in view mode. US1 is fully functional.

---

## Phase 4: User Story 2 — Widget Instance Configuration (Priority: P1)

**Goal**: Each widget instance has a type-specific configuration form. Admins can open the form, change settings, and the widget renders with the updated config after saving. Clock/Date is the reference implementation.

**Independent Test**: Add a Clock widget → open its config form → change timezone to "America/New_York" and format to 24hr → save → verify the clock renders with the updated settings.

### Implementation for User Story 2

- [x] T015 [US2] Build widget config form panel inside the manage-widgets UI: when admin clicks "configure" on a widget item, resolve ConfigFormComponent from widgetRegistry.get(widget.type), render it with current config and an onChange handler that calls useEditMode.updateWidgetConfig(stableKey, widgetId, newConfig); include inline preview of the widget using its DisplayComponent in frontend/src/components/PlaceholderConfigDialog.tsx
- [x] T016 [P] [US2] Create ClockConfigForm with searchable timezone picker (populate via Intl.supportedValuesOf('timeZone'), display with UTC offsets, use shadcn/ui Command/Popover combobox), 12/24hr radio toggle, showDate checkbox, showSeconds checkbox; call onChange on every field change per RD-03 in frontend/src/components/widgets/ClockConfigForm.tsx
- [x] T017 [P] [US2] Create ClockWidget display component: render live time via setInterval(1000ms) using Intl.DateTimeFormat with configured timezone (or browser-local default), 12hr format with AM/PM or 24hr HH:MM:SS, optional date line, optional seconds; use useRef for interval cleanup; style with large readable font in frontend/src/components/widgets/ClockWidget.tsx
- [x] T018 [US2] Register clock type in widgetRegistry: type 'clock', displayName 'Clock / Date', description 'Display current time and date for any timezone', icon Clock from lucide-react, defaultConfig {format:'12h', showDate:true, showSeconds:true}, DisplayComponent: ClockWidget, ConfigFormComponent: ClockConfigForm in frontend/src/components/widgets/registry.ts
- [x] T019 [US2] Verify config round-trip: add Clock → open config → set timezone 'America/New_York' + 24hr format → save layout → reload dashboard → confirm ClockWidget renders 24hr time for the configured timezone; verify Cancel discards config changes

**Checkpoint**: Widget configuration mechanism is operational. Clock/Date is the first fully configured widget type. US2 is fully functional.

---

## Phase 5: User Story 3 — Widget Reorder & Delete (Priority: P2)

**Goal**: Admins can reorder widgets within a placeholder via drag-and-drop (or up/down arrows) and delete widgets with confirmation. Changes follow the edit-mode draft pattern.

**Independent Test**: Add 3 widgets to a placeholder → drag to reorder → delete one → save → verify remaining widgets appear in the new order.

### Implementation for User Story 3

- [x] T020 [US3] Create WidgetListEditor with @hello-pangea/dnd: DragDropContext → Droppable → Draggable list of widget items; each item shows type icon, displayName, grip drag handle, up/down arrow buttons (keyboard/mobile fallback per RD-02), configure button, and delete button; onDragEnd computes new orderedIds and calls reorderWidgets callback in frontend/src/components/widgets/WidgetListEditor.tsx
- [x] T021 [US3] Add delete action to WidgetListEditor: clicking delete shows a confirmation dialog (shadcn/ui AlertDialog with widget type name); on confirm, call removeWidget callback; show empty state "No widgets — add one from the picker" when list is empty in frontend/src/components/widgets/WidgetListEditor.tsx
- [x] T022 [US3] Integrate WidgetListEditor into PlaceholderConfigDialog manage-widgets section: replace the simple widget list from T012 with WidgetListEditor, connecting onReorder → useEditMode.reorderWidgets, onDelete → useEditMode.removeWidget, onConfigure → open config form (T015) in frontend/src/components/PlaceholderConfigDialog.tsx

**Checkpoint**: Full widget management lifecycle (add, configure, reorder, delete) is operational within edit mode. US3 is fully functional.

---

## Phase 6: User Story 4 — Clock/Date Widget (Priority: P2)

**Goal**: Verify Clock/Date widget meets all acceptance criteria: live time updates, timezone correctness, format display, and default timezone fallback.

**Independent Test**: Add a Clock widget → configure timezone and format → verify correct live time display with second-by-second updates, AM/PM for 12hr, and browser-local default.

> **Note**: Clock implementation (ClockWidget.tsx + ClockConfigForm.tsx) was delivered in Phase 4 (US2) as the reference configuration widget. This phase validates Clock-specific acceptance criteria via E2E testing.

### Tests for User Story 4

- [x] T023 [US4] Add E2E test for Clock widget: verify live time updates at least every second, 12hr format shows AM/PM indicator, 24hr format shows HH:MM in 00:00–23:59 range, unconfigured timezone defaults to browser local, configured timezone displays correct offset; test timezone fallback for invalid timezone string in frontend/tests/e2e/widgetTypes.spec.ts

**Checkpoint**: Clock/Date widget acceptance criteria verified. US4 is complete.

---

## Phase 7: User Story 5 — Markdown/Notes Widget (Priority: P2)

**Goal**: Admins can add a Markdown widget, enter markdown content, and it renders with proper formatting (headings, bold, lists, links, code blocks) — XSS-safe via react-markdown AST rendering.

**Independent Test**: Add a Markdown widget → enter markdown with headings, links, and code → save → verify rendered output with proper formatting, links open in new tab, and content is scrollable.

### Implementation for User Story 5

- [x] T024 [P] [US5] Create MarkdownWidget display component: render config.content via react-markdown with remark-gfm plugin; wrap in @tailwindcss/typography prose container with overflow-y-auto for scrollable content (FR-023); override link component to use target="_blank" rel="noopener noreferrer" (RD-01); show "No content configured" empty state when content is empty/undefined in frontend/src/components/widgets/MarkdownWidget.tsx
- [x] T025 [P] [US5] Create MarkdownConfigForm with multi-line textarea (rows=10, maxLength 50000), character count display, and optional live preview panel that renders content via react-markdown; call onChange({content}) on textarea change in frontend/src/components/widgets/MarkdownConfigForm.tsx
- [x] T026 [US5] Register markdown type in widgetRegistry: type 'markdown', displayName 'Markdown / Notes', description 'Display formatted text, notes, and documentation', icon FileText from lucide-react, defaultConfig {content:''}, DisplayComponent: MarkdownWidget, ConfigFormComponent: MarkdownConfigForm in frontend/src/components/widgets/registry.ts

**Checkpoint**: Markdown/Notes widget is fully functional with XSS-safe rendering. US5 is complete.

---

## Phase 8: User Story 6 — Iframe Embed Widget (Priority: P3)

**Goal**: Admins can embed any web UI (Grafana, Pi-hole, etc.) via a sandboxed iframe with configurable aspect ratio and security restrictions preventing parent navigation.

**Independent Test**: Add an Iframe widget → enter a URL → select aspect ratio → save → verify the iframe renders sandboxed at the correct ratio with referrerpolicy="no-referrer".

### Implementation for User Story 6

- [x] T027 [P] [US6] Create IframeWidget display component: render iframe with sandbox="allow-scripts allow-same-origin allow-forms" (RD-08), referrerpolicy="no-referrer", configurable aspect ratio via CSS aspect-ratio property (16:9, 4:3, 1:1) or height:100% for auto; show loading skeleton while iframe loads; handle onError with error message fallback; show "Configure a URL to embed" when url is empty (FR-018) in frontend/src/components/widgets/IframeWidget.tsx
- [x] T028 [P] [US6] Create IframeConfigForm with URL text input (validated for http/https), aspect ratio selector (radio group: 16:9, 4:3, 1:1, Auto), and URL preview thumbnail or icon; call onChange({url, aspectRatio}) on field changes in frontend/src/components/widgets/IframeConfigForm.tsx
- [x] T029 [US6] Register iframe type in widgetRegistry: type 'iframe', displayName 'Iframe Embed', description 'Embed any web page or dashboard', icon Globe from lucide-react, defaultConfig {url:'', aspectRatio:'auto'}, DisplayComponent: IframeWidget, ConfigFormComponent: IframeConfigForm in frontend/src/components/widgets/registry.ts

**Checkpoint**: Iframe Embed widget is fully functional with proper sandboxing. US6 is complete.

---

## Phase 9: User Story 7 — System Status Widget (Priority: P3)

**Goal**: Admins can monitor LAN service health. The backend performs HTTP health checks (avoiding CORS), and the widget displays up/down/unknown status indicators with configurable polling.

**Independent Test**: Add a System Status widget → configure a reachable and an unreachable service → save → verify green/red status indicators update on poll interval.

### Tests for User Story 7 (backend endpoint) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T031–T032)**

- [x] T030 [P] [US7] Add integration tests for POST /api/admin/status-check endpoint: 401 without auth, 403 without admin role, 400 on invalid body (empty services array, missing url, invalid expectedStatus), 200 with results array containing correct status/responseTimeMs/checkedAt for reachable and unreachable URLs in backend/tests/integration/statusCheck.test.ts

### Implementation for User Story 7

- [x] T031 [P] [US7] Create statusCheckService with executeChecks(services) function: iterate services sequentially, perform HTTP GET via Node.js native fetch() with AbortSignal.timeout(timeoutSeconds * 1000), follow max 3 redirects, compare response.status to expectedStatus, measure responseTimeMs, map all errors (DNS, connection, timeout) to status:'down', return StatusCheckResult[] in backend/src/services/statusCheckService.ts
- [x] T032 [US7] Add POST /api/admin/status-check route: requireAdmin + CSRF assertion, validate request body against StatusCheckRequestSchema (from T006), call statusCheckService.executeChecks(services), return {results} in backend/src/api/adminDashboards.ts
- [x] T033 [P] [US7] Create useStatusCheck TanStack Query hook: POST /api/admin/status-check with services list from widget config, set refetchInterval to config.pollIntervalSeconds * 1000, enabled only when widget is mounted in view mode, return {results, isLoading, error} in frontend/src/hooks/useStatusCheck.ts
- [x] T034 [P] [US7] Create SystemStatusWidget display component: render service list with name, colored status dot (green for 'up', red for 'down', grey for 'unknown'), response time in ms, last-checked relative timestamp; call useStatusCheck with config.services; show "Checking…" initial state before first poll completes (FR-031) in frontend/src/components/widgets/SystemStatusWidget.tsx
- [x] T035 [P] [US7] Create SystemStatusConfigForm with dynamic service row editor: each row has name input, URL input, expectedStatus number input (default 200), timeoutSeconds number input (default 10); add/remove row buttons (max 20 per schema); pollIntervalSeconds input (min 15, default 60); call onChange on any field change in frontend/src/components/widgets/SystemStatusConfigForm.tsx
- [x] T036 [US7] Register system_status type in widgetRegistry: type 'system_status', displayName 'System Status', description 'Monitor health of LAN services', icon Activity from lucide-react, defaultConfig {services:[], pollIntervalSeconds:60}, DisplayComponent: SystemStatusWidget, ConfigFormComponent: SystemStatusConfigForm in frontend/src/components/widgets/registry.ts

**Checkpoint**: System Status widget is fully functional with backend health checks. US7 is complete.

---

## Phase 10: User Story 8 — Weather Widget (Priority: P3)

**Goal**: Admins can display current weather via Open-Meteo API (proxied through backend) or enter manual weather data for fully offline setups. The widget shows temperature, conditions, and an icon.

**Independent Test**: Add a Weather widget → configure with API mode (search location via geocoding) or manual mode (enter temperature/conditions) → save → verify weather data displays correctly with stale indicator on API failure.

### Tests for User Story 8 (backend endpoints) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (T038–T040)**

- [x] T037 [P] [US8] Add integration tests for weather proxy endpoints: GET /api/admin/weather/current — 401 without auth, 400 on missing/invalid lat/lon, 200 with WeatherResponse shape, 502 on upstream failure; GET /api/admin/weather/geocoding — 400 on empty name, 200 with results array, 502 on upstream failure; verify in-memory caching returns same fetchedAt on repeated calls within 5min TTL in backend/tests/integration/weatherProxy.test.ts

### Implementation for User Story 8

- [x] T038 [P] [US8] Create weatherProxyService with fetchCurrentWeather(lat, lon) that calls Open-Meteo forecast API with current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto, caches in-memory Map keyed by lat/lon rounded to 2 decimal places with 5min TTL, returns stale cache on upstream failure; and searchLocations(name) that proxies to geocoding-api.open-meteo.com with count=5 and 5s timeout in backend/src/services/weatherProxyService.ts
- [x] T039 [US8] Add GET /api/admin/weather/current route: requireAdmin, validate lat (number -90..90) and lon (number -180..180) query params via Zod, call weatherProxyService.fetchCurrentWeather, return WeatherResponse or 502 with error message on upstream failure in backend/src/api/adminDashboards.ts
- [x] T040 [US8] Add GET /api/admin/weather/geocoding route: requireAdmin, validate name query param (string 1–128 chars), call weatherProxyService.searchLocations, return {results: GeocodingResult[]} or 502 on upstream failure in backend/src/api/adminDashboards.ts
- [x] T041 [P] [US8] Create useWeather TanStack Query hook: useCurrentWeather(lat, lon, enabled) with refetchInterval 5min for current weather; and useGeocoding(searchTerm) debounced query for location search autocomplete in frontend/src/hooks/useWeather.ts
- [x] T042 [P] [US8] Create WeatherWidget display component: API mode renders temperature (convert C→F if config.temperatureUnit is 'F'), WMO weather code → emoji/description mapping (clear ☀️, cloudy ⛅, rain 🌧️, snow ❄️, etc.), humidity %, wind speed; show stale indicator when fetchedAt > 10min ago; manual mode renders config.temperature + config.conditions + config.icon directly; show "Configure weather source" empty state in frontend/src/components/widgets/WeatherWidget.tsx
- [x] T043 [P] [US8] Create WeatherConfigForm: mode radio selector (API/Manual); API mode section with location search autocomplete (useGeocoding → select → populate lat/lon/locationName), display selected coordinates; manual mode section with temperature number input, unit selector (C/F), conditions text input, icon/emoji input; call onChange on all field changes in frontend/src/components/widgets/WeatherConfigForm.tsx
- [x] T044 [US8] Register weather type in widgetRegistry: type 'weather', displayName 'Weather', description 'Current weather conditions for any location', icon CloudSun from lucide-react, defaultConfig {mode:'manual', temperatureUnit:'C'}, DisplayComponent: WeatherWidget, ConfigFormComponent: WeatherConfigForm in frontend/src/components/widgets/registry.ts

**Checkpoint**: Weather widget is fully functional in both API and manual modes. US8 is complete.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end testing, performance verification, security hardening, and documentation validation across all user stories.

- [x] T045 [P] Add comprehensive E2E test for full widget management flow: edit mode → open picker → add widget → configure → add second widget → reorder → delete one → save → verify final state in view mode → cancel discards changes in frontend/tests/e2e/widgetManagement.spec.ts
- [x] T046 [P] Add E2E tests for each widget type rendering correctly: Markdown (headings, links, code, XSS-safe), Iframe (sandbox attributes, aspect ratio, empty state), System Status (polling, up/down indicators), Weather (API mode display, manual mode display, stale indicator) — extend frontend/tests/e2e/widgetTypes.spec.ts
- [x] T047 [P] Performance audit: verify dashboard with 10+ widgets across multiple placeholders loads and renders within 2 seconds (NFR-006); verify ClockWidget setInterval does not cause sibling widget re-renders; verify System Status polling does not stack requests
- [x] T048 [P] Security audit: verify react-markdown strips script/style tags (NFR-007), iframe sandbox prevents parent navigation and popup creation, POST /api/admin/status-check and GET /api/admin/weather/* reject unauthenticated and non-admin requests (NFR-001), all proxy endpoints validate input
- [x] T049 [P] Run quickstart.md validation: verify development setup steps, new dependency installation, dev server start, test commands (pnpm test, pnpm test:integration, pnpm test:e2e, pnpm typecheck, pnpm lint) all pass

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────► Phase 2: Foundational ──┬──► Phase 3: US1 (P1) ──► Phase 4: US2 (P1)
                                                        │
                                                        ├──► Phase 5: US3 (P2)
                                                        │
                                                        ├──► Phase 6: US4 (P2) ← requires Phase 4
                                                        │
                                                        ├──► Phase 7: US5 (P2)
                                                        │
                                                        ├──► Phase 8: US6 (P3)
                                                        │
                                                        ├──► Phase 9: US7 (P3)
                                                        │
                                                        └──► Phase 10: US8 (P3)
                                                        
                                                        All complete ──► Phase 11: Polish
```

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — first user story, enables widget adding
- **US2 (Phase 4)**: Depends on Phase 3 (US1) — config forms need the add/manage UI
- **US3 (Phase 5)**: Depends on Phase 2 — reorder/delete needs foundational draft ops
- **US4 (Phase 6)**: Depends on Phase 4 (US2) — Clock E2E validates implementation from US2
- **US5 (Phase 7)**: Depends on Phase 2 — can start after foundational, parallel with US3
- **US6 (Phase 8)**: Depends on Phase 2 — can start after foundational, parallel with others
- **US7 (Phase 9)**: Depends on Phase 2 — backend + frontend work, parallel with other P3 stories
- **US8 (Phase 10)**: Depends on Phase 2 — backend + frontend work, parallel with other P3 stories
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Independence

| Story | Depends On | Can Parallel With | Backend Changes |
|-------|-----------|-------------------|----------------|
| US1 (P1) | Foundational | — | None |
| US2 (P1) | US1 | — | None |
| US3 (P2) | Foundational | US4, US5, US6, US7, US8 | None |
| US4 (P2) | US2 | US3, US5, US6, US7, US8 | None |
| US5 (P2) | Foundational | US3, US4, US6, US7, US8 | None |
| US6 (P3) | Foundational | US3, US4, US5, US7, US8 | None |
| US7 (P3) | Foundational | US3, US4, US5, US6, US8 | New endpoint |
| US8 (P3) | Foundational | US3, US4, US5, US6, US7 | New endpoints |

### Within Each User Story

1. Backend tests (if any) → written first (TDD), verified to FAIL
2. Backend services → before routes
3. Backend routes → before frontend hooks
4. Frontend components (display + config form) → can be parallel
5. Registry registration → after display + config components exist
6. Integration verification → last in the phase

---

## Parallel Execution Examples

### Phase 2: Foundational (5 parallel streams)

```
Stream A: T004 — Integration tests for config validation
Stream B: T005 — Widget registry + links_list registration
Stream C: T006 — Backend Zod schemas (all 5 widget types)
Stream D: T007 — Frontend config TypeScript interfaces
Stream E: T010 — useEditMode widget draft operations

Then sequentially:
  T008 — Per-type validation in layout save (needs T006)
  T009 — WidgetRenderer registry refactor (needs T005)
```

### Phase 4: US2 — Widget Configuration (2 parallel streams)

```
T015 — Config form panel infrastructure (sequential, first)

Then parallel:
  Stream A: T016 — ClockConfigForm (new file)
  Stream B: T017 — ClockWidget (new file)

Then sequential:
  T018 — Register clock in registry (needs T016 + T017)
  T019 — Verify config round-trip
```

### Phase 9: US7 — System Status (5 parallel streams)

```
Parallel:
  Stream A: T030 — Integration tests (TDD, write first)
  Stream B: T031 — statusCheckService (new file)
  Stream C: T033 — useStatusCheck hook (new file)
  Stream D: T034 — SystemStatusWidget (new file)
  Stream E: T035 — SystemStatusConfigForm (new file)

Then sequential:
  T032 — Status-check route (needs T031)
  T036 — Register system_status (needs T034 + T035)
```

### Phase 10: US8 — Weather (5 parallel streams)

```
Parallel:
  Stream A: T037 — Integration tests (TDD, write first)
  Stream B: T038 — weatherProxyService (new file)
  Stream C: T041 — useWeather hook (new file)
  Stream D: T042 — WeatherWidget (new file)
  Stream E: T043 — WeatherConfigForm (new file)

Then sequential:
  T039 — Weather current route (needs T038)
  T040 — Weather geocoding route (needs T038)
  T044 — Register weather (needs T042 + T043)
```

### Cross-Story Parallelism (after Phase 2)

With multiple developers, these stories can be worked on simultaneously:

```
Developer A: US1 → US2 → US4 (management UI + Clock — sequential, P1 path)
Developer B: US3 + US5 + US6 (reorder/delete + Markdown + Iframe — all frontend-only)
Developer C: US7 + US8 (System Status + Weather — both need backend work)
```

---

## Implementation Strategy

### MVP First (US1 + US2 = 19 tasks)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T010) — **CRITICAL, blocks everything**
3. Complete Phase 3: US1 — Widget Picker & Adding (T011–T014)
4. Complete Phase 4: US2 — Widget Configuration + Clock (T015–T019)
5. **STOP and VALIDATE**: Admin can add a Clock widget, configure timezone/format, save, and see it render correctly
6. Deploy/demo if ready — this is a usable product increment

### Incremental Delivery

| Increment | Phases | What It Delivers | Cumulative Tasks |
|-----------|--------|-----------------|-----------------|
| **MVP** | 1–4 | Add + configure widgets (Clock) | 19 |
| **+ Management** | 5 | Reorder + delete widgets | 22 |
| **+ Simple Types** | 6–8 | Clock E2E + Markdown + Iframe | 29 |
| **+ Monitoring** | 9 | System Status with backend polling | 36 |
| **+ Weather** | 10 | Weather with API proxy | 44 |
| **+ Polish** | 11 | E2E tests, perf/security audits | 49 |

### Parallel Team Strategy

With multiple developers after Phase 2 is complete:

1. **All developers**: Complete Setup + Foundational together (Phases 1–2)
2. **Developer A** (management focus): US1 → US2 → US3 → US4
3. **Developer B** (widget types focus): US5 → US6 (frontend-only, no backend deps)
4. **Developer C** (backend + advanced widgets): US7 → US8 (new backend endpoints)
5. **All developers**: Phase 11 Polish (E2E tests, audits, quickstart validation)

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete tasks in the same phase
- **[Story] label** maps each task to a specific user story for traceability
- Each user story is independently completable and testable after Phase 2
- Backend integration tests are TDD: write first, verify they FAIL, then implement
- Frontend E2E tests are in US4 (Clock) and Phase 11 (comprehensive)
- Commit after each task or logical group for clean git history
- Stop at any checkpoint to validate the story independently
- All widget configs are stored in existing `configJson` column — no database migrations needed
- Adding a future widget type requires ≤ 3 files: DisplayComponent, ConfigFormComponent, registry registration (SC-008)
