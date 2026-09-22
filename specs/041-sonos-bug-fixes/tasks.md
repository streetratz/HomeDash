# Tasks: Sonos Widget Bug Fixes

**Input**: Design documents from `/specs/041-sonos-bug-fixes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Included — constitution principle V (Testing & Change Safety) requires unit tests for stereo pair filtering and volume coordinator logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/` (pnpm workspaces monorepo)

---

## Phase 1: Setup

**Purpose**: No structural changes required — all fixes are within existing files. Setup ensures the environment is ready.

- [X] T001 Verify dev environment builds cleanly with `pnpm install && pnpm build`
- [X] T002 Run existing test suite to establish baseline with `pnpm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No new foundational infrastructure needed — all bug fixes operate on existing code paths.

**⚠️ Note**: This feature requires no foundational phase tasks. All three user stories can begin immediately after Setup.

**Checkpoint**: Setup verified — user story implementation can begin.

---

## Phase 3: User Story 1 — Stereo Pairs Display Correctly (Priority: P1) 🎯 MVP

**Goal**: Filter invisible stereo pair partners from `getGroups()` so phantom rooms no longer appear in the dashboard.

**Independent Test**: Configure a stereo pair and verify the room list shows only the single logical room, not the invisible partner as a separate entry.

### Tests for User Story 1

> **Write tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Add unit test for filtering invisible members from zone groups in backend/tests/unit/sonosDiscovery.test.ts
- [X] T004 [P] [US1] Add unit test for excluding zone groups with zero visible members in backend/tests/unit/sonosDiscovery.test.ts

### Implementation for User Story 1

- [X] T005 [US1] Filter members where `Invisible === "1"` from `playerIds` in `zoneGroupToGroup()` in backend/src/services/sonos-local-service.ts
- [X] T006 [US1] Skip invisible members in `memberToPlayer()` mapping within `getGroups()` in backend/src/services/sonos-local-service.ts
- [X] T007 [US1] Add defensive filter to exclude zone groups with zero visible members after filtering in backend/src/services/sonos-local-service.ts
- [X] T008 [US1] Verify tests pass and run type check with `pnpm --filter backend typecheck`

**Checkpoint**: Stereo-paired speakers display as a single room. Splitting a pair shows both independently. No phantom rooms.

---

## Phase 4: User Story 2 — Volume Slider Controls Coordinator Only (Priority: P1)

**Goal**: Change `setGroupVolume()` to send volume commands only to the group coordinator, preserving relative volume differences between members.

**Independent Test**: Create a multi-room group with different volume levels per room, adjust the group volume slider, and verify only the coordinator receives the command.

### Tests for User Story 2

> **Write tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US2] Add unit test verifying `setGroupVolume()` calls volume on coordinator only (not all members) in backend/tests/unit/sonosDiscovery.test.ts
- [X] T010 [P] [US2] Add unit test verifying single standalone speaker volume still works correctly in backend/tests/unit/sonosDiscovery.test.ts

### Implementation for User Story 2

- [X] T011 [US2] Replace `getMembersForGroup()` with coordinator-only lookup in `setGroupVolume()` in backend/src/services/sonos-local-service.ts
- [X] T012 [US2] Ensure coordinator device is resolved from group and volume is sent only to that device in backend/src/services/sonos-local-service.ts
- [X] T013 [US2] Verify tests pass and run type check with `pnpm --filter backend typecheck`

**Checkpoint**: Group volume slider changes coordinator volume only. Per-player sliders in fullscreen still work. Relative volume balance preserved.

---

## Phase 5: User Story 3 — Now Playing Text Animates Only When Needed (Priority: P2)

**Goal**: Implement conditional marquee animation that scrolls only when text overflows its container, pauses when playback stops, and works in both dashboard widget and fullscreen view.

**Independent Test**: Play tracks with varying title lengths and observe animation behaviour in both widget and fullscreen views.

### Tests for User Story 3

> **Write tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US3] Add unit test for `useTextOverflow` hook detecting overflow state in frontend/src/hooks/useTextOverflow.test.ts
- [X] T015 [P] [US3] Add unit test for `useTextOverflow` hook respecting tolerance buffer in frontend/src/hooks/useTextOverflow.test.ts

### Implementation for User Story 3

- [X] T016 [US3] Create `useTextOverflow` hook using ResizeObserver to detect when text exceeds container width (4px tolerance) in frontend/src/hooks/useTextOverflow.ts
- [X] T017 [US3] Refactor SonosWidget compact mode to apply `animate-marquee` only when `overflows && isPlaying` in frontend/src/components/widgets/SonosWidget.tsx
- [X] T018 [US3] Add React `key` prop tied to track name for clean animation reset on track change in frontend/src/components/widgets/SonosWidget.tsx
- [X] T019 [US3] Add conditional marquee animation to track title in fullscreen view replacing `truncate` class in frontend/src/components/sonos/FullScreenSonos.tsx
- [X] T020 [US3] Ensure marquee pauses/stops when playback is not active (remove animation class or use `animation-play-state: paused`) in frontend/src/components/widgets/SonosWidget.tsx and frontend/src/components/sonos/FullScreenSonos.tsx
- [X] T021 [US3] Verify tests pass and run type check with `pnpm --filter frontend typecheck`

**Checkpoint**: Short titles static, long titles animate, animation pauses on stop, fullscreen matches widget behaviour.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and regression checks across all three fixes.

- [X] T022 [P] Run full test suite (backend + frontend) with `pnpm test` to verify zero regressions
- [X] T023 [P] Run full type check across both workspaces with `pnpm --filter backend typecheck && pnpm --filter frontend typecheck`
- [X] T024 Run quickstart.md verification checklist against running dev environment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — no foundational tasks needed
- **User Stories (Phases 3-5)**: Can begin immediately after Setup
  - US1 and US2 share the same backend file but different functions — can be parallelized with care
  - US3 is entirely frontend — fully independent of US1 and US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent — no dependencies on other stories
- **User Story 2 (P1)**: Independent — no dependencies on other stories (different function in same file)
- **User Story 3 (P2)**: Independent — entirely frontend, no backend dependencies

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation tasks within a story are sequential (same file modifications)
- Type check verification is the final step per story

### Parallel Opportunities

- US1 tests (T003, T004) can run in parallel
- US2 tests (T009, T010) can run in parallel
- US3 tests (T014, T015) can run in parallel
- US1 and US3 can be implemented fully in parallel (different files)
- US2 and US3 can be implemented fully in parallel (different files)
- US1 and US2 touch the same file — sequence recommended (or careful non-overlapping edits)
- Polish tasks T022 and T023 can run in parallel

---

## Parallel Example: All User Stories

```bash
# After Setup, launch backend and frontend stories in parallel:

