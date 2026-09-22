# Tasks: Performance Optimizations & Pi-hole Widget Polish

**Input**: Design documents from `/specs/040-perf-pihole-polish/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓ (no new contracts)

**Tests**: Included — plan.md constitution check (Principle V) requires unit tests for polling logic and E2E for code-split navigation.

**Organization**: Tasks grouped by user story. US1 and US2 are P1 (can run in parallel). US3 and US4 are P2 (can run in parallel after US1/US2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Exact file paths included in descriptions

## Path Conventions

- **Web app monorepo**: `frontend/src/`, `frontend/tests/`
- **No backend changes** — all work is frontend-only

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed — changes apply to existing files. This phase covers any shared utilities needed by multiple stories.

- [X] T001 [P] Create `useWidgetVisibility` hook in `frontend/src/hooks/useWidgetVisibility.ts` combining Page Visibility API + IntersectionObserver (returns `isActive` boolean per data-model.md WidgetVisibilityState)
- [X] T002 [P] Create `ChunkErrorBoundary` component in `frontend/src/components/ChunkErrorBoundary.tsx` that catches ChunkLoadError, renders retry UI with page reload (per research.md R6 pattern)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking foundational work needed — all user stories can begin after Phase 1 shared utilities are ready.

**⚠️ CRITICAL**: T001 must be complete before US2 (Spotify adaptive polling) can begin. T002 must be complete before US3 (code splitting) can begin.

**Checkpoint**: Shared hooks and components ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Reduced Network Overhead from Polling (Priority: P1) 🎯 MVP

**Goal**: Pi-hole and UniFi widgets poll at 60s intervals with 30s stale-while-revalidate, respecting user-configured overrides.

**Independent Test**: Open DevTools Network tab → observe Pi-hole/UniFi requests arrive at ~60s intervals (not 30s). Stale data remains visible during refetch (no loading spinner flicker).

### Tests for User Story 1

- [X] T003 [P] [US1] Create unit test for Pi-hole polling configuration in `frontend/tests/unit/polling.test.ts` — verify staleTime=30000, refetchInterval=60000 defaults, and user override precedence

### Implementation for User Story 1

- [X] T004 [P] [US1] Update Pi-hole polling defaults in `frontend/src/state/piholeHooks.ts` — set `staleTime: 30_000`, `refetchInterval: 60_000`, preserve `userOverride` logic (if `pollIntervalSec` is configured, use that × 1000)
- [X] T005 [P] [US1] Update UniFi polling defaults in `frontend/src/state/unifiHooks.ts` — set `staleTime: 30_000`, `refetchInterval: 60_000`, preserve `userOverride` logic (if `pollIntervalSec` is configured, use that × 1000)

**Checkpoint**: Pi-hole and UniFi widgets now poll at 60s with stale-while-revalidate. User overrides still work. Testable via browser DevTools.

---

## Phase 4: User Story 2 — Spotify Widget Adaptive Polling (Priority: P1)

**Goal**: Spotify widget polls at 5s when playing+visible, 30s when paused+visible, stops entirely when tab hidden or widget out of viewport.

**Independent Test**: Toggle browser tab visibility and Spotify playback state → observe request frequency changes in Network tab. Hidden tab = 0 requests.

### Tests for User Story 2

- [X] T006 [P] [US2] Create unit test for `useWidgetVisibility` hook in `frontend/tests/unit/useVisibility.test.ts` — verify isActive state transitions: tab hidden→false, tab visible+in viewport→true, tab visible+out of viewport→false
- [X] T007 [P] [US2] Create unit test for Spotify adaptive polling logic in `frontend/tests/unit/polling.test.ts` — verify refetchInterval: isActive+playing=5000, isActive+paused=30000, !isActive=false

### Implementation for User Story 2

- [X] T008 [US2] Update `useSpotify` hook in `frontend/src/hooks/useSpotify.ts` — accept visibility state from `useWidgetVisibility`, set `refetchInterval` based on decision matrix: `isActive ? (isPlaying ? 5_000 : 30_000) : false`
- [X] T009 [US2] Integrate `useWidgetVisibility` into Spotify widget in `frontend/src/components/widgets/SpotifyWidget.tsx` — attach ref to widget container, pass `isActive` to `useSpotify` hook, trigger immediate refetch on visibility regain

**Checkpoint**: Spotify widget adaptively polls based on visibility and playback state. Zero requests when hidden. Testable by switching tabs.

---

## Phase 5: User Story 3 — Faster Initial Page Load via Code Splitting (Priority: P2)

**Goal**: Route-level code splitting via React.lazy reduces initial bundle to <500KB route chunk. Separate chunks for Dashboard, Settings, FirstRun, Login pages.

**Independent Test**: Run `pnpm --filter frontend run build` → verify 4 separate route chunks in `frontend/dist/assets/`. Navigate between routes in browser → confirm on-demand chunk loading in Network tab.

### Tests for User Story 3

- [ ] T010 [P] [US3] Create E2E test for code-split navigation in `frontend/tests/e2e/code-splitting.spec.ts` — verify: (1) initial load fetches only dashboard chunk, (2) navigating to /settings fetches settings chunk on demand, (3) deep link to /settings renders correctly, (4) loading indicator appears during chunk load

### Implementation for User Story 3

- [X] T011 [US3] Convert route definitions to React.lazy in `frontend/src/app/router.tsx` — replace static imports of DashboardPage, SettingsPage, FirstRunPage, LoginPage with `lazy(() => import(...))`, wrap route elements in `<Suspense fallback={<LoadingIndicator />}>`
- [X] T012 [US3] Wrap lazy routes with `ChunkErrorBoundary` in `frontend/src/app/router.tsx` — nest error boundary inside router layout to catch chunk load failures and render retry UI

**Checkpoint**: Initial route loads only its own chunk. Navigation triggers on-demand chunk loading. Failed chunks show error with retry. Testable via build output and browser DevTools.

---

## Phase 6: User Story 4 — Pi-hole Widget at Small Grid Sizes (Priority: P2)

**Goal**: Pi-hole widget renders cleanly at 180px grid cells without overflow, using compact layout with smaller icons, tighter padding, and text truncation.

**Independent Test**: Set grid cell size to 180px in Settings → General. Pi-hole widget shows all content without horizontal overflow. Reset to 300px+ → standard layout unchanged.

### Implementation for User Story 4

- [X] T013 [US4] Implement compact layout mode in `frontend/src/components/widgets/PiholeWidget.tsx` — detect `cellWidth ≤ 200px` from grid props, apply compact mode: single-column stacked panels, `p-1.5` padding, `h-3 w-3` icons, `truncate` on all stat values, hide section headers, smaller logo (`h-14 w-14`), inline status+button in controls panel
- [X] T014 [US4] Verify no regression at standard sizes in `frontend/src/components/widgets/PiholeWidget.tsx` — ensure `cellWidth > 200px` renders existing standard layout unchanged (conditional class application)

**Checkpoint**: Pi-hole widget is fully readable at 180px cells with no overflow. Standard layout unchanged at larger sizes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [X] T015 [P] Run production build and verify chunk layout matches expected structure in research.md R4 — `pnpm --filter frontend run build` → confirm vendor, query, grid, and 4 route chunks
- [X] T016 [P] Run full test suite — `pnpm --filter frontend run test` (unit) and `pnpm --filter frontend run test:e2e` (Playwright)
- [ ] T017 Run quickstart.md validation — follow all verification steps in `specs/040-perf-pihole-polish/quickstart.md` to confirm end-to-end behaviour

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: N/A (no blocking foundational work beyond Phase 1)
- **US1 (Phase 3)**: Can start immediately — no dependency on Phase 1 shared utilities
- **US2 (Phase 4)**: Depends on T001 (`useWidgetVisibility` hook from Phase 1)
- **US3 (Phase 5)**: Depends on T002 (`ChunkErrorBoundary` from Phase 1)
- **US4 (Phase 6)**: Can start immediately — no dependencies on other phases
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent — no dependencies on other stories
- **User Story 2 (P1)**: Depends on T001 (shared hook) — independent of other stories
- **User Story 3 (P2)**: Depends on T002 (shared component) — independent of other stories
- **User Story 4 (P2)**: Fully independent — no dependencies on other stories or shared utilities

### Within Each User Story

- Tests written first (where included)
- Configuration/hook changes before widget integration
- Core logic before UI integration
- Story complete before Polish phase

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different files)
- **Phase 3 + Phase 4 + Phase 6**: US1, US2 (after T001), and US4 can all run in parallel
- **Phase 3**: T004 and T005 can run in parallel (different hook files)
- **Phase 4**: T006 and T007 can run in parallel (different test concerns)
- **Phase 5 + Phase 6**: US3 (after T002) and US4 can run in parallel
- **Phase 7**: T015 and T016 can run in parallel

---

## Parallel Example: Phase 1 + Early Stories

```bash
# Launch shared utilities in parallel:
Task: "Create useWidgetVisibility hook in frontend/src/hooks/useWidgetVisibility.ts"
Task: "Create ChunkErrorBoundary in frontend/src/components/ChunkErrorBoundary.tsx"

