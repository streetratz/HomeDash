# Tasks: Sonos Phase 2 — Service Discovery, Browse & Speaker Details

**Input**: Design documents from `/specs/029-sonos-phase2/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Vitest unit tests included (spec references testing requirements; constitution mandates backend business logic tests).

**Organization**: Tasks grouped by user story. US1 (Service Detection) and US4 (Speaker Details) are independent and parallelizable. US3 (Browse Panel) benefits from US1 but is independently testable. US2 (Account Labels) depends on US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`

## Phase Mapping (Spec → Tasks)

> Spec uses 3 functional phases; tasks add Setup, Foundational, and Polish phases and reorder by user story.

| Spec Phase | Tasks Phase(s) |
|------------|---------------|
| Phase 1: Service Detection & Labels | Phase 3 (US1) + Phase 5 (US2) |
| Phase 2: Speaker Details | Phase 4 (US4) |
| Phase 3: Browse Panel Redesign | Phase 6 (US3) |
| *(infrastructure)* | Phase 1 (Setup) + Phase 2 (Foundational) + Phase 7 (Polish) |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Logging scaffold and verify existing infrastructure is ready

- [x] T001 Create `specs/029-sonos-phase2/logs/readme.md` index with feature name and empty Phases table
- [x] T002 Create `specs/029-sonos-phase2/logs/01-phase-setup.md` with TOC, overview, and back-link
- [x] T003 [P] Verify existing `integration_configs` table supports `provider='sonos'` key storage via `backend/src/services/integrationConfigService.ts`
- [x] T004 [P] Verify `node-sonos` `deviceDescription()` and `getZoneInfo()` return types in `backend/src/types/sonos.d.ts` include `modelName`, `modelNumber`, `softwareVersion`, `serialNum`, `hardwareVersion`

**Checkpoint**: Infrastructure verified — feature implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions and backend utilities that multiple user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Define `DetectedService` interface (`{ service, sid?, sn?, accountLabel? }`) in `backend/src/services/sonos-local-service.ts`
- [x] T006 Extend `CachedDevice` interface with optional `model`, `modelNumber`, `softwareVersion`, `serialNumber`, `hardwareVersion` fields in `backend/src/services/sonos-local-service.ts`
- [x] T007 Extend `DiscoveredSpeaker` interface with optional `model`, `modelNumber`, `softwareVersion`, `serialNumber`, `hardwareVersion`, `stereoPair` fields in `backend/src/services/sonos-local-service.ts`
- [x] T008 Define `StereoPairInfo` interface (`{ role: 'left' | 'right', partnerUuid: string }`) in `backend/src/services/sonos-local-service.ts`
- [x] T009 Add Zod schemas for service label validation (`serviceLabelKeySchema`, `serviceLabelsBodySchema`) in `backend/src/api/sonos.ts`
- [x] T010 Create `specs/029-sonos-phase2/logs/02-phase-foundational.md` with TOC, overview, and back-link

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Service Detection & Multi-Account Spotify (Priority: P1) 🎯 MVP

**Goal**: Enhanced `detectServiceFromUri()` returns structured data with `sn=` extraction; metadata response includes `sn` and `accountLabel`; provider badge shows account label when available

**Independent Test**: Play music from different Spotify accounts on different groups; verify each group's Now Playing card shows the correct account label. Verify unknown `sn=` shows "Account #N".

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Unit test for `detectServiceFromUri()` returning `DetectedService` for Spotify, YouTube Music, Apple Music, Amazon, TuneIn, Deezer, Tidal, SoundCloud URIs in `backend/tests/unit/detectService.test.ts`
- [x] T012 [P] [US1] Unit test for `sn=` extraction from Spotify URIs with multiple accounts (`sn=7`, `sn=12`) in `backend/tests/unit/detectService.test.ts`
- [x] T013 [P] [US1] Unit test for `accountLabel` resolution from `integration_configs` when label exists and fallback to `undefined` when not in `backend/tests/unit/detectService.test.ts`

### Implementation for User Story 1

