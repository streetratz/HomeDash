# Implementation Plan: Fixed Page Width

**Branch**: `034-fixed-page-width` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)

## Summary

Fix the dashboard grid to use a fixed 180×180px cell size on desktop. The grid container is locked to 2316px wide (12 cols × 180px + 13 × 12px margins), centred with `mx-auto`. No dynamic row height computation — `rowHeight` is a constant. Mobile stacked layout (≤480px) remains unchanged. This is a single-file change in `DashboardGrid.tsx`.

## Technical Approach

**What changed:**
1. Replaced `computeSquareRowHeight()` dynamic function with `DESKTOP_CELL_SIZE = 180` constant
2. Added `DESKTOP_GRID_WIDTH = 2316` constant (derived from columns × cell size + margins)
3. Removed `ResizeObserver` that dynamically recomputed row height
4. Set grid container to fixed `width: 2316px` with `mx-auto` centring
5. `rowHeight` is now a constant (`180`), not state

**What stays the same:**
- Mobile stacked layout (≤480px) — separate render path, unaffected
- react-grid-layout breakpoints still defined (for `WidthProvider` internals)
- Edit mode drag/resize — works at fixed cell size
- Widget positioning data — unchanged (x, y, w, h in grid units)

## File Changes

| File | Change |
|------|--------|
| `frontend/src/components/DashboardGrid.tsx` | Replace dynamic sizing with fixed constants |

## Complexity

Minimal — single file, ~15 lines changed. No backend, no migrations, no new dependencies.
