# Feature Specification: Pi-hole DNS Controls Widget

**Feature Branch**: `014-pihole-widget`  
**Created**: 2025-07-15  
**Status**: Draft  
**GitHub Issue**: #22  
**Input**: User description: "I have a Pi-Hole running. I want to be able to control it — enable/disable blocking with a timer selector (similar to what Pi-hole offers), and see stats like CPU, Load, Total Queries, Blocked Queries, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Pi-hole Statistics (Priority: P1)

A user wants to see their Pi-hole's key DNS statistics at a glance on their HomeDash dashboard. They add a "Pi-hole" widget, enter their Pi-hole's URL and API token, and immediately see a live summary: total queries, blocked queries, percentage blocked, and number of domains on the blocklist. The stats refresh automatically on a regular interval.

**Why this priority**: This is the core value proposition — a read-only stats view that delivers value from the moment the widget is configured. It validates the Pi-hole connection and gives the user confidence the integration works before they attempt any control actions.

**Independent Test**: Can be fully tested by configuring the widget with a valid Pi-hole URL and API token, then verifying all stat values match the Pi-hole admin dashboard. Delivers immediate monitoring value.

**Acceptance Scenarios**:

1. **Given** a dashboard with a Pi-hole widget configured with a valid URL and API token, **When** the dashboard loads, **Then** the widget displays total queries, blocked queries, percentage blocked, and domains on blocklist.
2. **Given** a configured Pi-hole widget, **When** the configured poll interval elapses, **Then** the widget refreshes all statistics without requiring a page reload.
3. **Given** a Pi-hole widget with an invalid API token, **When** the widget attempts to fetch stats, **Then** the widget displays an authentication error with guidance to check the token.
4. **Given** a Pi-hole widget configured for an unreachable host, **When** the widget attempts to fetch stats, **Then** the widget displays a connection error with the target URL and a retry mechanism.

---

### User Story 2 — Enable/Disable DNS Blocking (Priority: P2)

A user wants to temporarily disable Pi-hole's DNS blocking — for example, to access a site that is incorrectly blocked. They click a control on the widget, choose a duration (5 minutes, 15 minutes, 30 minutes, or indefinitely), and blocking is disabled for that period. When the timer expires (or the user manually re-enables), blocking resumes. The widget reflects the current blocking state at all times.

**Why this priority**: This is the primary "control" feature and the main reason users want Pi-hole on their dashboard. It depends on P1 (the connection must work for stats before control is useful).

**Independent Test**: Can be tested by disabling blocking for 5 minutes via the widget, verifying Pi-hole's admin UI shows blocking disabled, then waiting for the timer to expire and verifying blocking re-enables automatically.

**Acceptance Scenarios**:

1. **Given** a Pi-hole widget showing blocking as enabled, **When** the user clicks "Disable Blocking" and selects "5 minutes", **Then** the widget sends a disable request with a 300-second duration and the widget state updates to show blocking disabled with a countdown.
2. **Given** blocking is disabled with a timer, **When** the timer expires, **Then** the widget state updates to show blocking re-enabled (on next poll).
3. **Given** blocking is disabled (timed or indefinite), **When** the user clicks "Enable Blocking", **Then** blocking is re-enabled immediately and the widget state updates.
4. **Given** blocking is disabled indefinitely, **When** the widget displays the status, **Then** it shows "Blocking Disabled — Indefinitely" (no countdown).
5. **Given** the user attempts to disable blocking but the API call fails, **Then** the widget displays an error toast and the blocking state does not change.

---

### User Story 3 — View System Health Metrics (Priority: P3)

A user wants to monitor the health of the Pi-hole host itself — CPU usage, memory usage, system load, and temperature (if available). This helps identify if the Pi-hole server is under stress or needs attention.

**Why this priority**: System metrics are supplementary to DNS stats. They add operational value but are not essential for the core DNS monitoring/control use case. Some Pi-hole deployments (e.g., Docker) may not expose all system metrics.

**Independent Test**: Can be tested by configuring the widget and verifying CPU, memory, and load values appear and match the Pi-hole admin dashboard's system info section.

**Acceptance Scenarios**:

1. **Given** a configured Pi-hole widget, **When** the dashboard loads, **Then** the widget displays available system metrics (CPU usage, memory usage, load averages).
2. **Given** the Pi-hole host does not expose a particular system metric (e.g., temperature), **When** the widget renders, **Then** that metric is omitted gracefully without breaking the layout.
3. **Given** system metrics are available, **When** the poll interval elapses, **Then** system metrics refresh alongside DNS stats.

---

### Edge Cases