- [x] T014 [US1] Refactor `detectServiceFromUri()` to return `DetectedService` instead of `string | undefined` in `backend/src/services/sonos-local-service.ts` — extract `sid` and `sn` from URI, look up `accountLabel` from config
- [x] T015 [US1] Add `getAccountLabels()` helper function to read `integration_configs` (provider=`sonos`, key=`account_labels`) and return `Record<string, string>` in `backend/src/services/sonos-local-service.ts`
- [x] T016 [US1] Update `getPlaybackMetadata()` to use structured `DetectedService` and include `sn` + `accountLabel` in `track.service` response in `backend/src/services/sonos-local-service.ts`
- [x] T017 [US1] Update `sonos-adapter.ts` pass-through to propagate extended `track.service` shape in `backend/src/services/sonos-adapter.ts`
- [x] T018 [P] [US1] Extend `SonosMetadata` track service type in `frontend/src/hooks/useSonos.ts` to include optional `sn: number` and `accountLabel: string` fields
- [x] T019 [US1] Update provider badge in `frontend/src/components/sonos/FullScreenSonos.tsx` to show `accountLabel` (e.g., "Dad's Spotify") when available, falling back to service name
- [x] T020 [US1] Update provider badge in `frontend/src/components/widgets/SonosWidget.tsx` to show `accountLabel` when available, falling back to service name

**Checkpoint**: Service detection returns structured data; provider badges show account labels. US1 is independently testable.

---

## Phase 4: User Story 4 — Speaker Details in Settings (Priority: P1)

**Goal**: Speaker discovery returns full device details (model, software version, serial, hardware version) and stereo pair status; settings UI shows extended speaker cards

**Independent Test**: Open Sonos Settings in local mode; verify each speaker card shows model name, software version, serial number, IP address. Verify stereo pairs show L/R indicator. Verify cloud mode shows available data with "local mode required" note.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [US4] Unit test for extended `discoverDevices()` populating `CachedDevice` with `model`, `modelNumber`, `softwareVersion`, `serialNumber`, `hardwareVersion` from `deviceDescription()` and `getZoneInfo()` in `backend/tests/unit/sonosDiscovery.test.ts`
- [x] T022 [P] [US4] Unit test for stereo pair detection — paired speakers in same group with invisible member get `stereoPair` with correct `role` and `partnerUuid` in `backend/tests/unit/sonosDiscovery.test.ts`

### Implementation for User Story 4

- [x] T023 [US4] Extend `discoverDevices()` to extract `modelName`, `modelNumber`, `softwareVersion`, `serialNum`, `hardwareVersion` from `deviceDescription()` and `getZoneInfo()` and store on `CachedDevice` in `backend/src/services/sonos-local-service.ts`
- [x] T024 [US4] Implement stereo pair detection in `getDiscoveredSpeakers()` — use `getAllGroups()` zone topology to identify paired speakers (invisible members sharing a group) and assign `role` (left/right) and `partnerUuid` in `backend/src/services/sonos-local-service.ts`
- [x] T025 [US4] Update `getDiscoveredSpeakers()` to return extended `DiscoveredSpeaker` with all new fields in `backend/src/services/sonos-local-service.ts`
- [x] T026 [P] [US4] Update `useSonosDiscover` hook return type to include `model`, `modelNumber`, `softwareVersion`, `serialNumber`, `hardwareVersion`, `stereoPair` in `frontend/src/hooks/useSonos.ts`
- [x] T027 [US4] Extend speaker card in settings to show model name, software version, serial number in a collapsible detail section in `frontend/src/components/settings/IntegrationsTab.tsx`
- [x] T028 [US4] Add stereo pair indicator with L/R labels to speaker card — show paired partner name when applicable in `frontend/src/components/settings/IntegrationsTab.tsx`
- [x] T029 [US4] Add cloud mode conditional — show available data (name, model) with "Full details require local mode" note in `frontend/src/components/settings/IntegrationsTab.tsx`

**Checkpoint**: Speaker details and stereo pairs visible in settings. US4 is independently testable.

---

## Phase 5: User Story 2 — Account Label Management (Priority: P2)

**Goal**: Admin can assign friendly names to `sn=` values via Settings UI; new API endpoints for label CRUD

**Independent Test**: Open Sonos Settings as admin; verify detected `sn=` values are listed; assign a label "Dad's Spotify" to `sn:7`; verify all groups playing from `sn=7` now show "Dad's Spotify". Verify empty state shows discovery prompt.

**Dependencies**: Requires US1 (T014–T015) for `sn=` detection and `getAccountLabels()` helper

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T030 [P] [US2] Unit test for `GET /api/sonos/service-labels` returning labels from `integration_configs` (populated and empty cases) in `backend/tests/unit/sonosLabels.test.ts`
- [x] T031 [P] [US2] Unit test for `PUT /api/sonos/service-labels` — Zod validation rejects invalid key formats (missing `sn:` prefix, non-numeric), labels > 100 chars, and > 50 entries in `backend/tests/unit/sonosLabels.test.ts`
- [x] T032 [P] [US2] Unit test for `PUT /api/sonos/service-labels` — admin-only enforcement (non-admin returns 403) in `backend/tests/unit/sonosLabels.test.ts`

