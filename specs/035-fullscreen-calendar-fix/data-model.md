# Data Model — Fix FullScreen Calendar Filtered Events

## Entities

This feature does not introduce new entities or modify existing data schemas. It changes
how existing entities are queried at the component level.

### CalendarEvent (existing, unchanged)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique event identifier |
| sourceId | string | ID of the calendar source this event belongs to |
| title | string | Event title/summary |
| startAt | string (ISO 8601) | Event start time |
| endAt | string (ISO 8601) | Event end time |
| startTz | string \| null | Timezone of the start time |
| isAllDay | boolean | Whether this is an all-day event |
| isPrivate | boolean | Whether this is a private event |
| location | string \| null | Event location |

### CalendarSource (existing, unchanged)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique source identifier |
| name | string | Display name (e.g., "Work", "Personal") |
| color | string | Hex color for visual differentiation |

### VisibleMonthRange (computed, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| from | string (ISO 8601) | Start of visible grid (Sunday before month start) |
| to | string (ISO 8601) | End of visible grid (day after Saturday past month end) |

Computed per render based on `currentMonth` state. Used as parameters to
`useCalendarEvents()`.

## Interface Changes

### FullScreenCalendarProps (component interface)

**Before**:
```typescript
interface FullScreenCalendarProps {
  events: CalendarEvent[];
  sources: CalendarSource[];
  onClose: () => void;
}
```

**After**:
```typescript
interface FullScreenCalendarProps {
  sourceIds: string[];          // All source IDs to fetch events for
  sources: CalendarSource[];    // Source metadata for display
  onClose: () => void;
}
```

**Migration**: Internal component interface only — not a public API. CalendarWidget is the
sole consumer and is updated in the same change.

## State Transitions

### FullScreenCalendar Data Loading

```
IDLE → LOADING → SUCCESS
                → ERROR
```

- **IDLE**: Component not mounted (full-screen closed)
- **LOADING**: `useCalendarEvents` query in-flight (show loading indicator per FR-007)
- **SUCCESS**: Events displayed on calendar grid
- **ERROR**: Error state with retry option (existing TanStack Query error handling)

Month navigation triggers: `SUCCESS → LOADING → SUCCESS/ERROR` (new query for new date range).

## Validation Rules

No new validation rules. The existing `useCalendarEvents` hook has:
- `enabled: sourceIds.length > 0` — won't fire with empty sources
- `staleTime: 60_000` — 1-minute cache to avoid redundant fetches
