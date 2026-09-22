# Feature Specification: App Shortcuts Widget

**Feature Branch**: `013-app-shortcuts`  
**Created**: 2025-07-14  
**Status**: Draft  
**GitHub Issue**: #18  
**Input**: User description: "A dedicated App Shortcuts widget that displays application icons with names, links, and optional health/status indicators. Each shortcut has: name, URL, icon (upload or fetch favicon), optional status ping. Grid layout with configurable columns. Visual status indicator (green/red dot) if ping is enabled. Click opens the app URL in a new tab. Support for grouping/categorising apps (e.g., Media, Infrastructure, Tools)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add and Launch App Shortcuts (Priority: P1)

A user wants quick access to the web applications they use daily (e.g., Plex, Portainer, Home Assistant). They add an "App Shortcuts" widget to their dashboard, create shortcuts by entering each app's name and URL, and optionally provide a custom icon. The shortcuts appear in a grid layout. Clicking any shortcut opens the target application in a new browser tab.

**Why this priority**: This is the core value proposition — a centralised launchpad for all homelab and self-hosted applications. Without this, the widget has no purpose.

**Independent Test**: Can be fully tested by adding 3–5 app shortcuts and verifying each opens the correct URL in a new tab. Delivers immediate value as a personalised app launcher.

**Acceptance Scenarios**:

1. **Given** a dashboard with an App Shortcuts widget, **When** the user opens the widget configuration and adds a shortcut with name "Plex" and URL "http://plex.local:32400", **Then** the shortcut appears in the widget grid with the name "Plex" displayed.
2. **Given** a widget with existing shortcuts, **When** the user clicks on a shortcut, **Then** the target URL opens in a new browser tab.
3. **Given** the widget configuration form, **When** the user submits a shortcut without a name or URL, **Then** the system displays a validation error and does not save the shortcut.
4. **Given** a widget with existing shortcuts, **When** the user edits a shortcut's name or URL, **Then** the updated information is saved and reflected immediately in the widget.
5. **Given** a widget with existing shortcuts, **When** the user deletes a shortcut, **Then** the shortcut is removed from the grid and the layout adjusts accordingly.

---

### User Story 2 - Icon Display and Favicon Fetching (Priority: P2)

A user wants each shortcut to display a recognisable icon so they can visually identify apps at a glance. When adding a shortcut, the system automatically attempts to fetch the favicon from the target URL. If the fetch fails or the user prefers a different icon, they can upload a custom image.

**Why this priority**: Icons are essential for quick visual recognition in a grid layout. Without them the widget is just a list of text links — functional but far less usable.

**Independent Test**: Can be tested by adding a shortcut to a known URL (e.g., a local service with a favicon) and verifying the icon appears. Then test uploading a custom icon and verifying it replaces the fetched one.

**Acceptance Scenarios**:

1. **Given** the user adds a shortcut with a valid URL, **When** the shortcut is saved, **Then** the system attempts to fetch the favicon from that URL and displays it as the shortcut icon.
2. **Given** the favicon fetch fails (e.g., the target app has no favicon or is unreachable), **When** the shortcut is saved, **Then** the system displays a default placeholder icon and the shortcut is still usable.
3. **Given** a shortcut with an auto-fetched icon, **When** the user uploads a custom icon image, **Then** the custom icon replaces the fetched favicon.
4. **Given** the icon upload form, **When** the user uploads a file that is not a supported image format, **Then** the system rejects the upload with an appropriate error message.

---

### User Story 3 - Configurable Grid Layout (Priority: P2)

A user wants to control how many columns the shortcut grid uses so the widget fits well alongside other widgets on their dashboard, whether on a wide desktop monitor or a narrower tablet screen.

**Why this priority**: Layout flexibility directly affects how the widget integrates into different dashboard configurations. It shares P2 because it is tightly coupled with visual usability.

**Independent Test**: Can be tested by changing the column count in widget settings and verifying the grid re-renders with the correct number of columns.

**Acceptance Scenarios**:

1. **Given** a widget with shortcuts, **When** the user changes the column count in the widget configuration (e.g., from 4 to 3), **Then** the grid re-renders to display shortcuts in 3 columns.
2. **Given** a widget configured for 5 columns, **When** the widget is viewed on a small screen, **Then** the grid adapts responsively, reducing columns to fit the available space without horizontal scrolling.
3. **Given** the widget configuration, **When** the user sets columns to a value outside the allowed range (e.g., 0 or 20), **Then** the system enforces a valid range and informs the user.

