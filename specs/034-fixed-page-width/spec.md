# Feature Specification: Fixed Page Width

**Feature Branch**: `034-fixed-page-width`  
**Created**: 2025-07-14  
**Updated**: 2026-05-25  
**Status**: In Progress  
**Input**: User requirement: Dashboard grid cells must be a fixed 180×180px on desktop. Never resize. Only go responsive on mobile (≤480px stacked layout). Grid width is determined by: 12 columns × 180px + 13 margins × 12px = 2316px.

## User Scenarios & Testing

### User Story 1 - Fixed Cell Size Desktop Grid (Priority: P1)

As a desktop user, I want each grid cell to always be exactly 180×180px so that widgets maintain their designed size regardless of browser viewport width.

**Why this priority**: This is the core problem — widgets currently scale with viewport width, making the layout unstable.

**Independent Test**: Open the dashboard on any desktop viewport, resize the browser horizontally — widget cells remain 180×180px, never squish or stretch.

**Acceptance Scenarios**:

1. **Given** the browser viewport is above the mobile breakpoint (480px), **When** the dashboard renders, **Then** each 1×1 grid cell is exactly 180×180px.
2. **Given** the browser viewport is wider than 2316px, **When** the user views the dashboard, **Then** the grid is centred with space on each side, cells remain 180×180px.
3. **Given** the browser viewport is narrower than 2316px but above 480px, **When** the user views the dashboard, **Then** the page scrolls horizontally, cells remain 180×180px.

---

### User Story 2 - Mobile Responsive Behaviour Preserved (Priority: P2)

As a mobile user, I want the dashboard to continue using the existing stacked layout so that widgets remain readable on small screens.

**Why this priority**: Mobile already works — this must not regress.

**Independent Test**: Open the dashboard at ≤480px viewport — stacked layout functions as before.

**Acceptance Scenarios**:

1. **Given** the viewport is ≤480px, **When** the dashboard renders, **Then** widgets display in the existing single-column stacked layout with auto-height.

---

## Requirements

### Functional Requirements

- **FR-001**: Grid cells MUST be exactly 180×180px on desktop (above 480px breakpoint).
- **FR-002**: Grid container MUST have a fixed width of 2316px (12 cols × 180px + 13 × 12px margins).
- **FR-003**: Grid MUST be horizontally centred when viewport is wider than 2316px.
- **FR-004**: The dashboard MUST use the existing stacked layout at ≤480px (mobile).
- **FR-005**: No dynamic row height computation — cell size is a constant, not derived from container width.

### Key Entities

- **DESKTOP_CELL_SIZE**: 180px — fixed height and width of each 1×1 grid unit.
- **DESKTOP_GRID_WIDTH**: 2316px — computed from columns, cell size, and margins.
- **Mobile breakpoint**: 480px — below this, stacked layout renders instead.

## Success Criteria

- **SC-001**: On any desktop viewport, a 1×1 widget cell measures exactly 180×180px.
- **SC-002**: Resizing the browser on desktop causes zero widget reflow or size change.
- **SC-003**: Mobile stacked layout continues to function identically.
- **SC-004**: Grid is horizontally centred on viewports wider than 2316px.

## Assumptions

- Horizontal scrolling is acceptable when viewport is between 480px and 2316px.
- The 180px cell size accommodates all existing widget configurations.
- The mobile stacked layout at ≤480px requires no changes.
