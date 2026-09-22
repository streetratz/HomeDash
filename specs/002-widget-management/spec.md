# Feature Specification: Widget Management & Widget Types

**Feature Branch**: `002-widget-management`  
**Created**: 2025-07-17  
**Status**: Draft  
**Input**: User description: "Widget Management & Widget Types for HomeDash — Build the frontend UI for managing widgets inside dashboard placeholders, then expand the widget catalog with new widget types."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Widget Picker & Adding Widgets (Priority: P1)

An admin is in edit mode on a dashboard. They click a placeholder's settings to configure it and see an option to manage its widgets. They open a widget picker that shows all available widget types (Clock/Date, Iframe Embed, Markdown/Notes, Weather, System Status, Links List). They select "Clock/Date," which is added to the placeholder. They repeat the process to add a "Markdown/Notes" widget to the same placeholder. When they save the layout, both widgets persist and display in view mode.

**Why this priority**: Without the ability to add widgets, none of the new widget types are usable. This is the fundamental building block for the entire feature.

**Independent Test**: Can be fully tested by entering edit mode, opening a placeholder's widget management, adding a widget, saving, and confirming the widget renders in view mode.

**Acceptance Scenarios**:

1. **Given** an admin is in edit mode with at least one placeholder, **When** they access widget management for that placeholder, **Then** they see a widget picker showing all available widget types with name and brief description.
2. **Given** the widget picker is open, **When** the admin selects a widget type, **Then** a new widget instance of that type is added to the placeholder's widget list.
3. **Given** a placeholder has no widgets, **When** the admin adds a widget and saves, **Then** the widget is persisted and renders correctly in view mode.
4. **Given** a placeholder already has widgets, **When** the admin adds another widget, **Then** both widgets display stacked within the placeholder in order.

---

### User Story 2 — Widget Instance Configuration (Priority: P1)

After adding a widget, the admin wants to configure it. They click a settings action on a Clock widget instance and see a configuration form with timezone selection and 12/24hr toggle. They set it to "America/New_York" in 24hr format, save, and the clock renders with those settings. Each widget type has its own configuration form appropriate to its settings.

**Why this priority**: Adding widgets without configuring them provides minimal value. Configuration is required for widgets to be useful (e.g., which timezone, which URL, what markdown content).

**Independent Test**: Can be tested by adding a widget, opening its config form, changing a setting, saving, and verifying the widget renders with the updated config.

**Acceptance Scenarios**:

1. **Given** a widget instance exists in a placeholder (edit mode), **When** the admin clicks configure on that widget, **Then** a configuration form specific to that widget type appears.
2. **Given** the Clock widget config form is open, **When** the admin selects a timezone and format, **Then** the widget preview updates to reflect those settings.
3. **Given** the Iframe Embed config form is open, **When** the admin enters a URL and selects an aspect ratio, **Then** the config is stored and the iframe renders that URL when saved.
4. **Given** config changes have been made but not saved, **When** the admin cancels edit mode, **Then** all config changes are discarded.

---

### User Story 3 — Widget Reorder & Delete (Priority: P2)

An admin has a placeholder with three widgets. They want the Markdown widget on top and the Clock widget at the bottom. They drag to reorder the widgets within the placeholder's widget list. They also decide to remove the middle widget entirely. After saving, the remaining widgets display in the new order.

**Why this priority**: Reordering and deletion are core management actions needed once users have multiple widgets, but adding and configuring comes first.

**Independent Test**: Can be tested by having a placeholder with 2+ widgets, reordering them, deleting one, saving, and verifying the final order and count.

**Acceptance Scenarios**:

1. **Given** a placeholder has multiple widgets in edit mode, **When** the admin drags a widget to a new position in the list, **Then** the widget order updates visually.
2. **Given** a placeholder has a widget the admin wants to remove, **When** they click the delete action on that widget, **Then** the widget is removed from the list (with confirmation).
3. **Given** the admin has reordered and deleted widgets, **When** they save, **Then** the persisted order matches the final arrangement and deleted widgets are gone.

---

### User Story 4 — Clock/Date Widget (Priority: P2)

A homelab user adds a Clock/Date widget to their dashboard. It shows the current time and date for a chosen timezone. They configure it to 24hr format with their local timezone. On the dashboard, the clock updates in real time.

**Why this priority**: A clock is the most universally useful homelab dashboard widget — simple, no external dependencies, high daily-use value.

**Independent Test**: Can be tested by adding a Clock widget, configuring timezone and format, and verifying correct live time display.

**Acceptance Scenarios**:

1. **Given** a Clock widget is configured with a timezone, **When** viewing the dashboard, **Then** the current time in that timezone is displayed and updates live (at least every second for time, every minute for date).
2. **Given** a Clock widget is set to 12hr format, **When** viewing, **Then** time is shown with AM/PM indicator.
3. **Given** a Clock widget is set to 24hr format, **When** viewing, **Then** time is shown in 00:00–23:59 format.
4. **Given** no timezone is configured, **When** viewing, **Then** the widget defaults to the browser's local timezone.

---

### User Story 5 — Markdown/Notes Widget (Priority: P2)

A user adds a Markdown/Notes widget to display static information — a welcome message, server IP addresses, or homelab notes. They enter markdown text in the config form. The widget renders the markdown with proper formatting (headings, bold, lists, links, code blocks).

**Why this priority**: Markdown is extremely flexible for homelab use (notes, docs, reminders) and has zero external dependencies.

**Independent Test**: Can be tested by adding a Markdown widget, entering markdown content, and verifying rendered output.

**Acceptance Scenarios**:

1. **Given** a Markdown widget with content configured, **When** viewing the dashboard, **Then** the markdown is rendered with proper formatting.
2. **Given** markdown content includes links, **When** a user clicks a link, **Then** it opens in a new tab.
3. **Given** markdown content is longer than the widget's visible area, **When** viewing, **Then** the content is scrollable within the widget.
4. **Given** markdown content is empty, **When** viewing, **Then** the widget shows a helpful empty state message.

---

### User Story 6 — Iframe Embed Widget (Priority: P3)

A user wants to embed their Grafana dashboard, Pi-hole admin panel, or any web UI into their HomeDash. They add an Iframe Embed widget, enter the URL, and select an aspect ratio (16:9, 4:3, or custom height). The embedded page appears within the placeholder.

**Why this priority**: Iframes are a homelab power-user feature — very useful but carries security considerations and depends on the embedded app allowing framing.

**Independent Test**: Can be tested by adding an Iframe widget, entering a URL, and verifying the iframe renders at the correct aspect ratio.

**Acceptance Scenarios**:

1. **Given** an Iframe widget with a configured URL, **When** viewing the dashboard, **Then** the URL is loaded in a sandboxed iframe.
2. **Given** the iframe URL is unreachable, **When** viewing, **Then** the widget shows a clear error message instead of a blank frame.
3. **Given** an aspect ratio is configured, **When** the placeholder is resized, **Then** the iframe maintains the configured aspect ratio within the available space.
4. **Given** no URL is configured, **When** viewing, **Then** the widget shows a placeholder message prompting configuration.

---

### User Story 7 — System Status Widget (Priority: P3)

A homelab user wants to monitor whether their LAN services are up. They add a System Status widget and configure a list of services with name, URL, and expected HTTP status code. The widget periodically pings each service and shows a green/red status indicator.

**Why this priority**: Status monitoring is a core homelab need but is more complex (requires backend polling) and is a "nice to have" after the more universal widgets.

**Independent Test**: Can be tested by adding a System Status widget, configuring a reachable and an unreachable service, and verifying correct status indicators.

**Acceptance Scenarios**:

1. **Given** a System Status widget with configured services, **When** viewing the dashboard, **Then** each service shows its name and a status indicator (up/down/unknown).
2. **Given** a configured service is reachable and returns the expected status code, **When** the widget polls, **Then** the service shows as "up" (green).
3. **Given** a configured service is unreachable or returns an unexpected status, **When** the widget polls, **Then** the service shows as "down" (red).
4. **Given** the widget has just been added and hasn't polled yet, **When** viewing, **Then** services show an "unknown" (grey/neutral) state until the first check completes.
5. **Given** system status polling, **When** the check runs, **Then** the poll is performed by the backend (not the browser) to avoid CORS issues on the LAN.

---

### User Story 8 — Weather Widget (Priority: P3)

A user adds a Weather widget to see current conditions at a glance. They configure it with either a location (for free API lookup) or manual weather data entry for fully offline setups. The widget displays temperature, conditions, and an icon.

**Why this priority**: Weather is a popular dashboard widget but depends on external APIs for automatic data, which conflicts with the LAN-only principle. Manual entry mode provides an offline fallback.

**Independent Test**: Can be tested by adding a Weather widget, configuring a location (or manual data), and verifying the display.

**Acceptance Scenarios**:

1. **Given** a Weather widget configured with a location and API mode, **When** viewing the dashboard, **Then** current temperature and conditions are displayed.
2. **Given** a Weather widget in manual mode, **When** the admin enters temperature and conditions text, **Then** those values display statically.
3. **Given** the weather API is unreachable (LAN-only setup), **When** the widget tries to fetch, **Then** it shows the last known data with a stale indicator, or a friendly "no data" message.
4. **Given** no configuration, **When** viewing, **Then** the widget shows a prompt to configure location or manual data.