---

### User Story 4 - App Grouping and Categories (Priority: P3)

A user has many shortcuts and wants to organise them into logical groups such as "Media", "Infrastructure", and "Tools". Groups provide visual separation within the widget so the user can find apps faster.

**Why this priority**: Grouping becomes important as the number of shortcuts grows. It is not needed for initial use with a small number of apps, but adds significant value for power users with 10+ shortcuts.

**Independent Test**: Can be tested by creating two groups, assigning shortcuts to each, and verifying they render under separate group headings within the widget.

**Acceptance Scenarios**:

1. **Given** the widget configuration, **When** the user creates a new group named "Media", **Then** the group appears as a section header in the widget.
2. **Given** existing groups, **When** the user assigns a shortcut to the "Media" group, **Then** the shortcut appears under the "Media" section header.
3. **Given** a shortcut that is not assigned to any group, **Then** it appears in a default "Ungrouped" section at the end of the widget.
4. **Given** existing groups, **When** the user renames or deletes a group, **Then** the change is reflected in the widget and any shortcuts in a deleted group move to the default section.
5. **Given** the widget configuration, **When** the user reorders groups, **Then** the groups render in the new order.

---

### User Story 5 - Optional Health/Status Ping (Priority: P3)

A user wants to see at a glance which of their self-hosted apps are currently reachable. For any shortcut, the user can optionally enable a status ping. When enabled, the system periodically checks if the app URL is reachable and displays a visual indicator (green dot for reachable, red dot for unreachable).

**Why this priority**: Status monitoring is a "nice to have" enhancement. The widget is fully functional without it, but it adds significant value for homelab users who want basic uptime awareness.

**Independent Test**: Can be tested by enabling ping on a shortcut pointing to a running local service (expect green dot) and a shortcut pointing to a non-existent address (expect red dot).

**Acceptance Scenarios**:

1. **Given** a shortcut with ping enabled, **When** the target URL responds successfully, **Then** a green status indicator is displayed on the shortcut.
2. **Given** a shortcut with ping enabled, **When** the target URL is unreachable or returns an error, **Then** a red status indicator is displayed on the shortcut.
3. **Given** a shortcut with ping disabled (the default), **Then** no status indicator is shown.
4. **Given** a shortcut with ping enabled, **When** the status changes from reachable to unreachable (or vice versa), **Then** the indicator updates on the next check cycle without requiring a page refresh.
5. **Given** multiple shortcuts with ping enabled, **When** the system performs status checks, **Then** the checks run in the background without blocking the dashboard UI or degrading its responsiveness.

---

### Edge Cases

