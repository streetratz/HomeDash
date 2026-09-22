# Feature Specification: Shortcuts Widget Improvements & Single-Link Widget

**Feature Branch**: `030-shortcuts-single-link`  
**Created**: 2025-07-17  
**Status**: Draft  
**Input**: User description: "Shortcuts widget icon wrapping, space management, and new Single-Link widget type (GitHub issues #112, #107, #108)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Icons Wrap Instead of Shrink on Resize (Priority: P1)

A user has a Shortcuts widget with 12 app icons on their desktop dashboard. When they resize the widget narrower, the icons maintain their fixed size and reflow onto additional rows rather than shrinking to illegible sizes. The widget scrolls vertically if the rows exceed the visible area for the S preset, shows 2 rows for M, and expands to show all rows for L.

**Why this priority**: This is the most impactful usability fix — shrinking icons defeats the purpose of quick-glance app shortcuts. Fixed-size icons with wrapping is the foundation that the other improvements build on.

**Independent Test**: Can be fully tested by adding 8+ shortcuts, resizing the widget to various widths, and confirming icons never shrink below their configured size. Delivers immediate visual improvement for all existing Shortcuts widget users.

**Acceptance Scenarios**:

1. **Given** a Shortcuts widget with 10 icons at "medium" icon size on desktop, **When** the widget is resized narrower than the space needed for all icons in one row, **Then** icons maintain their configured size and wrap to additional rows.
2. **Given** a Shortcuts widget set to size preset "S" on desktop, **When** icons exceed one row, **Then** a single row of icons is visible with horizontal scrolling to access overflow icons.
3. **Given** a Shortcuts widget set to size preset "M" on desktop, **When** icons exceed two rows, **Then** two rows of icons are visible with vertical scrolling to access additional rows.
4. **Given** a Shortcuts widget set to size preset "L" on desktop, **When** icons are displayed, **Then** all icons are visible in a multi-row grid layout without scrolling (widget height expands as needed within grid constraints).
5. **Given** a Shortcuts widget on mobile, **When** the widget is displayed, **Then** existing mobile behaviour is preserved and icons continue to wrap correctly.

---

### User Story 2 — Better Space Management and Styling (Priority: P2)

A user wants their Shortcuts widget to look polished and feel responsive. The grid layout is more compact with tighter spacing, icons have clear hover and active states for visual feedback, and the configurable icon sizes (small/medium/large) produce noticeably different layouts that make effective use of widget space.

**Why this priority**: Visual polish and responsive interaction feedback make the widget feel professional. This builds on the P1 wrapping behaviour to create a cohesive, well-styled experience.

**Independent Test**: Can be tested by hovering/clicking shortcuts in each icon size setting, verifying visual feedback appears, and confirming grid spacing is tighter than the current layout.

**Acceptance Scenarios**:

1. **Given** a Shortcuts widget with icons displayed, **When** the user hovers over a shortcut icon, **Then** a visible hover state is applied (e.g., background highlight or scale effect).
2. **Given** a Shortcuts widget with icons displayed, **When** the user clicks/taps a shortcut icon, **Then** a visible active/pressed state is applied providing feedback before navigation.
3. **Given** a Shortcuts widget configured with "small" icon size, **When** compared to "large" icon size, **Then** the grid density is noticeably different — small fits significantly more icons per row than large.
4. **Given** a Shortcuts widget on a desktop dashboard, **When** icons are displayed in the grid, **Then** spacing between icons is compact but sufficient for touch targets (minimum 44×44px interactive area).
5. **Given** a Shortcuts widget with labels shown, **When** the widget is resized, **Then** labels truncate gracefully with ellipsis rather than overflowing or breaking the layout.

---

### User Story 3 — Single-Link Widget Type (Priority: P3)

A user wants to pin a single prominent link on their dashboard — for example, their home router admin page or a frequently-used web app. They add a "Single-Link" widget which displays as a large, visually distinct tile with a big icon and label that fills the widget area. Clicking anywhere on the tile opens the URL in a new browser tab. They can optionally add a subtitle and configure a custom background colour or gradient to visually distinguish it from other widgets.

**Why this priority**: This is a new widget type that adds value independently from the Shortcuts improvements. It addresses a different use case (single prominent link vs. collection of shortcuts) and can be shipped after the core Shortcuts fixes are stable.

**Independent Test**: Can be tested by creating a new Single-Link widget from the widget picker, configuring a URL/icon/label/subtitle/background, and verifying it displays correctly and opens the URL on click.

**Acceptance Scenarios**:

