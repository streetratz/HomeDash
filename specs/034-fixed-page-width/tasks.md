# Tasks: Fixed Page Width

**Input**: Design documents from `/specs/034-fixed-page-width/`
**Status**: Implementation complete

## Summary

Single-file change in `frontend/src/components/DashboardGrid.tsx`:
- Fixed cell size: `DESKTOP_CELL_SIZE = 180` (180×180px per grid unit)
- Fixed grid width: `DESKTOP_GRID_WIDTH = 2316px` (12 cols × 180 + 13 margins × 12)
- Removed dynamic `computeSquareRowHeight()` function
- Removed `ResizeObserver` row height recalculation
- Grid container set to `width: 2316px` with `mx-auto`
- Mobile stacked layout (≤480px) unchanged

## Tasks

- [x] T001 Replace dynamic row height computation with fixed `DESKTOP_CELL_SIZE = 180` constant in `frontend/src/components/DashboardGrid.tsx`
- [x] T002 Add `DESKTOP_GRID_WIDTH = 2316` constant (12 × 180 + 13 × 12) in `frontend/src/components/DashboardGrid.tsx`
- [x] T003 Remove `computeSquareRowHeight()` function from `frontend/src/components/DashboardGrid.tsx`
- [x] T004 Remove `ResizeObserver` and dynamic `setRowHeight` state from `frontend/src/components/DashboardGrid.tsx`
- [x] T005 Set grid container to fixed `width: DESKTOP_GRID_WIDTH` with `mx-auto` centring in `frontend/src/components/DashboardGrid.tsx`
- [x] T006 Verify mobile stacked layout (≤480px) is unaffected — separate render path, no fixed width applied
- [x] T007 Build passes with no errors


---

## Phase 2: Foundational (Blocking Prerequisites)

