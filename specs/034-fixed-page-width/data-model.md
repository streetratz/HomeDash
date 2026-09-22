# Data Model — Fixed Page Width

## Overview

This feature is a CSS/layout change with no persistent data model modifications. No database schema changes, no new API fields, and no state management changes are required.

## Entities

### Dashboard Grid (existing — no changes)

The `DashboardGrid` component receives its data from the existing `DashboardView` type. No fields are added or modified.

### Layout Constants (new — code-level only)

A new shared constants module provides the fixed-width value and breakpoint definitions:

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `GRID_MAX_WIDTH` | `number` | `1200` | Maximum pixel width for the desktop grid container |
| `BREAKPOINTS` | `Record<string, number>` | `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }` | Existing breakpoints (moved to shared module) |
| `COLS` | `Record<string, number>` | `{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }` | Column counts per breakpoint (moved to shared module) |
| `MARGIN` | `[number, number]` | `[12, 12]` | Grid cell margins (existing) |

### CSS Behaviour Model

| Viewport Width | Grid Behaviour | Centering | Columns |
|----------------|----------------|-----------|---------|
| ≥1200px | Fixed at 1200px max | Horizontally centred via `margin: 0 auto` | 12 |
| 996px–1199px | Fluid (fills viewport) | N/A (fills container) | 8 |
| 768px–995px | Fluid (fills viewport) | N/A (fills container) | 4 |
| 480px–767px | Fluid (fills viewport) | N/A (fills container) | 2 |
| <480px | Mobile stacked layout | Full width | 1 (stacked) |

### State Transitions

```
Viewport resize event
  │
  ├─ width ≥ 1200px → Grid locked at max-width: 1200px, centred
  │                    Widgets DO NOT reflow on resize
  │
  ├─ 480px < width < 1200px → Grid fluid within viewport
  │                            RGL responsive breakpoints handle column changes
  │
  └─ width ≤ 480px → Mobile stacked layout (existing isMobile branch)
                      Completely separate render path
```

## Validation Rules

- `GRID_MAX_WIDTH` must be ≥ the `lg` breakpoint value (1200px) to avoid the grid being smaller than what triggers the 12-column layout.
- The max-width constraint must only apply to the grid container, not the page background or header/footer (those remain full-bleed).

## Relationships

- `DashboardGrid` container div ← receives `max-width` style
- `WidthProvider` (RGL) ← reads container's `offsetWidth` (automatically respects max-width)
- `ShellLayout` (fullBleed) ← unchanged; grid constraint is internal to `DashboardGrid`
- Mobile stacked layout ← completely independent code path; unaffected
