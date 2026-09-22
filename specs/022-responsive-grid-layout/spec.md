# 022 — Responsive Grid Layout

## Problem Statement

HomeDash currently stores a single set of grid coordinates (`x, y, w, h`) per placeholder widget. The same layout is passed to every react-grid-layout breakpoint (`lg`, `md`, `sm`, `xs`, `xxs`). When the browser window shrinks, RGL compresses widgets into fewer columns using the *same* widths/heights — causing them to overlap or squish rather than reflowing gracefully.

Homarr solves this with **per-breakpoint layout shapes** — each widget stores independent position and size for every responsive tier. We already use `react-grid-layout`'s `<ResponsiveGridLayout>` but pass the same layout to all breakpoints. This spec upgrades the system to use distinct, persisted layouts per breakpoint.

## Current State

| Aspect | Current Implementation |
|--------|----------------------|
| Library | `react-grid-layout` (already installed) |
| Component | `<ResponsiveGridLayout>` in `DashboardGrid.tsx` |
| Breakpoints | Defined: `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }` |
| Columns | Defined: `{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }` |
| Layout data | Single `x, y, w, h` on `placeholder_widgets` table |
| Issue | `layouts = { lg: layout, md: layout, sm: layout, ... }` — identical for all breakpoints |

## Goals

1. **Per-breakpoint layout persistence** — store independent `x, y, w, h` per breakpoint per placeholder
2. **Automatic fallback generation** — when a breakpoint layout doesn't exist, compute a reasonable default from the larger breakpoint
3. **Edit mode saves to current breakpoint** — drag/resize in edit mode updates only the active breakpoint
4. **Graceful reflow** — at smaller breakpoints, widgets stack vertically with appropriate widths
5. **Migration** — existing single-layout data becomes the `lg` layout; other breakpoints auto-generated on first load
6. **Min/max constraints** — widget types can declare minimum/maximum grid sizes

## Non-Goals

- Separate dashboards per device (already handled by user preferences `webDashboardId` / `mobileDashboardId`)
- Free-form / non-grid layout
- Nested grids (we use placeholder multi-widget instead)

---

## Design

### Breakpoint Tiers

| Tier | Key | Min Width | Columns | Use Case |
|------|-----|-----------|---------|----------|
| Desktop | `lg` | 1200px | 12 | Full monitors, large tablets landscape |
| Tablet | `md` | 996px | 8 | Tablets, narrow desktop |
| Small | `sm` | 768px | 4 | Tablets portrait, large phones landscape |
| Phone | `xs` | 480px | 2 | Phones |
| Tiny | `xxs` | 0px | 1 | Single-column fallback |

### Data Model Change

#### Option A: Separate Table (Recommended)

New table `placeholder_layouts`:

```sql
CREATE TABLE placeholder_layouts (
  id TEXT PRIMARY KEY,
  placeholder_id TEXT NOT NULL REFERENCES placeholder_widgets(id) ON DELETE CASCADE,
  breakpoint TEXT NOT NULL, -- 'lg' | 'md' | 'sm' | 'xs' | 'xxs'
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(placeholder_id, breakpoint)
);
```

The existing `x, y, w, h` columns on `placeholder_widgets` become the **canonical/lg layout** and remain for backwards compatibility. The `placeholder_layouts` table stores overrides for other breakpoints.

**Rationale:** Avoids wide schema changes. Keeps existing API contracts intact. Only adds data for breakpoints that differ from `lg`.

#### Option B: JSON Column

Store a `layouts_json` TEXT column on `placeholder_widgets`:
```json
{
  "lg": { "x": 0, "y": 0, "w": 6, "h": 4 },
  "md": { "x": 0, "y": 0, "w": 4, "h": 4 },
  "sm": { "x": 0, "y": 0, "w": 4, "h": 3 }
}
```

Simpler schema but harder to query/index and breaks the existing column pattern.

#### Recommendation: Option A