---

### Edge Cases

- What happens when a user adds more widgets than can visually fit in a placeholder? — Widgets stack vertically and the placeholder content becomes scrollable.
- What happens when a widget type is removed from the system but instances still exist in the database? — The existing "Unknown widget type" fallback in WidgetRenderer handles this gracefully.
- What happens when an admin deletes all widgets from a placeholder? — The placeholder returns to its "Empty" state.
- What happens when the widget picker is opened on a very small (mobile) screen? — The picker dialog is responsive and scrollable.
- What happens when an Iframe embed URL changes after initial config? — The admin reconfigures the widget; the iframe reloads with the new URL on next view.
- What happens when System Status checks a service that takes a long time to respond? — Checks have a reasonable timeout (default 10 seconds); timeout counts as "down."
- What happens when a Clock widget is configured with an invalid timezone string? — The widget falls back to browser local time and shows a warning.
- What happens when markdown content contains raw HTML or script tags? — HTML is sanitized; script tags are stripped to prevent XSS.

## Requirements *(mandatory)*

### Functional Requirements

**Widget Management UI**

- **FR-001**: System MUST provide a widget picker dialog that lists all available widget types with name, icon, and brief description.
- **FR-002**: System MUST allow admins to add widget instances to a placeholder from the widget picker during edit mode.
- **FR-003**: System MUST allow admins to remove individual widget instances from a placeholder during edit mode, with a confirmation step.
- **FR-004**: System MUST allow admins to reorder widget instances within a placeholder via drag-and-drop or up/down controls during edit mode.
- **FR-005**: Each widget type MUST have a type-specific configuration form accessible from the widget instance in edit mode.
- **FR-006**: Widget management changes (add, remove, reorder, configure) MUST follow the existing edit mode pattern — local until Save, discarded on Cancel.
- **FR-007**: The widget picker MUST be accessible from the existing placeholder edit flow (PlaceholderConfigDialog or a dedicated "Manage Widgets" action on each placeholder).
- **FR-008**: Widget configuration changes MUST be persisted via the existing batch save endpoint (PUT /api/admin/dashboards/:id/placeholders/:pid/widgets).

**Clock/Date Widget**

- **FR-009**: System MUST support a "clock" widget type that displays the current time and date.
- **FR-010**: Clock widget MUST allow configuration of timezone (IANA timezone string) with a searchable picker.
- **FR-011**: Clock widget MUST allow configuration of 12-hour or 24-hour time format.
- **FR-012**: Clock widget MUST update the displayed time in real time (at least every second).
- **FR-013**: Clock widget MUST default to the user's browser timezone when no timezone is configured.

**Iframe Embed Widget**

- **FR-014**: System MUST support an "iframe" widget type that embeds a URL in a sandboxed iframe.
- **FR-015**: Iframe widget MUST allow configuration of the target URL.
- **FR-016**: Iframe widget MUST allow selection of aspect ratio (16:9, 4:3, 1:1, or auto-fill).
- **FR-017**: Iframe widget MUST render with sandbox restrictions that prevent the embedded page from navigating the parent or accessing parent DOM.
- **FR-018**: Iframe widget MUST show a meaningful fallback when the URL is empty or unreachable.

**Markdown/Notes Widget**

- **FR-019**: System MUST support a "markdown" widget type that renders static markdown content.
- **FR-020**: Markdown widget MUST allow multi-line text input in the configuration form.
- **FR-021**: Markdown widget MUST render standard markdown (headings, bold, italic, lists, links, code blocks, inline code).
- **FR-022**: Markdown widget MUST sanitize rendered HTML to prevent XSS (no raw script/style execution).
- **FR-023**: Markdown widget content area MUST be scrollable if content exceeds the visible area.

**Weather Widget**

- **FR-024**: System MUST support a "weather" widget type that displays current weather conditions.
- **FR-025**: Weather widget MUST support an "API mode" that fetches weather from a free public weather service given a location.
- **FR-026**: Weather widget MUST support a "manual mode" where the admin enters temperature, conditions text, and icon/emoji manually.
- **FR-027**: Weather widget in API mode MUST gracefully handle network failures by showing last-known data with a stale indicator or a "no data" message.
- **FR-028**: Weather widget MUST display at minimum: temperature, conditions description, and a visual indicator (icon or emoji).

**System Status Widget**