1. **Given** a user on the dashboard edit mode, **When** they add a new widget, **Then** "Single-Link" appears as an available widget type in the widget picker.
2. **Given** a Single-Link widget configuration form, **When** the user fills in a URL and label, **Then** the widget renders with a large icon and label centered in the widget area.
3. **Given** a Single-Link widget with a configured URL, **When** the user clicks anywhere on the widget tile (outside of edit controls), **Then** the URL opens in a new browser tab.
4. **Given** a Single-Link widget configuration form, **When** the user adds an optional subtitle, **Then** the subtitle appears below the main label in smaller text.
5. **Given** a Single-Link widget configuration form, **When** the user selects a background colour or gradient, **Then** the widget tile renders with that background.
6. **Given** a Single-Link widget on mobile, **When** the user taps the tile, **Then** the URL opens in a new browser tab with the same behaviour as desktop.

---

### Edge Cases

- What happens when a Shortcuts widget has zero shortcuts configured? → Display an empty state with guidance to add shortcuts.
- What happens when a Single-Link widget has no URL configured? → Display the tile with a visual indicator that configuration is needed; clicking does nothing.
- What happens when a shortcut icon image fails to load? → Display a fallback icon (generic link/globe icon) with the label still visible.
- What happens when a Single-Link widget's background colour has poor contrast with the label text? → Ensure text has sufficient contrast by applying a text shadow or semi-transparent overlay.
- What happens when the Shortcuts widget contains only 1 icon in "L" preset? → Display the single icon at its configured size without stretching it to fill the grid.
- What happens when a very long URL is entered for a Single-Link widget? → The URL is stored and used for navigation; it is not displayed in the tile (only the label is shown).

## Requirements *(mandatory)*

### Functional Requirements