- Relational, queryable
- Non-breaking (existing `x/y/w/h` remain as `lg` default)
- Only stores overrides (sparse — most dashboards won't customize every breakpoint)

### Fallback Logic

When a breakpoint has no stored layout:

1. Start from the next-larger breakpoint that has data
2. Clamp `w` to the target breakpoint's column count
3. Recalculate `x` to fit within bounds (if `x + w > cols`, shift left)
4. Keep `h` unchanged
5. Run RGL's compact algorithm to prevent overlaps

This runs **client-side only** — the server doesn't need to know about fallbacks until the user explicitly edits at that breakpoint.

### Edit Mode Behavior

1. Edit mode indicator shows the **current active breakpoint** (e.g., "Editing: Desktop (lg)")
2. Drag/resize updates **only the active breakpoint's layout**
3. User can optionally "Copy layout to smaller breakpoints" as a bulk action
4. Save persists all modified breakpoint layouts in one API call

### API Changes

#### Save Layout Endpoint (existing, extended)

`PUT /api/admin/dashboards/:id/layout`

Current payload:
```json
{
  "placeholders": [
    { "stableKey": "abc", "x": 0, "y": 0, "w": 6, "h": 4, ... }
  ]
}
```

Extended payload:
```json
{
  "placeholders": [
    {
      "stableKey": "abc",
      "x": 0, "y": 0, "w": 6, "h": 4,
      "layouts": {
        "md": { "x": 0, "y": 0, "w": 4, "h": 4 },
        "sm": { "x": 0, "y": 0, "w": 4, "h": 3 }
      },
      ...
    }
  ]
}
```

The top-level `x, y, w, h` remains the `lg` layout (backwards compatible). The optional `layouts` object contains overrides for other breakpoints.

#### Read Dashboard Endpoint (extended response)

`PlaceholderView` gains an optional `layouts` field:
```typescript
interface PlaceholderView {
  // ... existing fields
  x: number; y: number; w: number; h: number; // lg (canonical)
  layouts?: {
    md?: { x: number; y: number; w: number; h: number };
    sm?: { x: number; y: number; w: number; h: number };
    xs?: { x: number; y: number; w: number; h: number };
    xxs?: { x: number; y: number; w: number; h: number };
  };
}
```

### Frontend Changes

#### `DashboardGrid.tsx`

```typescript
// Build per-breakpoint layouts instead of reusing one
const layouts = useMemo(() => {
  const lg = placeholders.map(ph => ({ i: ph.stableKey, ...ph }));
  const md = placeholders.map(ph => ({ i: ph.stableKey, ...(ph.layouts?.md ?? computeFallback(ph, 'md')) }));
  const sm = placeholders.map(ph => ({ i: ph.stableKey, ...(ph.layouts?.sm ?? computeFallback(ph, 'sm')) }));
  // ...
  return { lg, md, sm, xs, xxs };
}, [placeholders]);
```

#### `useEditMode.ts`

- Track `currentBreakpoint` (detected from container width or RGL's `onBreakpointChange`)
- `onPositionChange` writes to the current breakpoint only
- `saveEdit` sends full layout map

#### New: Breakpoint Indicator

A small chip/badge in edit mode showing "Desktop (12 col)" / "Tablet (8 col)" etc., so the user knows which layout they're editing.

### Widget Size Constraints

Widget types can declare constraints in the registry:

```typescript
widgetRegistry.set('weather', {
  component: WeatherWidget,
  configForm: WeatherConfigForm,
  gridConstraints: { minW: 3, minH: 3, maxW: 12, maxH: 8 },
});
```

These map to RGL's `minW`, `minH`, `maxW`, `maxH` per layout item.

---

## Migration Plan

1. **DB migration**: Create `placeholder_layouts` table
2. **No data migration needed** — existing `x, y, w, h` on `placeholder_widgets` IS the `lg` layout. Other breakpoints start empty and use fallback logic.
3. **Frontend**: Update `DashboardGrid.tsx` to build per-breakpoint `layouts` object with fallback computation
4. **API**: Extend save endpoint to accept optional `layouts` object
5. **Edit mode**: Wire up breakpoint-aware saves

### Rollout Phases

**Phase 1 — Auto-reflow (no persistence)**
- Implement `computeFallback()` to generate reasonable md/sm/xs/xxs from lg
- Widgets reflow gracefully on resize with zero DB changes
- Users get immediate improvement

**Phase 2 — Persisted breakpoint layouts**
- Add `placeholder_layouts` table + migration
- Extend save API to persist breakpoint overrides
- Edit mode saves to current breakpoint

**Phase 3 — Edit UX polish**
- Breakpoint indicator badge
- "Preview at breakpoint" mode (simulate narrower widths)
- "Copy to smaller" bulk action
- Widget type constraints from registry

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Fallback algorithm produces overlaps | Use RGL's built-in `compactType="vertical"` for non-lg breakpoints |
| User edits at md then resizes to lg — confused | Show breakpoint indicator clearly; only save active breakpoint |
| Complex save payload | Backwards compatible — `layouts` is optional, old clients still work |
| Performance with many widgets | HomeDash has ~10-20 widgets max; RGL handles this easily |

---

## Success Criteria

- [ ] Resizing browser from 1400px → 800px → 480px shows widgets reflowing to fewer columns without squishing
- [ ] Edit mode at tablet width saves tablet-specific layout
- [ ] Desktop layout remains unaffected by tablet edits
- [ ] Existing dashboards work without migration (lg fallback from current x/y/w/h)
- [ ] Export/import preserves per-breakpoint layouts
