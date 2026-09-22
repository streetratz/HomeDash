# Tasks: Sonos Library Queue Actions & Sub-Navigation

**Input**: Design documents from `/specs/042-sonos-library-queue/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested in the feature specification. Test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define shared types and data structures used across all user stories

- [X] T001 Add ContainerQueueRequest, ContainerQueueResponse, and ResolvedTrack types to backend/src/services/sonos-local-service.ts
- [X] T002 [P] Add container queue mutation types and API response interfaces to frontend/src/hooks/useSonos.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend container track resolution — the core engine that all queue operations depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement resolveContainerTracks(objectId) recursive resolution function in backend/src/services/sonos-local-service.ts — recursively browse containers via browseContainer() to collect all leaf-track URIs with metadata, capped at 1,000 tracks (V-04)
- [X] T004 Expose resolveContainerTracks through the adapter interface in backend/src/services/sonos-adapter.ts

**Checkpoint**: Container track resolution engine ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Add All Tracks from a Container to Queue (Priority: P1) 🎯 MVP

**Goal**: Users can add an entire album, artist, folder, or playlist to the end of the playback queue in a single action without interrupting current playback.

**Independent Test**: Browse to any album or folder in the library, tap "Add to Queue" (or "Add to End" in the PlayActionMenu), and confirm that all tracks from that container appear appended at the end of the current queue without interrupting the currently playing track.

### Implementation for User Story 1

- [X] T005 [US1] Implement addContainerToQueue(groupId, uri, objectId) service method in backend/src/services/sonos-local-service.ts — resolve tracks via resolveContainerTracks(), then sequentially enqueue each track using device.queue(), return ContainerQueueResponse with tracksAdded/totalFound/truncated
- [X] T006 [US1] Expose addContainerToQueue through the adapter in backend/src/services/sonos-adapter.ts
- [X] T007 [US1] Add POST /api/sonos/groups/:groupId/queue/add-container endpoint in backend/src/api/sonos.ts — validate uri and objectId (V-01, V-02), require auth + CSRF, call adapter.addContainerToQueue(), return ContainerQueueResponse or error JSON
- [X] T008 [US1] Add useAddContainerToQueue() mutation hook in frontend/src/hooks/useSonos.ts — POST to /api/sonos/groups/:groupId/queue/add-container with { uri, objectId }, invalidate queue query on success, expose isPending state
- [X] T009 [US1] Wire PlayActionMenu "Add to End" action on container items (type === 'container') in frontend/src/components/sonos/BrowsePanel.tsx — call useAddContainerToQueue() mutation, show toast on success ("Added N tracks to queue") and error
- [X] T010 [US1] Add loading/disabled state prop to PlayActionMenu in frontend/src/components/sonos/PlayActionMenu.tsx — accept isLoading prop, disable all menu actions and show spinner when mutation is in flight (FR-010 debounce)

**Checkpoint**: User Story 1 complete — users can "Add to End" on any container in the library browser. Queue appends without interrupting playback.

---

## Phase 4: User Story 2 — Replace Queue and Start Playback (Priority: P1)

**Goal**: Users can replace the current queue with a container's tracks and immediately start playback — the "Play Now" action for entire collections.

**Independent Test**: Have music playing, select "Replace Queue" (or "Play Now") on a different album, confirm the old queue is cleared, new tracks are loaded, and playback begins from the first track.

### Implementation for User Story 2

- [X] T011 [US2] Implement replaceQueueAndPlay(groupId, uri, objectId) service method in backend/src/services/sonos-local-service.ts — flush() → resolveContainerTracks + sequential queue() → selectTrack(1) + play(), return ContainerQueueResponse, with step-specific error messages per R-03
- [X] T012 [US2] Expose replaceQueueAndPlay through the adapter in backend/src/services/sonos-adapter.ts
- [X] T013 [US2] Add POST /api/sonos/groups/:groupId/queue/replace endpoint in backend/src/api/sonos.ts — validate uri and objectId, require auth + CSRF, call adapter.replaceQueueAndPlay(), return ContainerQueueResponse or step-specific error JSON
- [X] T014 [US2] Add useReplaceQueueAndPlay() mutation hook in frontend/src/hooks/useSonos.ts — POST to /api/sonos/groups/:groupId/queue/replace with { uri, objectId }, invalidate queue + playback state queries on success, expose isPending state
- [X] T015 [US2] Wire PlayActionMenu "Play Now" and "Replace Queue" actions on container items in frontend/src/components/sonos/BrowsePanel.tsx — call useReplaceQueueAndPlay() mutation, hide "Play Next" for containers, show toast on success ("Now playing: N tracks") and error
- [X] T016 [US2] Disable queue action buttons when no Sonos group is selected in frontend/src/components/sonos/BrowsePanel.tsx — check groupId is non-null, hide or disable PlayActionMenu on containers when no group selected (FR-009)

**Checkpoint**: User Story 2 complete — users can "Play Now" / "Replace Queue" on any container. Combined with US1, both core queue operations work from the library browser.

---

## Phase 5: User Story 3 — Browse All Library Categories (Priority: P2)

**Goal**: All six library sub-tabs (Folders, Artists, Albums, Genres, Tracks, Playlists) load and display content, support drill-down navigation with breadcrumbs, and support infinite scroll.

**Independent Test**: Click each sub-tab and confirm it loads the appropriate content from the music library, supports scrolling, and allows drill-down into containers with breadcrumb back-navigation.

### Implementation for User Story 3

- [X] T017 [US3] Add "Genres" entry to the LIBRARY_SUB_TABS array in frontend/src/components/sonos/BrowsePanel.tsx — add { id: 'genres', label: 'Genres', icon: Tag } (or appropriate icon) after Albums, matching existing sub-tab pattern from R-04
- [X] T018 [US3] Verify all six sub-tabs render correctly and display content from the music library in frontend/src/components/sonos/BrowsePanel.tsx — confirm that Folders (share), Artists, Albums, Genres, Tracks, and Playlists (sonos_playlists) each load data via the existing browseLibrary/getMusicLibrary API, fix any missing or broken category bindings
- [X] T019 [US3] Verify breadcrumb drill-down navigation works for all sub-tabs in frontend/src/components/sonos/BrowsePanel.tsx — confirm clicking a container (artist, genre, folder) drills down to show its contents, and breadcrumb navigation allows returning to previous levels without losing scroll position (SC-005)
- [X] T020 [US3] Verify infinite scroll loads additional items for all sub-tabs in frontend/src/components/sonos/BrowsePanel.tsx — confirm scrolling to the bottom of any sub-tab triggers progressive loading via the existing pagination mechanism (FR-008)

**Checkpoint**: User Story 3 complete — all six library categories are browsable with drill-down and infinite scroll.

---

## Phase 6: User Story 4 — Queue Actions on Nested Content (Priority: P3)

**Goal**: Queue action buttons ("Add to Queue" and "Replace Queue") are available at every level of drill-down navigation, not just at the top-level browse view.

**Independent Test**: Browse to Artists → select an artist → see their albums → select "Add to Queue" on one album, and confirm it works the same as from the top-level Albums view.

### Implementation for User Story 4

- [X] T021 [US4] Ensure PlayActionMenu renders on container items at all drill-down levels in frontend/src/components/sonos/BrowsePanel.tsx — verify the container detection and action menu rendering from T009/T015 applies to items returned from browseContainer() (drill-down results), not only from browseLibrary() (top-level results) (FR-004)
- [X] T022 [US4] Handle edge case: empty containers at nested levels in frontend/src/components/sonos/BrowsePanel.tsx — when a container resolves to 0 tracks (V-05), show a toast "No tracks found in this container" and do not modify the queue

**Checkpoint**: User Story 4 complete — queue actions work consistently at every navigation depth.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and validation that span multiple stories

- [X] T023 [P] Handle empty container edge case in backend/src/services/sonos-local-service.ts — when resolveContainerTracks returns 0 tracks, return 200 with tracksAdded: 0 and descriptive message (V-05)
- [X] T024 [P] Handle Sonos unreachable / group unavailable errors consistently in backend/src/api/sonos.ts — ensure new endpoints return clear error JSON with appropriate status codes when device is offline or group is invalid
- [X] T025 [P] Add structured logging for new queue operations in backend/src/services/sonos-local-service.ts — log container resolution start/complete/error with track counts using existing sonosWarn/sonosError patterns
- [X] T026 Run quickstart.md validation — follow all verification steps in specs/042-sonos-library-queue/quickstart.md to confirm end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (T003, T004) — core "add to queue" functionality
- **US2 (Phase 4)**: Depends on Foundational (T003, T004) and US1 (T010 for PlayActionMenu loading state) — reuses container resolution engine
- **US3 (Phase 5)**: Depends on Setup only — can proceed in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US1 (T009) and US2 (T015) — extends their container action wiring to drill-down views
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — shares PlayActionMenu loading state from US1 (T010), but backend work is independent
- **User Story 3 (P2)**: Can start after Setup (Phase 1) — fully independent, frontend-only work
- **User Story 4 (P3)**: Depends on US1 + US2 container action wiring — extends existing implementation to nested views

### Within Each User Story

- Backend service method → adapter exposure → API endpoint → frontend hook → component wiring
- Each story is independently testable at its checkpoint

### Parallel Opportunities

- T001 and T002 can run in parallel (different workspaces)
- US1 backend (T005–T007) and US3 (T017–T020) can proceed in parallel after Foundational
- US1 backend (T005–T007) and US2 backend (T011–T013) can proceed in parallel after Foundational
- T023, T024, T025 can all run in parallel (different concerns, different files)

---

## Parallel Example: User Story 1 + User Story 3

```bash
# After Foundational (Phase 2) completes, launch in parallel:

# Stream 1: US1 backend
Task: "T005 — Implement addContainerToQueue in backend/src/services/sonos-local-service.ts"
Task: "T006 — Expose addContainerToQueue in backend/src/services/sonos-adapter.ts"
Task: "T007 — Add POST add-container endpoint in backend/src/api/sonos.ts"

# Stream 2: US3 frontend (fully independent)
Task: "T017 — Add Genres sub-tab in frontend/src/components/sonos/BrowsePanel.tsx"
Task: "T018 — Verify all six sub-tabs render in frontend/src/components/sonos/BrowsePanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types and interfaces)
2. Complete Phase 2: Foundational (container track resolution engine)
3. Complete Phase 3: User Story 1 — "Add to Queue"
4. **STOP and VALIDATE**: Test adding albums/folders to queue
5. Complete Phase 4: User Story 2 — "Replace Queue and Play"
6. **STOP and VALIDATE**: Test replacing queue and starting playback
7. Deploy/demo if ready — core queue functionality is complete

### Incremental Delivery

1. Setup + Foundational → Track resolution engine ready
2. US1 → "Add to Queue" works → Deploy/Demo (MVP!)
3. US2 → "Replace Queue" works → Deploy/Demo
4. US3 → All library sub-tabs browsable → Deploy/Demo
5. US4 → Queue actions at all drill-down levels → Deploy/Demo
6. Polish → Edge cases, logging, validation → Final release

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new database entities — all runtime data from Sonos devices
- Backend uses existing auth (requireAuth) + CSRF (assertCsrf) middleware on all new mutation endpoints
- Container track resolution capped at 1,000 tracks per operation (V-04)
- Frontend debounce via TanStack Query isPending state — no separate debounce library needed (R-05)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
