# Tasks: Settings & Config Fixes

**Input**: Design documents from `/specs/039-settings-config-fixes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included — UTC validation requires test coverage per constitution (V. Testing & Change Safety).

**Organization**: Tasks grouped by priority (P1 blocking fixes → P2 features → P3 housekeeping → Validation).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type and API contract changes that unblock all subsequent fixes

- [ ] T001 Add `titleFont` and `titleFontSizePx` to public bootstrap shell payload in `backend/src/api/public.ts`
- [ ] T002 Add `clockDisplayConfig` (from `homeClockConfig` JSON) as top-level field in bootstrap shell payload in `backend/src/api/public.ts`
- [ ] T003 Remove `headerStyleTarget` from public bootstrap shell payload in `backend/src/api/public.ts`
- [ ] T004 [P] Add `titleFont`, `titleFontSizePx`, and `clockDisplayConfig` to `ShellSettings` interface in `frontend/src/state/bootstrap.ts`
- [ ] T005 [P] Remove `headerStyleTarget` from `ShellSettings` interface in `frontend/src/state/bootstrap.ts`

**Checkpoint**: Backend exposes new fields; frontend types match. No rendering changes yet.

---

## Phase 2: P1 Blocking Fixes — Font Application (US1) 🎯 MVP

**Goal**: Title font and font size saved in settings visually apply to the dashboard header

**Independent Test**: Admin saves titleFont: "Roboto" at 28px → public dashboard header renders in Roboto at 28px

### Implementation for User Story 1

- [ ] T006 [US1] Apply dynamic `fontFamily` and `fontSize` inline styles to title element in `frontend/src/components/ShellLayout.tsx` using bootstrap `titleFont` and `titleFontSizePx` values (use font family mapping from data-model.md)

**Checkpoint**: Font settings now visually apply. Verify with any non-default font.

---

## Phase 3: P1 Blocking Fixes — Logo Cache Invalidation (US2)

**Goal**: Newly uploaded logo appears on dashboard immediately without page refresh

**Independent Test**: Upload a new logo → dashboard header shows new logo within 2s without manual refresh

### Implementation for User Story 2

- [ ] T007 [US2] Add `queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] })` after successful logo upload in `frontend/src/components/settings/AppearanceTab.tsx`

**Checkpoint**: Logo uploads immediately reflect on public dashboard.

---

## Phase 4: P2 Fixes — Repository Link, Clock Config, Dead Code (US3, US4, US5)

**Goal**: Render repoUrl in footer; fix clock config derivation; confirm headerStyleTarget removal renders cleanly

**Independent Test (US3)**: Set repoUrl in settings → "Repository" link visible in footer, opens in new tab

**Independent Test (US4)**: Configure 24h clock format, add only extra clocks (no home) → all clocks display in 24h format

**Independent Test (US5)**: Query GET /api/public/bootstrap → `headerStyleTarget` absent from response

### Implementation for User Story 3

- [ ] T008 [P] [US3] Add conditional "Repository" link in footer section of `frontend/src/components/ShellLayout.tsx` — render only when `repoUrl` starts with `http://` or `https://`, use `target="_blank" rel="noopener noreferrer"`

### Implementation for User Story 4

- [ ] T009 [P] [US4] Refactor `ClockStrip.tsx` in `frontend/src/components/ClockStrip.tsx` to accept `clockDisplayConfig` prop from `ShellLayout` instead of deriving `globalCfg` from `clocks.find(c => c.isHome)?.config`
- [ ] T010 [US4] Pass `clockDisplayConfig` from bootstrap data as prop to `ClockStrip` in `frontend/src/components/ShellLayout.tsx`

### Implementation for User Story 5

- [ ] T011 [P] [US5] Remove any frontend references to `headerStyleTarget` from consuming components (if any exist beyond the type already removed in T005)

**Checkpoint**: repoUrl renders in footer; clock display config works without home clock; no headerStyleTarget in public API.

---

## Phase 5: P3 Fixes — UTC Test & Screensaver Consolidation (US6, US7)

**Goal**: Regression test for UTC validation; screensaver uses shared mutation for consistent cache invalidation

**Independent Test (US6)**: `isValidTimezone('UTC')` returns true in unit test

**Independent Test (US7)**: Save screensaver settings → correct query keys invalidated (same as other shell settings)

### Implementation for User Story 6

