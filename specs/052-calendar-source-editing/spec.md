# Feature Specification: Calendar Source Editing

**Feature Branch**: `052-calendar-source-editing`
**Created**: 2026-09-20
**Status**: In progress
**Issue**: #226

## Requirements

- **FR-001**: Administrators MUST be able to rename an existing local birthday calendar.
- **FR-002**: Renaming MUST preserve all birthday records and source configuration.
- **FR-003**: Source cards MUST separate identity, sync status, enablement, and actions.
- **FR-004**: Source cards MUST remain usable from approximately 360 px without
  horizontal scrolling or clipped controls.
- **FR-005**: Source actions MUST retain explicit accessible names and destructive
  confirmation.
- **FR-006**: Rename errors MUST remain visible without discarding the entered title.

## Success Criteria

- A saved birthday-calendar title updates immediately in the manager and source list.
- Calendar-event queries are invalidated after source metadata changes.
- Desktop renders a balanced source grid; mobile renders stacked cards with wrapped,
  touch-friendly actions.

## Out of Scope

- Database schema changes.
- Calendar event or birthday record model changes.
- Redesigning OAuth account management.
