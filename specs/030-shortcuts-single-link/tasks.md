# Tasks: Shortcuts Widget Improvements & Single-Link Widget

**Input**: Design documents from `/specs/030-shortcuts-single-link/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/` for source, `frontend/tests/` for tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — ensure feature branch is ready and dependencies are current

- [x] T001 Verify feature branch `030-shortcuts-single-link` is checked out and `pnpm install` is up to date
- [x] T002 Add `SingleLinkConfig` interface to `frontend/src/state/dashboards.ts` with fields: `url: string`, `label: string`, `iconKey: string | null`, `subtitle: string | null`, `background: string | null`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared constants and utilities that multiple user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Define icon size pixel mapping constants (`ICON_CELL_WIDTH`) for `sm: 52px`, `md: 60px`, `lg: 76px` in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — these fixed cell widths drive the flexbox layout for US1 and the density requirements for US2
- [x] T004 [P] Define `GRADIENT_PRESETS` constant map (`gradient-blue`, `gradient-green`, `gradient-orange`, `gradient-dark`, `gradient-sunset`, `gradient-ocean` → CSS gradient strings) in `frontend/src/components/widgets/SingleLinkWidget.tsx` — used by US3 display and config form

**Checkpoint**: Foundation ready — icon size constants and gradient presets established. User story implementation can begin.

---

## Phase 3: User Story 1 — Icons Wrap Instead of Shrink on Resize (Priority: P1) 🎯 MVP

**Goal**: Shortcut icons maintain their configured pixel size and reflow into rows rather than shrinking. Overflow behaviour adapts to widget size preset: S = 1 row horizontal scroll, M = 2 rows vertical scroll, L = all rows visible.

**Independent Test**: Add 8+ shortcuts to a Shortcuts widget, resize to various widths and height presets, and confirm icons never shrink below their configured size. S/M/L presets produce distinct overflow behaviours.

### Implementation for User Story 1

- [x] T005 [US1] Replace CSS Grid layout with Flexbox wrapping in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — change the inner `<div className="grid ...">` to `<div className="flex flex-wrap ...">` with each shortcut anchor getting a fixed width via `ICON_CELL_WIDTH[cfg.iconSize]` as `flex: 0 0 <width>px` style; remove the `gridTemplateColumns` inline style
- [x] T006 [US1] Add container height measurement using `useRef` + `ResizeObserver` in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — compute available height and icon row height to determine overflow mode: S (≤1 row height → `overflow-x: auto, flex-wrap: nowrap`), M (≤2 rows → `overflow-y: auto, max-height: 2 × rowHeight`), L (>2 rows → `overflow: visible`, all rows shown)
- [x] T007 [US1] Apply overflow CSS classes conditionally based on detected size preset in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — S preset: single row with horizontal scroll (`overflow-x-auto overflow-y-hidden flex-nowrap`), M preset: 2 visible rows with vertical scroll (`overflow-y-auto`), L preset: all rows visible no scroll
- [x] T008 [US1] Preserve existing mobile behaviour (viewport < 768px) in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — ensure the new flexbox/overflow logic does not apply or gracefully degrades on mobile viewports; verify `flex-wrap: wrap` works correctly on narrow screens without regressions

**Checkpoint**: At this point, Shortcuts widget icons wrap at fixed size with S/M/L overflow presets working. User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 — Better Space Management and Styling (Priority: P2)

**Goal**: Compact grid spacing, visible hover/active states on shortcut icons, visually distinct icon sizes, and graceful label truncation.

**Independent Test**: Hover and click shortcuts in each icon size setting (sm/md/lg), verify visual feedback appears. Confirm grid spacing is tighter than baseline. Verify small fits ≥50% more icons per row than large at the same width.

### Implementation for User Story 2

- [x] T009 [P] [US2] Reduce grid gap from `gap-2` (8px) to `gap-1` (4px) in the flex container in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — verify minimum 44×44px interactive touch targets are maintained via the cell width constants from T003
- [x] T010 [P] [US2] Add hover state to shortcut icon cells in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — add `hover:bg-accent/50 rounded-lg transition-colors` to each shortcut `<a>` element; keep existing `group-hover:scale-110` on icons or adjust to `group-hover:scale-105` for subtlety
- [x] T011 [US2] Add active/pressed state to shortcut icon cells in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — add `active:scale-95 active:bg-accent/70` classes to each shortcut `<a>` element for press feedback; ensure transform-based (not colour-only) to satisfy WCAG non-text contrast
- [x] T012 [US2] Change label truncation from `line-clamp-2` to single-line ellipsis in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — replace `line-clamp-2` on the `<span>` label with `truncate` (Tailwind: `overflow-hidden text-ellipsis whitespace-nowrap`) and add `max-w-full` to constrain within the cell width

**Checkpoint**: At this point, Shortcuts widget has compact spacing, hover/active states, and proper label truncation. User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 — Single-Link Widget Type (Priority: P3)

**Goal**: New "Single-Link" widget type — a large clickable tile displaying one prominent link with icon, label, optional subtitle, and configurable background colour/gradient. Registered in widget picker and follows existing widget lifecycle.

**Independent Test**: Create a new Single-Link widget from the widget picker, configure URL/icon/label/subtitle/background, verify it displays correctly and opens the URL in a new tab on click.

### Implementation for User Story 3