- [ ] T012 [P] [US6] Create unit test file `backend/tests/unit/shellSettingsService.test.ts` with tests for `isValidTimezone`: 'UTC' → true, 'America/New_York' → true, 'Invalid/Timezone' → false, '' → false

### Implementation for User Story 7

- [ ] T013 [P] [US7] Replace inline `useMutation` in screensaver panel of `frontend/src/components/settings/AppearanceTab.tsx` with shared `useUpdateShellSettings()` hook from `frontend/src/state/settings.ts`

**Checkpoint**: UTC validation has regression test; screensaver uses unified mutation path.

---

## Phase 6: Validation & Polish

**Purpose**: Verify all changes compile, pass tests, and don't regress existing functionality

- [ ] T014 Run TypeScript typecheck across monorepo (`pnpm typecheck` or `tsc --noEmit`) — confirm zero errors
- [ ] T015 Run full test suite (`pnpm test`) — confirm all tests pass including new UTC test
- [ ] T016 Run production build (`pnpm build`) — confirm clean build with no warnings related to removed fields
- [ ] T017 Run quickstart.md validation scenarios manually or via E2E

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 Font)**: Depends on T001, T004
- **Phase 3 (US2 Logo)**: No dependency on Phase 1 (doesn't need type changes)
- **Phase 4 (US3/US4/US5)**: US3 needs no setup; US4 depends on T002, T004; US5 depends on T003, T005
- **Phase 5 (US6/US7)**: Independent of all other phases
- **Phase 6 (Validation)**: Depends on ALL prior phases complete

### User Story Dependencies

- **US1 (Font)**: Depends on Phase 1 backend+frontend type changes
- **US2 (Logo)**: Independent — only touches frontend mutation
- **US3 (repoUrl)**: Independent — data already exposed in bootstrap
- **US4 (Clock)**: Depends on Phase 1 (T002 adds clockDisplayConfig to bootstrap)
- **US5 (headerStyleTarget)**: Depends on Phase 1 (T003/T005 remove the field)
- **US6 (UTC test)**: Fully independent — pure unit test
- **US7 (Screensaver)**: Fully independent — frontend-only refactor

### Parallel Opportunities

Within Phase 1: T004 and T005 are parallel (same file but different sections — could be done sequentially if conflict risk). T001–T003 modify same file sequentially.

Within Phase 4: T008, T009, T011 are all parallel (different files).

Within Phase 5: T012 and T013 are parallel (different directories).

Cross-phase: US2 (T007), US6 (T012), and US7 (T013) can all start immediately without waiting for Phase 1.

---

## Parallel Example: Maximum Parallelism After Phase 1

```bash
# These can all run simultaneously after Phase 1 completes:
Task T006: "Apply font styles in ShellLayout.tsx"
Task T007: "Logo cache invalidation in AppearanceTab.tsx"
Task T008: "repoUrl footer link in ShellLayout.tsx"  # different section from T006
Task T009: "clockDisplayConfig prop in ClockStrip.tsx"
Task T012: "UTC validation test in backend/tests/"
Task T013: "Screensaver mutation in AppearanceTab.tsx"  # different section from T007
```

---

## Implementation Strategy

### MVP First (P1 Fixes Only)

1. Complete Phase 1: Setup (type + API changes)
2. Complete Phase 2: Font application (T006)
3. Complete Phase 3: Logo invalidation (T007)
4. **STOP and VALIDATE**: Both P1 blocking bugs are fixed
5. Deploy if needed — remaining fixes are non-blocking

### Incremental Delivery

1. Phase 1 → API contract updated
2. Phase 2 + 3 → P1 blocking bugs fixed (MVP ✅)
3. Phase 4 → P2 features wired up
4. Phase 5 → P3 housekeeping complete
5. Phase 6 → Full validation pass

### Fast Path (Single Developer)

Since all changes are small (1–5 lines each), a single developer can execute T001–T013 sequentially in one session, then validate with T014–T017. Expected total: ~30 minutes of implementation.

---

## Notes

- All fixes are 1–5 line changes — no new files except the UTC test (T012)
- No database migrations required — all columns already exist
- No new API endpoints — only modifying existing bootstrap response shape
- Font family mapping (data-model.md) should be a simple object/switch in ShellLayout
- T007 and T013 both modify AppearanceTab.tsx but in different sections (logo upload vs screensaver panel)
- T006 and T008 both modify ShellLayout.tsx but in different sections (title vs footer)