### Implementation for User Story 2

- [x] T033 [US2] Implement `GET /api/sonos/service-labels` route with `requireAuth` — reads `integration_configs` (provider=`sonos`, key=`account_labels`) and returns `{ labels: Record<string, string> }` in `backend/src/api/sonos.ts`
- [x] T034 [US2] Implement `PUT /api/sonos/service-labels` route with `requireAdmin` + `assertCsrf` — validates body with Zod schema, writes to `integration_configs` via `setIntegrationConfig()`, returns saved labels in `backend/src/api/sonos.ts`
- [x] T035 [P] [US2] Add `useServiceLabels()` query hook and `useUpdateServiceLabels()` mutation hook in `frontend/src/hooks/useSonos.ts`
- [x] T036 [US2] Add account label management section to Sonos settings — list detected `sn=` values (tracked from metadata responses: when a new `sn=` is seen that isn't already in labels, surface it automatically), inline editable label fields, save button — in `frontend/src/components/settings/IntegrationsTab.tsx`
- [x] T037 [US2] Show default "Spotify (Account #N)" placeholder format for unlabelled `sn=` values (matching provider badge format from US1-S5) and "Play music from different accounts to discover them" empty state in `frontend/src/components/settings/IntegrationsTab.tsx`

**Checkpoint**: Admins can manage account labels via Settings. US2 is independently testable.

---

## Phase 6: User Story 3 — Dynamic Browse Panel (Priority: P1)

**Goal**: Replace 4 hardcoded tabs with a service selector dropdown + content area; service options derived from playing service, connected services, and static options

**Independent Test**: Open Browse panel; verify service selector dropdown appears (not hardcoded tabs). Select Spotify → see Search + Playlists sub-tabs. Select Sonos Favorites → see grid with service badges. Select Radio → see TuneIn stations. Select Library → see local browse. Verify default selection follows: playing service (if browsable) → Spotify (if connected) → Favorites.

**Dependencies**: Benefits from US1 service detection but is independently testable with existing service detection

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T038 [P] [US3] Unit test for `buildBrowseServices()` — returns correct service list with browsable/non-browsable flags based on Spotify connected status and currently playing service in `frontend/tests/unit/browseServices.test.ts`
- [x] T039 [P] [US3] Unit test for default service selection logic — playing service with browse → Spotify if connected → Library fallback in `frontend/tests/unit/browseServices.test.ts`

### Implementation for User Story 3

- [x] T040 [US3] Define `BrowseService` interface and `buildBrowseServices()` function in `frontend/src/components/sonos/BrowsePanel.tsx` — derive service list with `browsable` flag: Spotify (if OAuth'd), Library are browsable; YouTube Music, Radio are non-browsable ("Sonos app only")
- [x] T041 [US3] Implement `getDefaultService()` function in `frontend/src/components/sonos/BrowsePanel.tsx` — select default based on: currently playing service (if browsable) → Spotify (if connected) → Library
- [x] T042 [US3] Replace `TAB_CONFIG` and hardcoded tab buttons with two-tier service selector: browsable services as buttons, non-browsable as dimmed text line ("YouTube Music · Radio — Sonos app only") in `frontend/src/components/sonos/BrowsePanel.tsx`
- [x] T043 [US3] ~~Add Sonos Favorites content view~~ **Removed** — Favorites already exist in dedicated Favorites tab; duplicate removed from browse panel
- [x] T044 [US3] Wire service selector to content area — show Spotify sub-tabs (Search/Playlists) when Spotify selected, Library sub-tabs (Artists/Albums/Tracks/Playlists) when Library selected — in `frontend/src/components/sonos/BrowsePanel.tsx`
- [x] T045 [US3] Hide Spotify option from service selector when not connected; default to Library when YouTube Music or Radio (non-browsable services) is playing in `frontend/src/components/sonos/BrowsePanel.tsx`
- [x] T053 [US3] Implement Library sub-tab navigation (Artists/Albums/Tracks/Playlists) with `useMusicLibrary()` hook per type in `frontend/src/components/sonos/BrowsePanel.tsx`
- [x] T054 [US3] Remove `RadioTab` component — TuneIn `getFavoritesRadioStations()` only returns favorites (already in Favorites tab); Radio marked non-browsable

**Checkpoint**: Browse panel uses dynamic service selector. All existing browse functionality preserved. US3 is independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T046 [P] Update type exports in `backend/src/services/sonos-adapter.ts` to re-export `DetectedService`, `DiscoveredSpeaker`, `StereoPairInfo` types
- [x] T047 [P] Add `accountLabel` display to favorites list service badges in `frontend/src/components/sonos/FullScreenSonos.tsx` — sn passed from backend, tooltip shows account label
- [x] T048 Run full Vitest suite — 448 tests passing (21 frontend + 427 backend)
- [x] T049 TypeScript checks — frontend clean, backend has pre-existing TS4111 (#95)
- [x] T050 ESLint — removed 2 errors (unnecessary type assertions), 57 pre-existing remain
- [x] T051 Quickstart.md updated with browse panel and manual testing changes
- [x] T052 Logs/readme.md — all phases marked complete

> **E2E Test Note (F6)**: Browse panel redesign and settings changes are not critical auth/data paths per Constitution V. Unit test coverage via Vitest is sufficient. If regressions emerge during manual testing, add targeted Playwright E2E tests at that point.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 — Service Detection (Phase 3)**: Depends on Foundational; independent of US4
- **US4 — Speaker Details (Phase 4)**: Depends on Foundational; independent of US1 ✅ PARALLEL
- **US2 — Account Labels (Phase 5)**: Depends on US1 (needs `sn=` detection + `getAccountLabels()`)
- **US3 — Browse Panel (Phase 6)**: Depends on Foundational; benefits from US1 but independently testable
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US4 (P1)**: Can start after Phase 2 — no dependencies on other stories ✅ PARALLEL WITH US1
- **US2 (P2)**: Depends on US1 (T014–T015) — needs `sn=` detection infrastructure
- **US3 (P1)**: Can start after Phase 2 — independently testable, benefits from US1 service data

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/interfaces before services
- Backend before frontend (APIs must exist before UI consumes them)
- Core logic before integration points

### Parallel Opportunities

- **Phase 2**: T005–T009 can all run in parallel (different interfaces, same file but non-overlapping sections)
- **Phase 3 + Phase 4**: US1 and US4 are fully independent — can run in parallel
- **Phase 3**: T011–T013 (tests) can run in parallel; T018 (frontend type) can parallel with T014–T017 (backend)
- **Phase 4**: T021–T022 (tests) can run in parallel; T026 (frontend type) can parallel with T023–T025 (backend)
- **Phase 5**: T030–T032 (tests) can run in parallel; T035 (hook) can parallel with T033–T034 (routes)
- **Phase 6**: T038–T039 (tests) can run in parallel

---

## Parallel Example: US1 + US4 Simultaneous Development

```bash
# After Phase 2 (Foundational) completes:

# Developer A: User Story 1 — Service Detection
Task T011: "Unit test for detectServiceFromUri() in backend/tests/unit/detectService.test.ts"
Task T012: "Unit test for sn= extraction in backend/tests/unit/detectService.test.ts"
Task T013: "Unit test for accountLabel resolution in backend/tests/unit/detectService.test.ts"
# Then T014 → T015 → T016 → T017 → T018+T019+T020

# Developer B: User Story 4 — Speaker Details (PARALLEL)
Task T021: "Unit test for extended discoverDevices() in backend/tests/unit/sonosDiscovery.test.ts"
Task T022: "Unit test for stereo pair detection in backend/tests/unit/sonosDiscovery.test.ts"
# Then T023 → T024 → T025 → T026 → T027 → T028 → T029
```

---

## Implementation Strategy

### MVP First (US1 + US4)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Service Detection + Phase 4: US4 — Speaker Details (parallel)
4. **STOP and VALIDATE**: Test US1 and US4 independently
5. Deploy/demo if ready — users get enhanced badges + speaker details

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Service Detection) → Test independently → Enhanced provider badges (MVP!)
3. US4 (Speaker Details) → Test independently → Speaker info in settings
4. US2 (Account Labels) → Test independently → Multi-account management
5. US3 (Browse Panel) → Test independently → Dynamic service browsing
6. Polish → Full regression validation → Deploy

### Suggested MVP Scope

**US1 + US4** (both P1, independent, deliver immediate visible value):
- Users see which Spotify account is playing on each group
- Users see full speaker details in Settings
- ~20 tasks, covers the core enhancement value

---

## Notes

- [P] tasks = different files, no dependencies
- [US#] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No new database migrations needed — uses existing `integration_configs` table
- No new npm packages needed — uses existing `node-sonos` library methods
- All API changes are backward-compatible (new optional fields only)

---

## Phase 8: Queue Management & Library Navigation (US5, US6, US7)

**Purpose**: Queue actions (Play Now / Play Next / Add to End / Replace Queue), container drill-down browsing, scalable UI for large libraries, and Folders as default Library sub-tab.

**Research**: Patterns adapted from [sonos-web/sonos-web](https://github.com/sonos-web/sonos-web) — separator-based drill-down (`/` browse vs `:` search), 4-action queue menu, infinite scroll with lazy images, folder auto-detect.

### Phase 8a: Backend Queue & Browse APIs

- [x] T055 [US5] Add `addToQueue(groupId, uri, asNext?)` in `backend/src/services/sonos-local-service.ts` — uses `device.queue(uri)` (SOAP AddURIToQueue) without flush; `asNext` uses `DesiredFirstTrackNumberEnqueued` to insert after current position
- [x] T056 [US5] Add queue API routes in `backend/src/api/sonos.ts`: `POST /api/sonos/groups/:groupId/queue/add` (append), `POST /api/sonos/groups/:groupId/queue/next` (play next), `POST /api/sonos/groups/:groupId/queue/replace` (flush + queue + play)
- [x] T057 [US6] Extend `browseLibrary()` in `backend/src/services/sonos-local-service.ts` — rewrote to use `contentDirectoryService().GetResult()` with ObjectID-based browsing for correct nested navigation
- [x] T058 [US6] Add drill-down API route: `GET /api/sonos/library/browse?objectId=<encodedId>&start=&total=` in `backend/src/api/sonos.ts` — ObjectID-based browsing via UPnP ContentDirectory
- [x] T059 [US7] Add cross-category search API route: `GET /api/sonos/library/:type/search?q=<query>&start=&total=` — per-category search via `searchMusicLibrary()`

**Checkpoint**: Backend APIs verified with curl — queue add/next/replace work, container drill-down returns sub-items

### Phase 8b: Frontend Queue Actions

- [x] T060 [US5] Add `useAddToQueue()`, `usePlayNext()` mutation hooks in `frontend/src/hooks/useSonos.ts`
- [x] T061 [US5] Create `PlayActionMenu` component in `frontend/src/components/sonos/PlayActionMenu.tsx` — dropdown button with 4 actions: Play Now, Play Next, Add to End of Queue, Replace Queue
- [x] T062 [US5] TrackActions merged into PlayActionMenu — hover-revealed dropdown on both tracks and containers

**Checkpoint**: Queue actions working — can add tracks, play next, replace queue from UI

### Phase 8c: Scalable Library UI

- [x] T063 [US7] LibraryTab in `BrowsePanel.tsx` — compact responsive tile grid (3→6 columns), lazy-loaded album art, 2-line title clamp, item count header
- [x] T064 [US7] Infinite scroll via IntersectionObserver — 50 items/batch, `keepPreviousData` for scroll position preservation
- [x] T065 [US7] Search input with `useDeferredValue` debounce — calls search API, clears/reloads on input change
- [x] T066 [US7] Reordered `LIBRARY_SUB_TABS` — Folders first (default), then Artists, Albums, Tracks, Playlists

**Checkpoint**: Library renders compact grid with infinite scroll, search works, Folders is default tab

### Phase 8d: Drill-Down Navigation

- [x] T067 [US6] Add `useBrowseContainer()` hook in `frontend/src/hooks/useSonos.ts` — accepts ObjectID, returns paginated sub-items via ContentDirectory
- [x] T068 [US6] Breadcrumb navigation in `BrowsePanel.tsx` — tracks navigation stack with ObjectID per segment, each clickable
- [x] T069 [US6] Artist drill-down — click Artist → show albums; ObjectID extracted from URI fragment (`#A:ALBUMARTIST/...`)
- [x] T070 [US6] Album drill-down — click Album → show tracks in numbered list with PlayActionMenu
- [x] T071 [US6] Folder/Share drill-down — click folder → navigate via ObjectID; container/track detection uses URI prefix (`x-rincon-playlist:` = container)

**Checkpoint**: Full drill-down working — Artists → Albums → Tracks, Folders → Subfolders → Tracks, breadcrumbs navigate back

### Phase 8e: Polish & Integration

- [x] T072 [US7] Library search integrated into LibraryTab — per-category search via `useSearchLibrary()` hook
- [x] T073 Updated `specs/029-sonos-phase2/quickstart.md` with Phase 8 testing steps
- [x] T074 Created `specs/029-sonos-phase2/logs/08-phase-queue-library.md` log; updated `logs/readme.md`
- [x] T075 TypeScript check clean, frontend build succeeds, 427 tests passing

**Checkpoint**: Phase 8 complete — queue management, library drill-down, scalable UI, Folders default tab