- What happens when a user adds a very large number of shortcuts (e.g., 50+)? The widget should remain scrollable and performant.
- How does the system handle a shortcut URL that includes authentication (e.g., basic auth in the URL)? The URL should be stored as-is; the system does not parse or validate URL credentials.
- What happens when favicon fetch times out? The system should fall back to the placeholder icon after a reasonable timeout (e.g., 5 seconds) and not block the save operation.
- What happens when two shortcuts have the same name? The system should allow duplicates — names are display labels, not unique identifiers.
- How does the status ping handle apps behind reverse proxies that return 200 for all paths? A successful HTTP response (any 2xx/3xx) is treated as "reachable".
- What happens when the user reorders shortcuts within a group? The custom order should be persisted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add an App Shortcuts widget to their dashboard via the existing widget system.
- **FR-002**: System MUST allow users to create shortcuts with a name (required) and URL (required).
- **FR-003**: System MUST allow users to edit the name, URL, icon, group, and ping setting of any existing shortcut.
- **FR-004**: System MUST allow users to delete individual shortcuts from the widget.
- **FR-005**: System MUST open the shortcut's target URL in a new browser tab when the user clicks a shortcut.
- **FR-006**: System MUST attempt to automatically fetch the favicon from the shortcut's target URL when a shortcut is created or its URL is updated.
- **FR-007**: System MUST allow users to upload a custom icon image for any shortcut, overriding the fetched favicon.
- **FR-008**: System MUST display a default placeholder icon when no favicon is available and no custom icon has been uploaded.
- **FR-009**: System MUST allow users to configure the number of grid columns for the widget (minimum 2, maximum 8, default 4).
- **FR-010**: System MUST render the shortcut grid responsively, reducing columns on smaller viewports to prevent horizontal overflow.
- **FR-011**: System MUST allow users to create, rename, reorder, and delete shortcut groups.
- **FR-012**: System MUST allow users to assign shortcuts to groups and display them under the corresponding group header.
- **FR-013**: System MUST display ungrouped shortcuts in a default section.
- **FR-014**: System MUST allow users to optionally enable a status ping for any shortcut.
- **FR-015**: When ping is enabled, the system MUST periodically check the reachability of the shortcut URL and display a green (reachable) or red (unreachable) visual indicator.
- **FR-016**: System MUST treat any HTTP 2xx or 3xx response as "reachable" for status ping purposes.
- **FR-017**: System MUST allow users to reorder shortcuts within a group via drag-and-drop or explicit ordering.
- **FR-018**: System MUST persist all shortcut data (name, URL, icon, group, order, ping setting) as part of the widget instance configuration.
- **FR-019**: System MUST validate that uploaded icon images are of a supported format (PNG, JPEG, SVG, ICO, WebP) and do not exceed 512 KB in size.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: Feature MUST not reduce authentication/authorization guarantees. Status pings MUST be performed server-side to avoid CORS issues and to prevent leaking internal URLs to the browser.
- **NFR-002 (LAN-only)**: Core shortcut functionality (add, display, launch) MUST work without internet access. Favicon fetching from LAN URLs MUST work. Favicon fetching from external URLs is a best-effort feature.
- **NFR-003 (Privacy)**: Feature MUST not send shortcut URLs, icons, or status data to any external service. All data remains on the local instance.
- **NFR-004 (UX)**: The widget MUST render correctly on screens from 320px to 2560px wide. Touch targets for shortcuts MUST be at least 44×44px.
- **NFR-005 (Operability)**: Failed favicon fetches and failed status pings MUST be logged with the target URL and error reason for diagnostic purposes.
- **NFR-006 (Performance)**: Status pings MUST run in the background and MUST NOT block widget rendering. Ping checks for a single widget instance MUST complete within 30 seconds regardless of how many shortcuts have ping enabled.

### Key Entities

- **App Shortcut**: Represents a single bookmarked application. Attributes: name, URL, icon (stored image or reference to fetched favicon), display order, ping enabled flag, current ping status.
- **Shortcut Group**: A named category for organising shortcuts within a widget. Attributes: name, display order. A group contains zero or more App Shortcuts. A shortcut belongs to at most one group.
- **Widget Configuration**: The per-instance settings for the App Shortcuts widget. Attributes: column count, list of groups (with ordering), list of shortcuts (with group assignments and ordering).

## Assumptions

- The existing widget system supports registering new widget types and storing arbitrary configuration per widget instance — no changes to the widget framework are needed.
- Favicon fetching is performed server-side by requesting the target URL and extracting the favicon link (e.g., from `<link rel="icon">` or the `/favicon.ico` convention).
- Uploaded icon images are stored locally on the server (not in an external object store).
- The status ping interval defaults to 60 seconds and is not user-configurable in the initial release. This is a sensible default for homelab monitoring without generating excessive network traffic.
- The status ping performs a simple HTTP HEAD or GET request — it does not perform deep health checks or parse response bodies.
- Drag-and-drop reordering uses standard web interactions and does not require additional accessibility accommodations beyond keyboard support.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a new app shortcut (name, URL, icon) and launch it in under 30 seconds.
- **SC-002**: The widget grid renders all shortcuts within 1 second of the dashboard loading, for up to 50 shortcuts.
- **SC-003**: Favicon auto-fetch succeeds for at least 80% of shortcuts pointing to common self-hosted applications on the LAN.
- **SC-004**: Status indicators update within 90 seconds of an app becoming reachable or unreachable.
- **SC-005**: Users can reorganise shortcuts (reorder, group, regroup) without any data loss or requiring a page reload.
- **SC-006**: The widget is fully functional (add, edit, delete, launch shortcuts) on both desktop and mobile viewports.
