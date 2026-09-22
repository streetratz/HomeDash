# Research: Shortcuts Widget Improvements & Single-Link Widget

**Feature**: 030-shortcuts-single-link
**Date**: 2025-07-17

## Table of Contents

- [R1: Icon Wrapping Strategy — CSS Flexbox vs Grid Auto-Fill](#r1-icon-wrapping-strategy--css-flexbox-vs-grid-auto-fill)
- [R2: Widget Size Preset Detection](#r2-widget-size-preset-detection)
- [R3: Overflow Behaviour Per Size Preset](#r3-overflow-behaviour-per-size-preset)
- [R4: Icon Size Pixel Mapping](#r4-icon-size-pixel-mapping)
- [R5: Hover & Active State Patterns](#r5-hover-and-active-state-patterns)
- [R6: Single-Link Background Colour/Gradient Implementation](#r6-single-link-background-colourgradient-implementation)
- [R7: Text Contrast on Custom Backgrounds](#r7-text-contrast-on-custom-backgrounds)
- [R8: Widget Registry Pattern Compliance](#r8-widget-registry-pattern-compliance)

---

## R1: Icon Wrapping Strategy — CSS Flexbox vs Grid Auto-Fill

**Decision**: Use CSS `flex-wrap: wrap` with fixed-size icon containers.

**Rationale**: The current `AppShortcutsWidget` uses `display: grid` with `gridTemplateColumns: repeat(N, minmax(0, 1fr))`, which makes icons stretch/shrink to fill columns. Flexbox with `flex-wrap: wrap` and fixed-width children naturally achieves the wrapping behaviour specified in FR-001/FR-002 — icons maintain their configured pixel size and reflow to new rows when the container narrows.

**Alternatives considered**:
- `grid-template-columns: repeat(auto-fill, <fixed-px>)` — Also achieves wrapping, but the current `columns` config option becomes redundant since auto-fill determines column count from available width. This would be a config-breaking change.
- Keep CSS Grid with `minmax(<fixed>, 1fr)` — Icons still stretch within cells. Doesn't satisfy FR-001 (icons MUST NOT shrink).

**Implementation note**: Replace the `grid` div with a `flex flex-wrap` div. Each shortcut anchor gets a fixed width derived from icon size + padding. The `columns` config becomes the *maximum* columns (via `max-width` on the container or `flex-basis` on items), but the actual count auto-adjusts on resize.

---

## R2: Widget Size Preset Detection

**Decision**: Derive size preset from the widget's parent placeholder `h` value (react-grid-layout height units).

**Rationale**: The spec distinguishes S/M/L "size presets" (issue #112 assumption) as the placeholder's grid-layout size allocation, NOT the `iconSize` config. The `PlaceholderWidget` wraps the `WidgetRenderer` → widget component chain. The widget component receives `WidgetView` which does NOT currently include placeholder dimensions. Two options:

1. **Pass placeholder dimensions via React context** — The `PlaceholderWidget` already wraps widgets; add a context provider that exposes `{ w, h }` grid units.
2. **Use a CSS/DOM approach** — Measure the widget container's pixel height and choose overflow strategy accordingly.

**Decision**: Use approach (2) — a `ResizeObserver` or CSS container queries. This avoids threading layout data through context and is self-contained within the widget. The widget measures its own container height and selects overflow mode:
- Container height ≤ 1 row of icons → S mode (horizontal scroll)
- Container height ≤ 2 rows → M mode (max 2 rows visible, vertical scroll)
- Container height > 2 rows → L mode (show all, no scroll)

This naturally adapts to any placeholder size without hardcoded breakpoints.

**Alternatives considered**:
- React context for placeholder dimensions — More coupling; every widget would receive data most don't need.
- Config-based preset selector — Adds user-facing complexity; the spec says presets correspond to grid size, not user selection.

---

## R3: Overflow Behaviour Per Size Preset

**Decision**: Implement overflow via CSS `overflow-x` / `overflow-y` toggled by measured container height relative to computed row height.

| Preset | Rows Visible | Overflow | CSS |
|--------|-------------|----------|-----|
| S (short) | 1 | Horizontal scroll | `overflow-x: auto; overflow-y: hidden; flex-wrap: nowrap` |
| M (medium) | 2 | Vertical scroll after row 2 | `overflow-y: auto; max-height: 2 * rowHeight` |
| L (tall) | All | None — content expands | `overflow: visible` (flex container grows) |

**Rationale**: The `ROW_HEIGHT` in `DashboardGrid.tsx` is 80px. With margins, a placeholder with `h=2` (160px minus padding/header) would be "S", `h=3-4` would be "M", `h=5+` would be "L". Rather than hardcoding these thresholds, the widget measures its available height and computes how many icon rows fit, then selects the appropriate overflow mode.

---

## R4: Icon Size Pixel Mapping

**Decision**: Map icon sizes to fixed pixel values for both the icon element and the containing interactive cell.

| Config | Icon Class | Icon px | Cell min-width | Touch Target |
|--------|-----------|---------|---------------|-------------|
| `sm` | `h-8 w-8` | 32×32 | 52px | 52×52 (≥44px ✅) |
| `md` | `h-10 w-10` | 40×40 | 60px | 60×60 (≥44px ✅) |
| `lg` | `h-14 w-14` | 56×56 | 76px | 76×76 (≥44px ✅) |

**Rationale**: Current `ICON_SIZE_CLASS` mapping already defines these. The cell size adds padding (p-2 = 8px each side) to the icon, ensuring the interactive area exceeds the 44×44px WCAG minimum. The fixed cell widths ensure FR-010 compliance: at a standard 300px widget width, small fits ~5 icons/row, medium ~4, large ~3 — small fits >50% more than large.

---

## R5: Hover and Active State Patterns

**Decision**: Use Tailwind `group-hover` scale + background highlight, and `group-active` press effect.

**Rationale**: The current widget already uses `group-hover:scale-110` on icons. Enhance with:
- **Hover**: `bg-accent/50` on the cell + `scale-105` on the icon (subtle, visible)
- **Active**: `scale-95` on the icon + `bg-accent/70` on the cell (press feedback)
- Both use transform (not colour-only) to satisfy WCAG non-text contrast (SC-003)

**Alternatives considered**:
- Border on hover — Adds layout shift. Rejected.
- Shadow on hover — Works but heavier visually on a dense grid. Could add as supplementary.

---

## R6: Single-Link Background Colour/Gradient Implementation

**Decision**: Support CSS colour values and a curated set of gradient presets, stored as a `backgroundStyle` string in the widget config.

**Gradient presets** (aligned with existing HomeDash design language):
- `gradient-blue` → `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- `gradient-green` → `linear-gradient(135deg, #11998e 0%, #38ef7d 100%)`
- `gradient-orange` → `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)`
- `gradient-dark` → `linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)`
- `gradient-sunset` → `linear-gradient(135deg, #fa709a 0%, #fee140 100%)`
- `gradient-ocean` → `linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)`

**Storage**: The config stores `background: string | null` where:
- `null` = default card background
- `#rrggbb` = solid colour
- `gradient-<name>` = lookup in preset map

**Rationale**: The existing `ColorPicker` component supports hex values. Gradient presets are rendered as clickable swatches in the config form. This avoids arbitrary CSS injection while providing visually appealing options. Aligns with the assumption: "standard CSS colour values and a curated set of gradient presets."

---

## R7: Text Contrast on Custom Backgrounds

**Decision**: Apply a subtle text shadow and semi-transparent dark overlay behind text elements.

**Rationale**: The spec edge case requires sufficient contrast when label text overlays a custom background. Strategy:
- Text gets `text-shadow: 0 1px 3px rgba(0,0,0,0.3)` for readability
- A semi-transparent overlay (`bg-black/20`) behind the text area ensures contrast
- Text colour defaults to white (`text-white`) on custom backgrounds, with the overlay ensuring visibility on light gradients

**Alternatives considered**:
- Dynamic luminance detection (compute from hex → choose black/white text) — More complex; doesn't handle gradients well. Could add later.

---

## R8: Widget Registry Pattern Compliance

**Decision**: Follow the established 3-file pattern documented in `registry.tsx` (SC-008).

Files for Single-Link widget:
1. `SingleLinkWidget.tsx` — Display component (`WidgetDisplayProps`)
2. `SingleLinkConfigForm.tsx` — Config form component (`WidgetConfigFormProps`)
3. Entry in `registry.tsx` — `widgetRegistry.set('single_link', { ... })`

Plus `SingleLinkConfig` interface in `dashboards.ts`.

**Rationale**: Every existing widget follows this exact pattern. The registry uses a `Map<string, WidgetTypeDefinition>` with consistent shape. The `WidgetRenderer` resolves via `widgetRegistry.get(widget.type)`. No backend changes needed — the type string `'single_link'` will be stored in the existing `widget_instances.type` column, and config JSON in the `config` column.
