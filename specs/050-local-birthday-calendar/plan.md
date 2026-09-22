# Implementation Plan: Local Birthday Calendar

**Branch**: `050-local-birthday-calendar` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Complete #180 with durable local birthday sources. A normalized birthday table stores
editable records; the existing `calendar_events` table remains the widget-facing
contract through deterministic yearly event generation.

## Technical Context

**Stack**: TypeScript, Fastify, Drizzle/SQLite, React 18, TanStack Query
**Migration**: Add `birthday_local` source type and `calendar_birthdays`
**CSV limits**: 1 MiB, 5,000 data rows
**Storage**: Server-side only; existing SQLite backup/restore includes the new table
**Export**: JSON response containing filename, MIME type, and generated CSV or ICS text

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Authenticated reads; admin + CSRF mutations; ownership checks; bounded CSV. |
| Input validation | Zod at HTTP boundaries plus strict row/date validation. |
| Data integrity | Replace import validates fully before a transaction changes rows. |
| Backup/upgrade | Generated additive migration; upgrade gate with representative backup. |
| Mobile/accessibility | Responsive dialog/list, labels, native inputs, touch-sized controls. |
| Compatibility | Existing source types and event read contracts remain unchanged. |

**Result**: PASS.

## Design

### Data model

`calendar_birthdays` stores `id`, `source_id`, `first_name`, optional `last_name`,
`month`, `day`, optional `birth_year`, optional `notes`, and timestamps. The source
foreign key cascades on delete.

### Event materialization

`syncSource()` reads birthday rows and generates all-day UTC events within the existing
calendar window. Provider IDs are deterministic: `birthday:<record-id>:<year>`.

### API

- Create a birthday source.
- List, create, update, and delete birthday rows.
- Preview CSV without mutation.
- Append or replace via CSV after successful validation.
- Export CSV or ICS as bounded text content.

### UI

Calendar Sources gains an **Add Birthdays** action. Existing birthday sources open a
manager dialog with manual rows, CSV preview/import, and CSV/ICS export.

## Threat Model

CSV and text fields are untrusted. The backend limits bytes and rows, rejects malformed
dates and unexpected headers, neutralizes spreadsheet-formula prefixes on export, and
escapes ICS values. IDs are validated and every source/record lookup verifies ownership.

## Rollback

Revert the additive migration and feature code before release. Existing source and event
tables are otherwise unchanged.