- **FR-029**: System MUST support a "system_status" widget type that monitors the reachability of configured services.
- **FR-030**: System Status widget MUST allow configuration of one or more services, each with a name, URL, and expected HTTP status code.
- **FR-031**: System Status widget MUST show each service with a name and status indicator: up (green), down (red), or unknown (neutral).
- **FR-032**: Status checks MUST be performed by the backend to avoid browser CORS restrictions on LAN services.
- **FR-033**: Status checks MUST have a configurable poll interval (default: 60 seconds, minimum: 15 seconds).
- **FR-034**: Status checks MUST timeout after a configurable duration (default: 10 seconds) and treat timeout as "down."

**Widget Type Registry**

- **FR-035**: System MUST maintain a registry of available widget types so that adding new types in the future requires minimal changes (one registration point per new type).
- **FR-036**: The WidgetRenderer component MUST resolve the correct display component for each registered widget type.
- **FR-037**: The widget picker MUST automatically include all registered widget types without manual picker updates.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: Widget management actions MUST require admin authentication, consistent with existing edit mode authorization.
- **NFR-002 (LAN-only)**: Clock, Markdown, Iframe, and System Status widgets MUST function fully without internet access. Weather widget in API mode is the only exception, and it MUST degrade gracefully when offline.
- **NFR-003 (Privacy)**: No widget MUST send data to external services unless explicitly configured by the admin (e.g., Weather API location).
- **NFR-004 (UX)**: Widget picker and configuration dialogs MUST be usable on both mobile and desktop screens.
- **NFR-005 (Operability)**: Widget errors (bad config, failed status checks, render failures) MUST be logged with sufficient context to diagnose issues.
- **NFR-006 (Performance)**: Real-time widgets (Clock, System Status) MUST not cause excessive re-renders or degrade dashboard scrolling performance.
- **NFR-007 (Sanitization)**: All user-provided content rendered as HTML (markdown, widget titles) MUST be sanitized to prevent XSS.

### Key Entities

- **Widget Type**: A category of widget (e.g., "clock", "iframe", "markdown", "weather", "system_status", "links_list"). Defined in a type registry with a display name, icon, description, default config, config form component, and display component.
- **Widget Instance**: A specific configured widget placed in a placeholder. Has an ID, belongs to a placeholder, has a type, an order index, and a JSON config blob whose shape depends on the widget type. Stored in the existing `app_widget_instances` table.
- **Status Check Result**: The outcome of a system status ping for a single service — service name, status (up/down/unknown), response time, last checked timestamp. Ephemeral (not persisted in the main database); held in backend memory or a lightweight cache.
- **Weather Data Cache**: Cached weather response for a configured location — temperature, conditions, icon, last fetched timestamp. Stored in backend memory or the database to survive restarts.

## Assumptions

- The existing batch save endpoint (PUT widgets) is sufficient for persisting all new widget types via their `configJson` field — no new tables needed for Clock, Iframe, Markdown, or Weather config. System Status service lists are also stored in `configJson`.
- System Status checks are backend-side HTTP requests to avoid browser CORS issues. A lightweight polling mechanism (e.g., a simple interval or on-demand endpoint) is assumed rather than a full background job system.
- Weather API mode will use a free, no-auth-required service (like Open-Meteo) that accepts latitude/longitude. The admin provides coordinates or a location string.
- The widget type registry is a frontend-only construct (a map of type string → components). Backend doesn't need to know about widget types beyond storing the type string and config JSON.
- Drag-and-drop reorder within a single placeholder's widget list is sufficient; dragging widgets between placeholders is explicitly out of scope.
- The existing "Unknown widget type" fallback in WidgetRenderer continues to handle any type string not in the registry.

## Out of Scope

- Widget marketplace or community-contributed widget types
- Drag-and-drop of widgets between different placeholders
- Widget-level permissions (all widgets are visible to all viewers of a dashboard)
- Widget data export/import
- Widget templates or preset configurations
- Custom widget development by end users

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add, configure, reorder, and delete widgets in a placeholder within 2 minutes for a typical 3-widget setup.
- **SC-002**: All five new widget types (Clock, Iframe, Markdown, Weather, System Status) render correctly in view mode after being configured.
- **SC-003**: Clock widget displays the correct time for any configured IANA timezone, verified against a reference time source.
- **SC-004**: System Status widget correctly reports "up" for reachable services and "down" for unreachable services within one poll interval.
- **SC-005**: Markdown widget renders all standard markdown elements (headings, lists, bold, italic, links, code) without XSS vulnerabilities.
- **SC-006**: Widget management UI is fully functional on mobile viewports (≥ 320px width) — all dialogs are scrollable and tappable.
- **SC-007**: Dashboard with 10+ widgets across multiple placeholders loads and renders within 2 seconds on a typical homelab network.
- **SC-008**: Adding a new widget type to the registry requires changes to at most 3 files (registration, display component, config form).
