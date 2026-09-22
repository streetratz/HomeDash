# Spec Changelog — Local Birthday Calendar

## CH-01 : Initial Phase 2 scope : 2026-Sep-20

**Type**: New document
**Summary**: Defined durable local birthday CRUD, CSV preview/import, event generation,
and CSV/ICS export to complete #180.

## CH-02 : Clarify imported-row editing : 2026-Sep-20

**Type**: Clarification
**Summary**: Required CSV rows to become normal editable date-only birthday records so
timezone conversion cannot shift the stored month/day.

## CH-03 : Split birthday names : 2026-Sep-20

**Type**: Contract change
**Summary**: Replaced the generic birthday `name` field with required first name and
optional last name fields to avoid collision with a future contacts model.