# Thread A (Backend — US1 then US2):
Task: T003 - Unit test for invisible member filtering
Task: T004 - Unit test for zero-visible-member groups
Task: T005-T008 - Implement stereo pair filtering
Task: T009-T010 - Unit tests for coordinator volume
Task: T011-T013 - Implement coordinator-only volume

# Thread B (Frontend — US3):
Task: T014 - Unit test for useTextOverflow hook
Task: T015 - Unit test for tolerance buffer
Task: T016-T021 - Implement conditional marquee
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 3: User Story 1 (T003-T008)
3. **STOP and VALIDATE**: Verify phantom rooms are gone
4. Deploy/demo if ready — most impactful visual fix

### Incremental Delivery

1. Setup → verified ✓
2. User Story 1 (stereo pairs) → Test independently → Most visible fix
3. User Story 2 (volume) → Test independently → Correct audio behaviour
4. User Story 3 (marquee) → Test independently → Visual polish
5. Polish → Full regression check → Deploy

### Parallel Strategy

With two developers:

1. Both verify Setup
2. Once Setup is verified:
   - Developer A: US1 + US2 (backend/src/services/sonos-local-service.ts)
   - Developer B: US3 (frontend hooks + components)
3. Both complete → Polish phase together

---

## Notes

- All three bugs are in existing files — no new project structure needed
- US1 and US2 modify the same service file (`sonos-local-service.ts`) but different functions
- US3 creates one new file (`useTextOverflow.ts`) and modifies two existing components
- The existing `animate-marquee` Tailwind keyframe is reused — no CSS config changes needed
- Volume debouncing already exists in the frontend — US2 only changes the backend target