- What happens when the Pi-hole instance is upgraded or restarted while the widget is active? The widget should show a connection error and resume automatically when the Pi-hole comes back online.
- What happens when the API token is rotated on the Pi-hole side? The widget should show an authentication error and prompt the user to update the token in widget settings.
- What happens when blocking is disabled externally (via Pi-hole admin UI) while HomeDash shows it as enabled? The next poll cycle should pick up the current state and update the display.
- What happens when the user configures multiple Pi-hole widgets pointing to the same instance? Each widget operates independently — this is allowed and expected.
- What happens when the Pi-hole is running v5 (legacy API) instead of v6? The widget should display an error indicating that only Pi-hole v6+ is supported.
- What happens when the backend proxy cannot reach the Pi-hole but the user's browser could (e.g., DNS split-horizon)? The widget should display the backend's error; the user should ensure the HomeDash server can reach the Pi-hole.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add a Pi-hole widget to their dashboard via the existing widget system.
- **FR-002**: System MUST allow users to configure the Pi-hole connection: base URL (required) and API token (required).
- **FR-003**: System MUST store the Pi-hole API token encrypted at rest in the database, never in widget configJson.
- **FR-004**: System MUST proxy all Pi-hole API calls through the HomeDash backend (frontend never contacts Pi-hole directly).
- **FR-005**: System MUST display the following DNS stats: total queries, blocked queries, percentage blocked, domains on blocklist, unique clients.
- **FR-006**: System MUST display the current blocking status (enabled/disabled) with a clear visual indicator.
- **FR-007**: System MUST allow users to disable blocking with a duration selector offering: 5 minutes, 15 minutes, 30 minutes, and indefinitely.
- **FR-008**: System MUST allow users to re-enable blocking at any time, regardless of any active timer.
- **FR-009**: System MUST display a countdown when blocking is disabled with a timer.
- **FR-010**: System MUST auto-refresh stats and status at a configurable poll interval (default: 30 seconds, minimum: 10 seconds, maximum: 300 seconds).
- **FR-011**: System MUST display system health metrics when available: CPU usage, memory usage, system load.
- **FR-012**: System MUST validate the Pi-hole connection (URL reachable, token valid) when the user saves widget configuration, and display a success/failure result.
- **FR-013**: System MUST display clear error states when the Pi-hole is unreachable, the token is invalid, or the API returns unexpected responses.
- **FR-014**: System MUST support only Pi-hole v6+ (REST API at `/api/`). If a v5 instance is detected, display an informative unsupported-version message.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: The Pi-hole API token MUST be stored encrypted server-side and MUST NOT be sent to the frontend. All Pi-hole API calls MUST go through authenticated HomeDash backend routes.
- **NFR-002 (LAN-only)**: The Pi-hole widget MUST function entirely on the LAN. No internet access required. The backend proxies requests to the Pi-hole's LAN address.
- **NFR-003 (Privacy)**: No Pi-hole data (queries, domains, stats) MUST be sent to any external service. All data stays between HomeDash and the Pi-hole instance.
- **NFR-004 (UX)**: The widget MUST be usable on both mobile and desktop. Stats should be legible; blocking controls should have touch-friendly targets (≥44×44px).
- **NFR-005 (Operability)**: Failed Pi-hole API calls MUST be logged server-side with the endpoint, HTTP status, and error detail (but never the API token).
- **NFR-006 (Performance)**: Pi-hole API polling MUST NOT block other widget rendering. Failed polls MUST NOT cause cascading retries — use exponential backoff on repeated failures.
- **NFR-007 (Resilience)**: The widget MUST degrade gracefully when the Pi-hole is unreachable — show last-known values with a staleness indicator rather than a blank widget.

### Key Entities

- **Pi-hole Connection**: The per-widget-instance connection configuration. Attributes: Pi-hole base URL, encrypted API token, poll interval.
- **DNS Statistics**: The periodically-fetched summary data. Attributes: total queries, blocked queries, percentage blocked, domains on blocklist, unique clients, upstream servers.
- **Blocking State**: The current DNS blocking status. Attributes: enabled/disabled, disable duration (if applicable), time remaining.
- **System Health**: Optional host-level metrics. Attributes: CPU usage (%), memory usage (%), system load (1/5/15 min), temperature (if available).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure a Pi-hole widget (URL + token) and see live DNS stats within 60 seconds of saving.
- **SC-002**: Users can disable and re-enable DNS blocking via the widget and see the state change reflected within one poll cycle (≤30 seconds by default).
- **SC-003**: The widget correctly displays all 5 core DNS stats matching values shown in Pi-hole's own admin dashboard.
- **SC-004**: When the Pi-hole is unreachable, the widget displays a clear error state within one poll cycle and recovers automatically when connectivity is restored.
- **SC-005**: The Pi-hole API token is never exposed in frontend code, network requests visible to the browser, or application logs.
- **SC-006**: The widget is fully functional (view stats, control blocking) on both desktop and mobile viewports.
