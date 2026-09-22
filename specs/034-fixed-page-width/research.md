# Research — Fixed Page Width

## Table of Contents
- [R1: react-grid-layout WidthProvider and Fixed Width](#r1-react-grid-layout-widthprovider-and-fixed-width)
- [R2: Optimal Fixed Grid Width for 12-Column Dashboard](#r2-optimal-fixed-grid-width-for-12-column-dashboard)
- [R3: Breakpoint Transition Strategy](#r3-breakpoint-transition-strategy)
- [R4: Existing Breakpoint Configuration](#r4-existing-breakpoint-configuration)

---

## R1: react-grid-layout WidthProvider and Fixed Width

**Question**: How does `WidthProvider(Responsive)` determine width, and how can we constrain it to a fixed width on desktop?

**Decision**: Remove `WidthProvider` wrapper on desktop and pass an explicit `width` prop to the `Responsive` component when above the mobile breakpoint. Alternatively, constrain the container element's width with CSS `max-width` — `WidthProvider` reads its parent's `offsetWidth`, so constraining the parent automatically constrains the grid.

**Rationale**: `WidthProvider` is a HOC that attaches a `ResizeObserver` to the grid's container and passes the measured width as the `width` prop to `Responsive`. If the container has a fixed/max width, the grid will never exceed that width regardless of viewport size. This is the simplest approach — requires only CSS on the wrapping div, no RGL code changes.

**Alternatives considered**:
1. **Replace WidthProvider with explicit `width` prop**: More control but requires managing resize logic manually and breaks the existing responsive behaviour below the breakpoint.
2. **Use RGL's `maxWidth` support**: RGL does not natively support `maxWidth` on the grid — would need a fork or wrapper.
3. **CSS `max-width` on container div**: ✅ Chosen. Minimal code change, `WidthProvider` auto-adapts, mobile continues to work at 100% width because `max-width` has no effect when viewport is smaller.

---

## R2: Optimal Fixed Grid Width for 12-Column Dashboard

**Question**: What fixed width should the desktop grid use?

**Decision**: Use `1200px` as the grid's `max-width`. This matches the existing `lg` breakpoint threshold (`BREAKPOINTS.lg = 1200`), ensures all 12 columns render at their intended size, and accommodates all current widget configurations without overflow.

**Rationale**: 
- The existing `lg` breakpoint fires at 1200px — this is where the full 12-column layout activates.
- Setting `max-width: 1200px` means widgets never stretch beyond what they were designed for.
- Common desktop viewports (1366px, 1440px, 1920px) are all wider than 1200px, so the grid will be fixed and centred.
- For viewports between 768px–1200px, the grid still uses responsive breakpoints (md: 8 cols, sm: 4 cols) which is correct behaviour.

**Alternatives considered**:
1. **1440px** — Too wide; widgets would be overstretched on standard 1080p monitors.
2. **1024px** — Too narrow; would force the `md` breakpoint on common 1366px laptops.
3. **1200px** — ✅ Matches existing breakpoint; grid columns are pre-designed for this width.

---

## R3: Breakpoint Transition Strategy

**Question**: How should the layout transition between fixed-width desktop and fluid mobile?

**Decision**: Use a CSS media query approach. Above 768px (the existing `sm` breakpoint), apply `max-width: 1200px` and `margin: 0 auto` to centre the grid. Below 768px, the existing `isMobile` state already renders a stacked layout — no change needed there.

**Rationale**: 
- The existing code already has a mobile detection at `BREAKPOINTS.xs = 480px` that renders a completely different stacked layout.
- RGL's responsive breakpoints handle the intermediate sizes (sm: 768px, md: 996px).
- The fixed width only needs to cap the `lg` breakpoint range (≥1200px viewport). Between 996px–1200px, the grid naturally fits at full container width (which is less than max-width, so no capping occurs).
- No CSS transitions needed — the width simply stops growing past 1200px. The "transition" is seamless because at exactly 1200px viewport width, `max-width: 1200px` equals the viewport width.

**Alternatives considered**:
1. **JavaScript-based width clamping**: Unnecessary complexity; CSS handles this natively.
2. **Separate component for desktop vs mobile**: Over-engineering; the existing `isMobile` branch + CSS max-width handles both modes.
3. **CSS `clamp()`**: Could work but adds complexity for no benefit over simple `max-width`.

---

## R4: Existing Breakpoint Configuration

**Question**: What are the current breakpoints and how do they interact with the fixed width?

**Decision**: Keep all existing breakpoints unchanged. The fixed width only constrains the upper bound.

**Rationale**: Current breakpoints from `DashboardGrid.tsx`:
```typescript
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 };
```

Interaction with fixed width:
- **≥1200px viewport**: Grid capped at 1200px, centred. 12 columns. Widgets stable.
- **996px–1199px viewport**: Grid fills viewport (below max-width). 8 columns (md).
- **768px–995px viewport**: Grid fills viewport. 4 columns (sm).
- **480px–767px viewport**: Grid fills viewport. 2 columns (xs).
- **<480px viewport**: Mobile stacked layout (existing `isMobile` branch, no RGL).

The mobile stacked layout at ≤480px is completely separate code and unaffected. The spec's "mobile breakpoint" aligns with the existing `xs: 480px` threshold.

**Alternatives considered**: None — the existing breakpoint scheme is well-designed and the spec explicitly states "existing mobile breakpoint definitions are correct and do not need to change."
