# Feature Specification: Performance Optimizations & Pi-hole Widget Polish

**Feature Branch**: `040-perf-and-polish`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: GitHub issues #132, #87, #88, #86, #126 — bundled performance and UI polish work

## User Scenarios & Testing

### User Story 1 - Reduced Network Overhead from Polling (Priority: P1)

As a HomeDash user with multiple widgets on my dashboard, I want the application to poll external services at sensible intervals so that my network and those services are not overwhelmed with unnecessary requests, while still showing me reasonably current data.

**Why this priority**: Polling frequency directly impacts network load, API rate limits, and server-side resource usage for every user on every page load. This is the highest-impact performance improvement.

**Independent Test**: Can be tested by observing network requests in the browser and confirming polling intervals match expected values for Pi-hole, UniFi, and Spotify widgets.

**Acceptance Scenarios**:

1. **Given** the dashboard is open with Pi-hole widget visible, **When** 60 seconds elapse, **Then** the Pi-hole stats refresh automatically (not before 60s unless manually triggered)
2. **Given** the dashboard is open with UniFi widget visible, **When** 60 seconds elapse, **Then** the UniFi stats refresh automatically (not before 60s unless manually triggered)
3. **Given** a user has configured a custom polling interval for Pi-hole or UniFi, **When** the dashboard loads, **Then** the user's configured interval is respected instead of the new defaults
4. **Given** stale data is displayed after the stale window (30s), **When** the widget refetches, **Then** the old data remains visible until the fresh data arrives (no loading spinner flicker)

---

### User Story 2 - Spotify Widget Adaptive Polling (Priority: P1)

As a user with the Spotify widget on my dashboard, I want it to poll intelligently based on whether I'm actively viewing it and whether music is playing, so battery life and network are conserved when I'm not looking or music is paused.

**Why this priority**: The Spotify widget currently polls every 5 seconds unconditionally — by far the most aggressive poller. Adaptive behaviour dramatically reduces wasted requests.

**Independent Test**: Can be tested by toggling browser tab visibility and Spotify playback state, then observing network request frequency.

**Acceptance Scenarios**:

1. **Given** the Spotify widget is visible and playback state is "playing", **When** 5 seconds elapse, **Then** the widget refreshes
2. **Given** the Spotify widget is visible and playback state is "paused", **When** 30 seconds elapse, **Then** the widget refreshes (not before 30s)
3. **Given** the browser tab or dashboard page is not visible (hidden tab), **When** any amount of time elapses, **Then** no Spotify polling occurs
4. **Given** the user switches back to the tab (becomes visible again), **When** the widget regains visibility, **Then** polling resumes at the appropriate rate based on current playback state
5. **Given** the Spotify widget is scrolled out of view within the dashboard, **When** it is not in the viewport, **Then** polling is paused

---

### User Story 3 - Faster Initial Page Load via Code Splitting (Priority: P2)

As a user navigating to HomeDash, I want the initial page to load quickly by only downloading the code needed for the current route, so that I see my dashboard sooner rather than waiting for all page bundles.

**Why this priority**: A 1.79MB monolithic bundle impacts initial load time for all users. Code splitting is a one-time structural improvement that benefits every subsequent visit.

**Independent Test**: Can be tested by measuring initial bundle size in browser DevTools Network tab and verifying separate chunks load on navigation.

**Acceptance Scenarios**:

1. **Given** a user navigates to the dashboard URL, **When** the page loads, **Then** only the dashboard route chunk is downloaded (not settings, login, or first-run code)
2. **Given** a user is on the dashboard and clicks to navigate to Settings, **When** the settings page loads, **Then** the settings chunk is fetched on demand
3. **Given** a user navigates directly to a deep link (e.g., /settings), **When** the page loads, **Then** the correct route renders without errors
4. **Given** a route chunk is loading, **When** the user waits, **Then** a brief loading indicator is displayed (not a blank screen)
5. **Given** a route chunk fails to load (network error), **When** the error occurs, **Then** the user sees a helpful error message with a retry option

---

### User Story 4 - Pi-hole Widget at Small Grid Sizes (Priority: P2)

As a user who has configured a compact 180px grid layout, I want the Pi-hole widget to display cleanly at small sizes without overflow or clipping, so that I can fit more widgets on my dashboard without sacrificing readability.

**Why this priority**: Visual polish that directly impacts users who customise their grid density. Important for usability but does not affect data accuracy or system health.

**Independent Test**: Can be tested by resizing the grid to 180px cells and confirming the Pi-hole widget renders without overflow, with readable text and functional controls.

**Acceptance Scenarios**:

