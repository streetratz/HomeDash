# Feature Specification: Fix FullScreen Calendar Filtered Events

**Feature Branch**: `035-fullscreen-calendar-fix`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Fix issue #123 - FullScreenCalendar shows only what the widget is filtered to. Make FullScreenCalendar fetch its own events for the full visible month range using all available calendar sources."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Events in Full Screen Calendar (Priority: P1)

As a user, when I open the full screen calendar view, I want to see all my calendar events from all connected sources for the entire visible month, regardless of how the calendar widget on the dashboard is configured.

**Why this priority**: This is the core bug fix. Users currently see incomplete data in full screen mode, which defeats the purpose of expanding to a larger view.

**Independent Test**: Can be fully tested by opening the full screen calendar and verifying all events from all sources appear for the entire visible month range.

**Acceptance Scenarios**:

1. **Given** the dashboard calendar widget is filtered to show only 7 days ahead from 2 sources with a max of 5 events, **When** I open the full screen calendar, **Then** I see events from all connected calendar sources for the entire visible month
2. **Given** the full screen calendar is open and showing January, **When** I navigate to February, **Then** I see all events from all sources for the full month of February
3. **Given** I have 5 connected calendar sources, **When** I open the full screen calendar, **Then** events from all 5 sources are displayed without any maximum event limit

---

### User Story 2 - Seamless Transition from Widget to Full Screen (Priority: P2)

As a user, when I click to expand the calendar widget to full screen, the transition should feel seamless — the full screen view loads with complete data without noticeable delay or empty states.

**Why this priority**: A smooth user experience ensures users trust the full screen view shows accurate, complete information.

**Independent Test**: Can be tested by expanding the widget and observing that events load promptly without showing an empty calendar that then populates.

**Acceptance Scenarios**:

1. **Given** I am viewing the dashboard with the calendar widget, **When** I click to open the full screen calendar, **Then** events for the current month load and display within a reasonable time
2. **Given** the full screen calendar is loading events, **When** the data is being fetched, **Then** a loading indicator is shown (not an empty calendar)

---

### User Story 3 - Widget Remains Independently Filtered (Priority: P2)

As a user, the dashboard calendar widget should continue to show its filtered view (limited days ahead, selected sources, max events) while only the full screen view shows the complete picture.

**Why this priority**: The widget's filtered behavior is intentional for dashboard density — the fix must not break existing widget functionality.

**Independent Test**: Can be tested by verifying the dashboard widget still respects its daysAhead, sourceIds, and maxEvents configuration after the fix.

**Acceptance Scenarios**:

1. **Given** the calendar widget is configured with daysAhead=7 and maxEvents=5, **When** I view the dashboard, **Then** the widget still shows only events within 7 days with a maximum of 5 events
2. **Given** I open and close the full screen calendar, **When** I return to the dashboard, **Then** the widget still shows its filtered view unchanged

---

### Edge Cases

- What happens when the user has no connected calendar sources? The full screen calendar should show an appropriate empty state message.
- How does the full screen calendar handle months with no events? It should display the calendar grid with no event indicators.
- What happens when a calendar source temporarily fails to respond? Events from other sources should still display; failed sources should not block the entire view.
- What happens when the user navigates rapidly between months? Previous requests should be cancelled or superseded by the latest navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The full screen calendar MUST fetch events independently from the calendar widget, using its own data retrieval mechanism
- **FR-002**: The full screen calendar MUST request events for the entire visible month date range (first day to last day of the displayed month)
- **FR-003**: The full screen calendar MUST include all available/connected calendar sources when fetching events
- **FR-004**: The full screen calendar MUST NOT be constrained by the widget's daysAhead, sourceIds, or maxEvents filters
- **FR-005**: The calendar widget MUST continue to function with its existing filtering behavior (daysAhead, sourceIds, maxEvents) unchanged
- **FR-006**: The full screen calendar MUST update its displayed events when the user navigates to a different month
- **FR-007**: The full screen calendar MUST show a loading state while events are being fetched

### Key Entities

- **CalendarEvent**: A single event with a date/time, title, and source identifier — displayed on both widget and full screen views
- **CalendarSource**: A connected calendar provider (e.g., Google Calendar, Outlook) that supplies events
- **VisibleMonthRange**: The date range representing the first and last day of the currently displayed month in full screen view

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Full screen calendar displays events from 100% of connected calendar sources (not limited by widget source filter)
- **SC-002**: Full screen calendar shows events for the entire visible month (not limited by widget's daysAhead setting)
- **SC-003**: No maximum event count is applied in the full screen view (all events for the month are shown)
- **SC-004**: Dashboard calendar widget continues to respect its configured filters with no behavioral change
- **SC-005**: Full screen calendar loads and displays events within 2 seconds of opening or navigating to a new month

## Assumptions

- The existing backend API already supports fetching events for arbitrary date ranges and source IDs — no backend changes are required
- The `useCalendarEvents()` hook (or equivalent) already exists and can be called with custom date ranges and source lists
- All available calendar source IDs are accessible to the FullScreenCalendar component (passed from the parent or retrievable from app state)
- The CalendarWidget component currently passes pre-filtered `events` as props to FullScreenCalendar — this prop interface will change to pass `sourceIds` instead
- Performance is acceptable when fetching a full month of events from all sources (the API can handle this without pagination for typical home dashboard usage)
