# Feature Specification: Widget Picker Redesign

**Feature Branch**: `051-widget-picker-redesign`  
**Created**: 2026-09-20  
**Status**: In progress  
**Issue**: #224

## User Scenario

As an administrator editing a dashboard, I can quickly scan, search, and choose from the
available widgets without deciphering a dense unsorted wall of visually identical cards.

## Requirements

- **FR-001**: The picker MUST group widgets into stable, meaningful categories.
- **FR-002**: Widgets MUST be sorted alphabetically within each category.
- **FR-003**: Search MUST match widget names, descriptions, and category labels.
- **FR-004**: The dialog MUST use available desktop width while remaining usable from
  approximately 360 px.
- **FR-005**: Widget cards MUST preserve keyboard access, visible focus, touch-friendly
  targets, and the existing add-widget behavior.
- **FR-006**: The picker MUST provide a clear empty state when no widgets match.
- **FR-007**: Category metadata MUST live with widget definitions so future widgets are
  intentionally classified.

## Success Criteria

- All registered widgets appear exactly once with an empty search.
- Categories and widgets have deterministic ordering.
- A widget can be found by its name, descriptive terms, or category name.
- The picker renders one column on mobile and two spacious columns on larger screens.

## Out of Scope

- Changing widget configuration forms or default configurations.
- Ranking widgets by usage or storing recent selections.
- Adding or removing widget types.
