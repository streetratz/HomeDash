# Quickstart — Fix FullScreen Calendar Filtered Events

## What Changed

The full-screen calendar overlay now fetches its own events independently from the
dashboard calendar widget. Previously, it displayed whatever filtered subset the widget
had — now it shows **all events from all connected sources** for the **entire visible
month**.

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/calendar/FullScreenCalendar.tsx` | Accepts `sourceIds` instead of `events`; computes visible month range; calls `useCalendarEvents` directly |
| `frontend/src/components/widgets/CalendarWidget.tsx` | Passes `sourceIds={sources.map(s => s.id)}` instead of `events={filteredEvents}` to FullScreenCalendar |

## How It Works

1. User clicks the expand button on the CalendarWidget
2. CalendarWidget renders `<FullScreenCalendar>` via portal, passing **all** source IDs
3. FullScreenCalendar computes the full visible grid range (6 weeks covering the month)
4. FullScreenCalendar calls `useCalendarEvents(allSourceIds, from, to)` independently
5. Events are displayed on the month grid; navigating months triggers a new fetch

## Development

```bash
# Start frontend dev server
pnpm --filter frontend dev

# Run frontend tests
pnpm --filter frontend test
```

## Verification

1. Configure a CalendarWidget with limited sources (e.g., 2 of 5) and short daysAhead (7)
2. Open the full-screen calendar — verify all 5 sources' events appear for the whole month
3. Navigate to a different month — verify events load for that month
4. Close full-screen — verify the widget still shows its filtered view
5. Check the loading state appears briefly while events are fetched

## No Backend Changes

The existing `GET /api/public/calendar/events?sourceIds=...&from=...&to=...` endpoint
handles this use case without modification.