- [x] T013 [US3] Create `SingleLinkWidget` display component in `frontend/src/components/widgets/SingleLinkWidget.tsx` — render a full-size clickable tile (`<a>` with `target="_blank" rel="noopener noreferrer"`) displaying a large centered icon (using existing icon resolution chain: CDN → Lucide → Globe fallback), label text, optional subtitle in smaller text below label; apply `text-white text-shadow` on custom backgrounds; apply semi-transparent overlay (`bg-black/20`) behind text for contrast on custom backgrounds; resolve `background` config: `null` → default card bg, `#rrggbb` → solid colour via inline style, `gradient-*` → lookup in `GRADIENT_PRESETS` map; handle edge cases: empty URL shows "Configure URL" hint and disables click, missing icon shows Globe fallback
- [x] T014 [US3] Create `SingleLinkConfigForm` component in `frontend/src/components/widgets/SingleLinkConfigForm.tsx` — form with fields: URL input (required, validated via `new URL()`), label input (required, max 100 chars), icon picker (reuse existing `IconPicker` component), subtitle input (optional, max 200 chars), background section with colour picker (reuse existing `ColorPicker` component) and gradient preset swatches (clickable cards showing each `GRADIENT_PRESETS` entry); call `onConfigChange` (matching `WidgetConfigFormProps.onChange`) on every field update
- [x] T015 [US3] Register `single_link` widget type in `frontend/src/components/widgets/registry.tsx` — import `SingleLinkWidget` and `SingleLinkConfigForm`, import `Link` icon from `lucide-react`, add `widgetRegistry.set('single_link', { type: 'single_link', name: 'Single Link', description: 'A prominent single-link tile with icon and optional background', icon: Link, component: SingleLinkWidget, configComponent: SingleLinkConfigForm, defaultConfig: { url: '', label: '', iconKey: null, subtitle: null, background: null }, minW: 1, minH: 1 })`

**Checkpoint**: All three user stories are now independently functional. Single-Link widget can be created, configured, and used from the widget picker.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling, documentation, and validation across all stories

- [x] T016 [P] Handle edge case: Shortcuts widget with 0 shortcuts in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — verify existing empty state still renders correctly with the new flexbox layout (should already work, confirm no regression)
- [x] T017 [P] Handle edge case: Single icon in L preset in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — verify a single icon does not stretch to fill the flex container (fixed width from T005 should prevent this, confirm)
- [x] T018 [P] Handle edge case: Shortcut icon image load failure in `frontend/src/components/widgets/AppShortcutsWidget.tsx` — add `onError` handler to `<img>` elements that swaps to a fallback Globe icon; ensure label remains visible
- [x] T019 [P] Handle edge case: Long URL in Single-Link config — verify URL is stored and used for navigation but not displayed in tile (only label shown); already handled by T013 design, confirm
- [x] T020 Run TypeScript type-check across frontend (`pnpm tsc --noEmit`) to verify no type errors from new interfaces and components
- [x] T021 Run `quickstart.md` validation — start dev server, test Shortcuts widget wrapping with 8+ icons, test Single-Link widget creation and click-through

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T002 for types) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T003 for icon cell constants)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T003 for icon cell constants); independent of US1 but builds on same file
- **User Story 3 (Phase 5)**: Depends on Phase 1 (T002 for `SingleLinkConfig`) and Phase 2 (T004 for gradient presets); fully independent of US1 and US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Shares `AppShortcutsWidget.tsx` with US1 but modifies different aspects (styling vs layout); best done sequentially after US1 to avoid merge conflicts
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — Fully independent files (`SingleLinkWidget.tsx`, `SingleLinkConfigForm.tsx`, `registry.tsx`); CAN run in parallel with US1/US2

### Within Each User Story

- Layout/structure changes before styling refinements
- Core implementation before edge case handling
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 (Foundational) can run in parallel — different files
- T009 and T010 (US2) can run in parallel — different aspects of same component
- All US3 tasks (T013, T014) can run in parallel — different files
- US3 (Phase 5) can run in FULL PARALLEL with US1+US2 (Phases 3-4) — completely separate files
- All Polish tasks marked [P] (T016–T019) can run in parallel

---

## Parallel Example: User Stories 1+2 and 3

```bash
# After Foundational phase completes:

# Developer A: User Stories 1 & 2 (same file: AppShortcutsWidget.tsx)
Task T005: Replace Grid with Flexbox wrapping
Task T006: Add container height measurement
Task T007: Apply overflow CSS per size preset
Task T008: Preserve mobile behaviour
Task T009: Reduce grid gap (can start after T005)
Task T010: Add hover state (can start after T005)
Task T011: Add active state
Task T012: Change label truncation

# Developer B: User Story 3 (separate files, fully parallel)
Task T013: Create SingleLinkWidget.tsx
Task T014: Create SingleLinkConfigForm.tsx
Task T015: Register in registry.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T004)
3. Complete Phase 3: User Story 1 (T005–T008)
4. **STOP and VALIDATE**: Test icon wrapping with 8+ shortcuts across S/M/L presets
5. Deploy/demo — immediate value for all existing Shortcuts users

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (icon wrapping) → Test independently → Deploy (MVP!)
3. Add User Story 2 (spacing & styling) → Test independently → Deploy
4. Add User Story 3 (Single-Link widget) → Test independently → Deploy
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Stories 1 & 2 (sequential, same file)
   - Developer B: User Story 3 (fully independent files)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All changes are frontend-only — no backend or schema modifications needed
- US1 and US2 modify the same file (`AppShortcutsWidget.tsx`) so should be done sequentially
- US3 creates new files and is fully parallelizable with US1/US2
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