**Icon Wrapping & Size Presets (Issue #112)**

- **FR-001**: Shortcut icons MUST maintain their configured pixel size (small/medium/large) regardless of widget width — icons MUST NOT shrink.
- **FR-002**: When icons cannot fit in a single row at their configured size, they MUST wrap to additional rows rather than shrinking or overflowing horizontally (except in "S" preset behaviour).
- **FR-003**: The "S" (Small) size preset on desktop MUST display icons in a single row with horizontal scrolling for overflow icons.
- **FR-004**: The "M" (Medium) size preset on desktop MUST display icons in a maximum of 2 visible rows with vertical scrolling for additional rows.
- **FR-005**: The "L" (Large) size preset on desktop MUST display all icons in a multi-row grid without scrolling, expanding the widget content area as needed.
- **FR-006**: Existing mobile Shortcuts behaviour MUST be preserved — no regressions on screens narrower than 768px.

**Space Management & Styling (Issue #107)**

- **FR-007**: The Shortcuts grid layout MUST use compact spacing that maximises icon density while maintaining minimum 44×44px interactive touch targets.
- **FR-008**: Shortcut icons MUST display a visible hover state when the user's pointer enters the icon area.
- **FR-009**: Shortcut icons MUST display a visible active/pressed state when clicked or tapped.
- **FR-010**: The three icon size options (small/medium/large) MUST produce visually distinct grid densities — small MUST fit at least 50% more icons per row than large at the same widget width.
- **FR-011**: Shortcut labels (when enabled) MUST truncate with ellipsis when they exceed the available width per icon cell.

**Single-Link Widget (Issue #108)**

- **FR-012**: The system MUST provide a "Single-Link" widget type selectable from the widget picker during dashboard editing.
- **FR-013**: The Single-Link widget MUST display a large icon and label that are visually centered within the full widget area.
- **FR-014**: Clicking or tapping anywhere on the Single-Link widget tile (outside of dashboard edit controls) MUST open the configured URL in a new browser tab.
- **FR-015**: The Single-Link widget configuration MUST accept: URL (required), label (required), icon (required), subtitle (optional), and background colour or gradient (optional).
- **FR-016**: The Single-Link widget MUST support a configurable background colour using a colour value or a predefined gradient option.
- **FR-017**: The Single-Link widget MUST be registered in the widget registry and available through the standard widget lifecycle (add, configure, resize, remove).
- **FR-018**: The Single-Link widget MUST persist its configuration through the existing widget data storage mechanism.

### Key Entities

- **Shortcut**: Represents an individual app link within a Shortcuts widget — has a URL, label, and icon. Multiple shortcuts belong to one Shortcuts widget configuration.
- **Single-Link Widget Configuration**: Represents the settings for a Single-Link widget instance — has a URL (required), label (required), icon (required), subtitle (optional), and background style (optional). Stored as widget configuration data alongside the widget instance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Shortcut icons never visually shrink below their configured size at any widget width, verified across S/M/L presets on viewports from 360px to 1920px wide.
- **SC-002**: The S/M/L size presets produce three visually distinct layouts on desktop (≥1024px viewport) — S shows 1 row, M shows 2 rows, L shows all rows.
- **SC-003**: Users can distinguish hover and active states on shortcut icons without relying on colour alone (satisfies WCAG 2.1 non-text contrast).
- **SC-004**: A user can create, configure, and successfully use a Single-Link widget to open a URL in under 60 seconds from the widget picker.
- **SC-005**: Grid spacing between shortcut icons is reduced by at least 20% compared to the current layout while maintaining minimum 44×44px touch targets.
- **SC-006**: All three icon size settings produce measurably different icons-per-row counts at a standard widget width — small fits at least 50% more icons per row than large.
- **SC-007**: Existing Shortcuts widget functionality on mobile viewports (< 768px) has zero regressions — all current acceptance tests continue to pass.

---

### User Story 5 — Pi-hole Composable Sections (Priority: P2)

A user wants fine-grained control over what their Pi-hole widget displays. Instead of a single "display mode" toggle, they can independently enable/disable three sections — **Controls**, **System Stats**, and **Query Stats** — via checkboxes in widget settings. Each section renders as an equal-sized panel card. A **Stats Layout** dropdown (Auto / Side by Side / Stacked) controls how the panels are arranged. When only one section is selected, it fills the widget and centers its content.

**Acceptance Scenarios**:

1. **Given** a Pi-hole widget in settings, **When** the user views display options, **Then** three toggle switches are shown for Controls, System Stats, and Query Stats with at least one required.
2. **Given** all three sections enabled with layout set to "Side by Side", **When** the widget renders at w≥3, **Then** three equal panel cards appear in a horizontal row.
3. **Given** layout set to "Stacked", **When** the widget renders, **Then** all enabled sections stack vertically.
4. **Given** layout set to "Auto", **When** the widget is narrow (w=1), **Then** sections stack; when wide (w≥2), **Then** sections sit side by side.
5. **Given** only Controls selected, **When** the widget renders, **Then** the Pi-hole logo, status dot, and Active/Disable buttons are centered in the widget with no header bar.
6. **Given** a legacy config with `displayMode` and `showSystemHealth` fields, **When** the widget loads, **Then** it migrates to the new `sections` array seamlessly.

**Functional Requirements**:

- **FR-019**: Pi-hole widget configuration MUST support a `sections` array of `'controls' | 'system' | 'queries'` with minimum 1 selection.
- **FR-020**: Pi-hole widget configuration MUST support a `statsLayout` option of `'auto' | 'stacked' | 'side-by-side'`, defaulting to `'auto'`.
- **FR-021**: Controls MUST always render inline as a panel card — never injected into the placeholder header bar.
- **FR-022**: Legacy `displayMode`, `showSystemHealth`, `showBlocklistCount` configs MUST be migrated to `sections` at render time.
- **FR-023**: The Stats Layout dropdown MUST only appear when both System and Query sections are enabled.

---

### User Story 6 — Widget Content Vertical Centering (Priority: P2)

Widget content in UniFi and App Shortcuts widgets should be vertically centered within their grid cells, matching the centered layout already applied to Pi-hole controls.

**Acceptance Scenarios**:

1. **Given** a UniFi widget at any grid size, **When** content is shorter than the widget height, **Then** it is vertically centered.
2. **Given** an App Shortcuts widget at any grid size, **When** content is shorter than the widget height, **Then** it is vertically centered.

## Assumptions

- The existing Shortcuts widget component (`AppShortcutsWidget.tsx`) and its config form (`AppShortcutsConfigForm.tsx`) will be modified in-place rather than replaced.
- The existing widget registry pattern (`registry.tsx`) will be extended to include the new Single-Link widget type.
- The current `iconSize` config options (`'sm' | 'md' | 'lg'`) map directly to the small/medium/large sizing referenced throughout this spec.
- The "size presets" (S/M/L) referenced in issue #112 correspond to the widget's grid-layout size allocation (e.g., `react-grid-layout` w/h values), not the `iconSize` config option.
- The Single-Link widget is a new, independent widget type — it does not replace or modify the existing `links_list` widget type.
- Background colour/gradient configuration for Single-Link uses standard CSS colour values and a curated set of gradient presets, not arbitrary CSS.
- The existing backend data model and API can accommodate the Single-Link widget configuration without schema changes (stored as JSON widget config).
- Touch target minimums (44×44px) follow WCAG 2.5.5 (Enhanced) guidelines, consistent with the constitution's accessibility requirements.
