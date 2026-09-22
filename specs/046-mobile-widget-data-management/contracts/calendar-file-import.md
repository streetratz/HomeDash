# Calendar File Import Contract

All routes require an authenticated administrator session and a valid CSRF token.
Stored `icsContent` is never returned.

## Create uploaded source

`POST /api/admin/calendar/sources/import`

```json
{
  "name": "Family Birthdays",
  "color": "#a855f7",
  "fileName": "birthdays.ics",
  "icsContent": "BEGIN:VCALENDAR\r\n..."
}
```

Returns `201` with the calendar source summary after events have been parsed and
persisted.

## Replace uploaded source

`POST /api/admin/calendar/sources/{sourceId}/import`

Uses the same body. Returns `200` after replacing the stored content and synchronizing
the source. The source must belong to the current user and have type `ical_file`.

## Validation

- `name`: 1–100 characters
- `color`: six-digit hex color
- `fileName`: 1–255 characters
- `icsContent`: valid VCALENDAR content, maximum 5 MiB UTF-8
- malformed, oversized, wrong-type, or cross-user requests are rejected