# Once T001 completes, US1 and US2 can proceed in parallel:
Task: "Update Pi-hole polling in frontend/src/state/piholeHooks.ts"        # US1
Task: "Update UniFi polling in frontend/src/state/unifiHooks.ts"            # US1
Task: "Update useSpotify hook in frontend/src/hooks/useSpotify.ts"          # US2

# US4 can start anytime (no dependencies):
Task: "Implement compact layout in frontend/src/components/widgets/PiholeWidget.tsx"  # US4
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Shared utilities (T001, T002)
2. Complete Phase 3: US1 — Polling reduction (T003–T005)
3. Complete Phase 4: US2 — Spotify adaptive polling (T006–T009)
4. **STOP and VALIDATE**: Test polling behaviour via browser DevTools
5. Deploy — immediate network savings for all users

### Incremental Delivery

1. Phase 1 → Shared utilities ready
2. US1 → Pi-hole/UniFi poll at 60s → Deploy (immediate value)
3. US2 → Spotify stops polling when hidden → Deploy (battery/network savings)
4. US3 → Code splitting → Deploy (faster initial loads)
5. US4 → Pi-hole compact layout → Deploy (visual polish)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. All start Phase 1 together (2 parallel tasks)
2. Once Phase 1 done:
   - Developer A: US1 (polling reduction) + US3 (code splitting, after T002)
   - Developer B: US2 (Spotify adaptive) + US4 (Pi-hole compact)
3. Stories complete and integrate independently

---

## Notes

- All changes are frontend-only — no backend work required
- Existing Vite `manualChunks` config coexists with React.lazy splitting (research.md R4)
- TanStack Query handles stale-while-revalidate natively — no custom logic needed
- IntersectionObserver + Page Visibility API supported in all target browsers (no polyfill)
- User-configured polling intervals always take precedence over new defaults