1. **Given** the grid cell size is 180px, **When** the Pi-hole widget renders, **Then** all content fits within the cell boundaries without overflow or horizontal scrolling
2. **Given** the grid cell size is 180px, **When** the Pi-hole widget renders, **Then** text and icons are legible (appropriately sized for the compact layout)
3. **Given** the grid cell size is 180px, **When** the user interacts with the controls panel, **Then** controls are tappable/clickable without overlapping
4. **Given** the grid cell size is larger (e.g., 300px+), **When** the Pi-hole widget renders, **Then** it displays at its normal full-size layout (no regression)

---

### Edge Cases

- What happens when a code-split chunk fails to load due to a deployment (stale chunk hash)? — The app should catch the error and offer a page reload.
- What happens when the Spotify widget transitions from "not visible" to "visible" while playback state has changed? — It should immediately fetch fresh data on becoming visible.
- What happens when Pi-hole or UniFi services are unreachable during a polling cycle? — Stale data should remain displayed with an error indicator; the next poll should retry normally.
- What happens when a user configures a polling interval shorter than the new defaults? — The user's configured value should take precedence.
- What happens when the Pi-hole widget has very long domain names in the blocked list at 180px? — Text should truncate with ellipsis rather than overflow.

## Requirements

### Functional Requirements

- **FR-001**: System MUST lazy-load route components (DashboardPage, SettingsPage, FirstRunPage, LoginPage) so they are fetched only when navigated to
- **FR-002**: System MUST display a loading indicator while a route chunk is being fetched
- **FR-003**: System MUST handle chunk load failures gracefully with a user-facing error and retry mechanism
- **FR-004**: System MUST NOT break existing navigation, deep links, or browser back/forward behaviour when code splitting is active
- **FR-005**: System MUST set the default polling interval for Pi-hole stats to 60 seconds
- **FR-006**: System MUST set the default polling interval for UniFi stats to 60 seconds
- **FR-007**: System MUST use a stale-while-revalidate strategy for Pi-hole and UniFi data (data considered stale after 30 seconds, refetched at 60 seconds)
- **FR-008**: System MUST respect user-configured polling intervals if they differ from the new defaults
- **FR-009**: Spotify widget MUST poll at 5-second intervals when visible and playback is active
- **FR-010**: Spotify widget MUST poll at 30-second intervals when visible and playback is paused
- **FR-011**: Spotify widget MUST stop polling entirely when not visible (tab hidden or widget out of viewport)
- **FR-012**: Spotify widget MUST resume polling at the appropriate rate when visibility is regained
- **FR-013**: Pi-hole widget MUST render without content overflow at 180px grid cell size
- **FR-014**: Pi-hole widget MUST use compact text, icons, and control layout at small grid sizes
- **FR-015**: Pi-hole widget MUST continue to render correctly at standard and large grid sizes (no regression)

### Key Entities

- **Route Chunk**: A lazily-loaded bundle segment corresponding to a single page/route in the application
- **Polling Configuration**: Per-widget settings that control refresh frequency, stale time, and revalidation behaviour
- **Widget Visibility State**: Whether a widget is currently in the user's viewport and whether the browser tab is active
- **Playback State**: The current state of Spotify playback (playing, paused, stopped) that determines polling frequency

## Success Criteria

### Measurable Outcomes

- **SC-001**: Initial page load transfers less than 500KB of route-specific code (excluding shared vendor chunks)
- **SC-002**: Users see their dashboard content within 2 seconds on a standard broadband connection
- **SC-003**: Pi-hole and UniFi widgets generate no more than 1 network request per 60 seconds under default configuration
- **SC-004**: Spotify widget generates no network requests when the browser tab is hidden for 5+ minutes
- **SC-005**: Spotify widget generates no more than 2 requests per minute when music is paused and visible
- **SC-006**: Pi-hole widget content is fully visible (no overflow or clipping) at 180px grid cell size
- **SC-007**: All existing navigation paths and deep links continue to function without errors after code splitting
- **SC-008**: Users with custom polling intervals experience no change in behaviour

## Assumptions

- The existing Vite manual chunk configuration (vendor, query, grid) will remain and coexist with route-level splitting
- TanStack Query's `staleTime` and `refetchInterval` options are sufficient to implement the stale-while-revalidate pattern without custom logic
- The Intersection Observer API is available in all supported browsers (modern evergreen browsers)
- The `document.visibilityState` API is available and reliable for detecting tab visibility
- "Not visible" for the Spotify widget means either the tab is hidden OR the widget is scrolled out of viewport — both conditions disable polling
- The Pi-hole widget's compact layout applies specifically at 180px cell size; breakpoint behaviour at intermediate sizes is left to implementation discretion
- Existing user-configured polling intervals are stored in widget settings and passed to the hooks; the implementation will continue to check for these overrides
- No server-side changes are required — all optimisations are frontend-only
