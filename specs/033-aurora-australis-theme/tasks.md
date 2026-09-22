# Tasks: Aurora Australis CSS Theme

**Input**: Design documents from `/specs/033-aurora-australis-theme/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested in spec. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing project structure and ensure dev environment is ready for theme work

- [X] T000 Verify project builds cleanly and dev server starts (`pnpm dev` from root)
- [X] T000 [P] Confirm existing theme system works (light/dark toggle in `frontend/src/state/settings.ts` and `frontend/src/components/ThemeToggle.tsx`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend schema extension and core CSS token definition that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T000 Extend `themeMode` enum from `'light' | 'dark'` to `'light' | 'dark' | 'aurora'` in `backend/src/db/schema/index.ts`
- [X] T000 [P] Update Zod validation schema to accept `'aurora'` in `backend/src/services/userPreferencesService.ts`
- [X] T000 [P] Generate Drizzle migration metadata (`pnpm run db:generate` in `backend/`)
- [X] T000 Add `.dark.aurora {}` CSS custom property block with all aurora tokens (--background, --foreground, --card, --popover, --primary, --secondary, --muted, --accent, --destructive, --border, --input, --ring, and all status/chart/sidebar tokens) in `frontend/src/index.css`
- [X] T000 [P] Add aurora-specific CSS custom properties (`--aurora-gradient`, `--aurora-glow`) in `frontend/src/index.css` within the `.dark.aurora` block
- [X] T000 [P] Add `@media (prefers-reduced-motion: reduce)` rule that disables `--aurora-gradient` and `--aurora-glow` in `frontend/src/index.css`
- [X] T000 Extend `ThemeMode` type from `'light' | 'dark'` to `'light' | 'dark' | 'aurora'` and update `applyTheme()` function to handle `.dark.aurora` class logic in `frontend/src/state/settings.ts`
- [X] T010 [P] Update `getStoredTheme()` to recognize `'aurora'` as a valid localStorage value in `frontend/src/state/settings.ts`

**Checkpoint**: Foundation ready — aurora tokens defined, backend accepts 'aurora', state management handles the new theme

---

## Phase 3: User Story 1 — Activate Aurora Australis Theme (Priority: P1) 🎯 MVP

**Goal**: Users can select "Aurora Australis" from a theme picker and see the dashboard immediately switch to deep navy backgrounds with green/teal/purple accents, persisted across sessions.

**Independent Test**: Navigate to Settings → select "Aurora Australis" → verify dashboard background is deep navy, accents are green/teal/purple, reload page → theme persists.

### Implementation for User Story 1

- [X] T010 [US1] Create `ThemePicker.tsx` component using shadcn/ui `DropdownMenu` with three options (Light ☀️, Dark 🌙, Aurora Australis 🌌) in `frontend/src/components/ThemePicker.tsx`
- [X] T010 [US1] Wire `ThemePicker` to call `applyTheme()` and persist selection via `storeTheme()` and `PUT /api/user/preferences` in `frontend/src/components/ThemePicker.tsx`
- [X] T010 [US1] Replace `ThemeToggle` with `ThemePicker` in the header layout in `frontend/src/components/ShellLayout.tsx`
- [X] T010 [US1] Replace theme toggle with `ThemePicker` radio-button group in `frontend/src/components/settings/GeneralTab.tsx`
- [X] T010 [US1] Update `ThemeToggle.tsx` to either redirect to `ThemePicker` or mark as deprecated in `frontend/src/components/ThemeToggle.tsx`

**Checkpoint**: User Story 1 complete — users can activate, persist, and reload the Aurora Australis theme

---

## Phase 4: User Story 2 — Consistent Widget Card Styling (Priority: P2)

**Goal**: All widget cards, navigation elements, and modals render cohesively under the Aurora Australis theme with no unstyled or mismatched elements.

**Independent Test**: Activate Aurora theme → inspect each widget type, nav bar, and at least one modal → confirm consistent navy backgrounds, themed borders, and gradient accent effects.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Audit all widget card components for hardcoded colour values and replace with CSS custom property references where needed (search `frontend/src/components/` for hardcoded hex/rgb values)
- [ ] T017 [P] [US2] Audit modal/dialog components for hardcoded colour values and replace with CSS custom property references in `frontend/src/components/`
- [ ] T018 [P] [US2] Audit navigation/header components for hardcoded colours and ensure they use `--sidebar-*` and `--background`/`--foreground` tokens in `frontend/src/components/ShellLayout.tsx`
- [X] T019 [US2] Add subtle `--aurora-gradient` effect to card borders or decorative elements using a utility class (e.g., `.aurora-accent`) in `frontend/src/index.css`
- [ ] T020 [US2] Apply aurora gradient accent to navigation/header decorative elements via conditional class in `frontend/src/components/ShellLayout.tsx`

**Checkpoint**: User Story 2 complete — all UI surfaces render consistently under Aurora theme

---

## Phase 5: User Story 3 — Accessibility Compliance (Priority: P2)

**Goal**: All text and interactive elements meet WCAG AA contrast requirements under the Aurora Australis theme.

**Independent Test**: Run automated contrast checker against all text/background combinations defined in the `.dark.aurora` token block and confirm all pass 4.5:1 (normal) / 3:1 (large/UI).

### Implementation for User Story 3

- [ ] T021 [US3] Create a contrast validation utility function that calculates WCAG contrast ratios from HSL token values in `frontend/src/lib/contrast-utils.ts`
- [ ] T022 [US3] Validate all aurora token foreground/background pairings using the contrast utility and adjust any failing values in `frontend/src/index.css`
- [ ] T023 [US3] Verify interactive element states (hover, focus, disabled) have distinct visual appearance and meet contrast requirements — update tokens or add state-specific overrides in `frontend/src/index.css`
- [ ] T024 [US3] Confirm text on gradient areas always has a solid background beneath it — add `.aurora-text-safe` utility if needed in `frontend/src/index.css`

**Checkpoint**: User Story 3 complete — all colour pairings validated for WCAG AA compliance

---

## Phase 6: User Story 4 — Switch Back to Default Themes (Priority: P3)

**Goal**: Users can switch away from Aurora Australis back to light or dark theme with no residual aurora styling.

**Independent Test**: Activate Aurora → switch to Light → verify no navy/green/teal remnants. Switch to Dark → verify standard dark theme. Reload → confirm persistence.

### Implementation for User Story 4

- [ ] T025 [US4] Verify `applyTheme()` correctly removes both `.dark` and `.aurora` classes when switching to light in `frontend/src/state/settings.ts`
- [ ] T026 [US4] Verify `applyTheme()` removes `.aurora` class but retains `.dark` when switching to dark in `frontend/src/state/settings.ts`
- [ ] T027 [US4] Ensure no aurora-specific CSS rules leak outside the `.dark.aurora` selector scope — audit `frontend/src/index.css` for any unscoped aurora rules
- [ ] T028 [US4] Validate that `ThemePicker` correctly reflects the active theme state after switching away from Aurora in `frontend/src/components/ThemePicker.tsx`

**Checkpoint**: User Story 4 complete — theme switching is fully reversible with no residual artifacts

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, fallbacks, and documentation

- [ ] T029 [P] Add CSS fallback ensuring new widget types without aurora-specific styles inherit dark-theme base styling gracefully in `frontend/src/index.css`
- [ ] T030 [P] Verify aurora theme renders correctly across target browsers (Chrome, Firefox, Safari, Edge latest 2 versions)
- [ ] T031 [P] Update `frontend/src/components/ThemePicker.tsx` with keyboard navigation and ARIA labels for accessibility
- [ ] T032 Run full application smoke test with Aurora theme active — verify all pages, widgets, modals, and navigation
- [ ] T033 [P] Update any relevant documentation in `docs/` referencing the theme system

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion (can run in parallel with US1)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (CSS tokens must be finalized); ideally run after US2 to validate final token values
- **User Story 4 (Phase 6)**: Depends on Phase 3 (ThemePicker must exist to test switching)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational — Independent of US1 (uses CSS tokens directly)
- **User Story 3 (P2)**: Can start after Foundational — Benefits from US2 being complete (ensures all surfaces use tokens)
- **User Story 4 (P3)**: Depends on US1 (ThemePicker component must exist)

### Within Each User Story

- Core component creation before integration/wiring
- CSS changes before component changes that depend on them
- Audit tasks before fix/adjustment tasks

### Parallel Opportunities

- T004, T005 can run in parallel with each other (different files)
- T006, T007, T008 can be done together (same file, but T007/T008 depend on T006's block existing)
- T009, T010 can run in parallel (different functions in same file — T010 is independent)
- T016, T017, T18 can all run in parallel (auditing different component areas)
- T029, T030, T031, T033 can all run in parallel (different files/concerns)
- US1 and US2 can proceed in parallel after Foundational phase

---

## Parallel Example: Foundational Phase

```bash
# After T003 (schema), launch in parallel:
Task: "Update Zod validation schema in backend/src/services/userPreferencesService.ts"  # T004
Task: "Generate Drizzle migration metadata"  # T005

# After T006 (main CSS block), launch in parallel:
Task: "Add aurora-specific properties (gradient, glow)"  # T007
Task: "Add prefers-reduced-motion rule"  # T008
```

## Parallel Example: User Story 2

```bash
# All audit tasks can run simultaneously:
Task: "Audit widget card components"  # T016
Task: "Audit modal/dialog components"  # T017
Task: "Audit navigation/header components"  # T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify environment)
2. Complete Phase 2: Foundational (schema + CSS tokens + state logic)
3. Complete Phase 3: User Story 1 (ThemePicker + wiring)
4. **STOP and VALIDATE**: Test theme switching independently
5. Deploy/demo if ready — users can already select and use Aurora theme

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Theme is selectable and persists (MVP! 🎉)
3. Add User Story 2 → All UI surfaces look cohesive
4. Add User Story 3 → Accessibility fully validated
5. Add User Story 4 → Switching back works cleanly
6. Polish → Browser compat, docs, edge cases

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (ThemePicker UI)
   - Developer B: User Story 2 (Component audits)
3. After US1 complete: Developer A picks up US4
4. After US2 complete: Developer B picks up US3
5. Both converge on Polish phase
