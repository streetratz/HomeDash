# Feature Specification: Local Birthday Calendar

**Feature Branch**: `050-local-birthday-calendar`
**Created**: 2026-09-20
**Status**: Draft
**Input**: GitHub issue #180, Phase 2

## User Stories

### User Story 1 — Import birthdays from CSV

As an administrator, I want to preview and import a documented birthday CSV so I can
populate the Calendar widget without a publishable external calendar URL.

### User Story 2 — Maintain birthdays manually

As an administrator, I want to add, edit, and remove birthday records so corrections do
not require rebuilding and re-uploading a file.

### User Story 3 — Export portable birthday data

As an administrator, I want CSV and ICS exports so the locally managed birthday source
is portable outside HomeDash.

## Requirements

- **FR-001**: HomeDash MUST support a `birthday_local` calendar source owned by the
  authenticated administrator.
- **FR-002**: Birthday rows MUST store first name, optional last name, month, day,
  optional birth year, optional notes, and timestamps in SQLite.
- **FR-003**: Birthday records MUST be included automatically in existing database
  backup and restore flows.
- **FR-004**: The backend MUST generate yearly all-day calendar events from enabled
  local birthday sources.
- **FR-005**: CSV format MUST use
  `first_name,last_name,month,day,birth_year,notes`; first name, month, and day are
  required and import MUST support quoted fields.
- **FR-006**: CSV import MUST provide a non-mutating preview with row-level validation
  before append or replace is allowed.
- **FR-006a**: Every successfully imported CSV row MUST become the same editable
  server-side record used by manual entry; imports MUST NOT remain opaque file content.
- **FR-007**: Manual create, update, and delete operations MUST immediately regenerate
  the source's materialized events.
- **FR-008**: Export MUST support CSV and standards-compatible ICS without writing
  temporary files.
- **FR-009**: All read routes MUST require authentication; all mutations MUST require
  admin authorization and CSRF protection.
- **FR-010**: Inputs MUST be bounded and validate calendar dates, names, notes, source
  ownership, source type, and import row count.
- **FR-011**: CSV export MUST neutralize spreadsheet-formula prefixes.
- **FR-012**: Existing OAuth, URL iCal, and static ICS sources MUST remain unchanged.
- **FR-013**: The management UI MUST work at approximately 360px width with labelled,
  touch-sized controls and honest empty/error states.
- **FR-014**: This PR MUST advance only the README Main badge to `v3.1.6`.

## Edge Cases

- February 29 birthdays in non-leap years produce no February 29 occurrence.
- Birthday month/day values are date-only data and never pass through timezone
  conversion.
- Birth year is omitted, malformed, or later than the generated occurrence year.
- CSV contains duplicate rows, extra columns, blank lines, CRLF endings, escaped
  quotes, invalid dates, or formula-like text.
- Append import duplicates an existing birthday.
- Replace import fails validation and must leave existing rows untouched.
- A birthday source is disabled when records change.

## Success Criteria

- CSV preview, append, and replace paths have positive and negative tests.
- Manual CRUD immediately changes returned calendar events.
- CSV and ICS exports round-trip names, dates, years, and notes.
- Ownership, CSRF, malformed input, size limits, and backup/migration safety are tested.
- Existing calendar suites remain green.
