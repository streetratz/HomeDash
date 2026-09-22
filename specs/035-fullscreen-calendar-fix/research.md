# Research — Fix FullScreen Calendar Filtered Events

## Table of Contents

- [R-01: Independent Data Fetching Strategy](#r-01-independent-data-fetching-strategy)
- [R-02: Visible Month Range Computation](#r-02-visible-month-range-computation)
- [R-03: Source ID Resolution](#r-03-source-id-resolution)
- [R-04: Existing API Capability Confirmation](#r-04-existing-api-capability-confirmation)

---

## R-01: Independent Data Fetching Strategy

**Decision**: FullScreenCalendar calls `useCalendarEvents(sourceIds, from, to)` directly
instead of receiving pre-filtered `events` as props.

**Rationale**: The `useCalendarEvents` hook already wraps TanStack Query with proper
caching, deduplication, and loading/error states. Calling it directly inside the
component means:
- The full-screen view controls its own date range (full visible month)
- The full-screen view controls its own source list (all sources)
- TanStack Query handles caching — if the user closes and reopens the same month,
  cached data is served instantly
- No prop-drilling of large event arrays through the component tree

**Alternatives considered**:
- Lifting state to a shared context: Rejected — adds complexity and couples the widget
  and full-screen views unnecessarily. They have different data needs.
- Creating a separate hook: Rejected — `useCalendarEvents` already supports arbitrary
  parameters; no need for a new abstraction.

---

## R-02: Visible Month Range Computation

**Decision**: Compute the date range as the full grid range (including overflow days from
previous/next months that fill the 6-row week grid).

**Rationale**: A standard month calendar grid shows 42 cells (6 weeks × 7 days). The
visible range must start on the Sunday before the 1st (or the 1st itself if it's a Sunday)
and end on the Saturday after the last day. This ensures events visible on overflow days
are fetched.

**Implementation**:
```typescript
const start = new Date(year, month, 1);
start.setDate(start.getDate() - start.getDay()); // Back to Sunday
const end = new Date(year, month + 1, 0);         // Last day of month
end.setDate(end.getDate() + (6 - end.getDay()) + 1); // Forward to next Sunday (exclusive)
```

**Alternatives considered**:
- Fetching only the exact month (1st to last day): Rejected — events on visible overflow
  days would be missing, confusing users.
- Fetching 3 months of data: Rejected — over-fetching wastes bandwidth for LAN-hosted
  deployment (Principle III).

---

## R-03: Source ID Resolution

**Decision**: The CalendarWidget passes `sources.map(s => s.id)` (ALL available sources)
to FullScreenCalendar's `sourceIds` prop. The component falls back to all sources from
the `sources` prop if `sourceIds` is empty.

**Rationale**: The full-screen view should show everything regardless of widget filtering.
The widget already fetches all sources via `useCalendarSources()`, so passing all source
IDs is zero-cost. The fallback handles edge cases where sourceIds might be empty.

**Alternatives considered**:
- Having FullScreenCalendar call `useCalendarSources()` itself: Viable but adds an
  extra query when the parent already has the data. The current approach avoids redundant
  network requests.
- Passing no sourceIds and always using all sources: Rejected — keeping the prop allows
  future flexibility (e.g., a filtered full-screen view).

---

## R-04: Existing API Capability Confirmation

**Decision**: No backend changes required. The existing endpoint
`GET /api/public/calendar/events?sourceIds=...&from=...&to=...` already supports:
- Arbitrary date ranges (ISO 8601 strings)
- Multiple source IDs (comma-separated)
- No maximum event limit at the API level

**Rationale**: Confirmed by inspecting `useCalendarEvents` hook which calls:
```
/api/public/calendar/events?sourceIds=${sourceIds.join(',')}&from=${from}&to=${to}
```
The same endpoint is already used by CalendarWidget — we're just calling it with
different parameters (wider date range, more sources).

**Alternatives considered**:
- Creating a dedicated full-screen endpoint: Rejected — the existing endpoint is
  general-purpose and handles this use case perfectly.
