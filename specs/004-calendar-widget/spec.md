# Feature Specification: Calendar / Agenda Widget

**Feature Branch**: `004-calendar-widget`
**Created**: 2026-04-24
**Status**: Draft
**Input**: GitHub Issue #10

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Connects a Microsoft Live/Outlook Calendar via OAuth (Priority: P1)

An admin wants to see their Microsoft 365 / Outlook.com calendar events on the HomeDash dashboard. They navigate to a new "Connected Accounts" section in the admin settings panel and click "Connect Microsoft Account." The system redirects them to Microsoft's OAuth2 consent screen. After granting calendar read permissions, they are redirected back to HomeDash. The system stores the OAuth tokens securely and the Microsoft account appears in the connected accounts list with the user's email and display name. The admin can later disconnect the account.

**Why this priority**: Microsoft calendar is the most-requested provider. OAuth infrastructure built here is reused for Google (US2), making this the foundational story.

**Independent Test**: Can be tested by clicking "Connect Microsoft Account," completing the OAuth flow (mocked in tests), verifying the account appears in the connected list, and verifying tokens are encrypted in the database.

**Acceptance Scenarios**:

1. **Given** an admin is on the Connected Accounts settings page, **When** they click "Connect Microsoft Account," **Then** the browser redirects to `login.microsoftonline.com` with correct `client_id`, `redirect_uri`, `scope=Calendars.Read offline_access`, and `state` parameter.
2. **Given** the admin has authorized the app on Microsoft's consent screen, **When** Microsoft redirects back to `/api/auth/oauth/microsoft/callback` with an authorization code, **Then** the backend exchanges the code for access + refresh tokens, stores them encrypted in `oauth_accounts`, and redirects the admin back to the settings page.
3. **Given** the OAuth callback succeeds, **When** the admin views the Connected Accounts list, **Then** the Microsoft account is listed with the user's email and display name.
4. **Given** a Microsoft account is connected, **When** the admin clicks "Disconnect," **Then** the account and its tokens are deleted from `oauth_accounts`, associated `calendar_sources` are disabled, and cached `calendar_events` for those sources are purged.
5. **Given** the OAuth callback receives an invalid `state` parameter, **When** processing the callback, **Then** the system rejects the request with a 403 error and does not store any tokens.

---

### User Story 2 — Admin Connects a Google Calendar via OAuth (Priority: P1)

An admin wants to add their Google Calendar as a source. They click "Connect Google Account" in the Connected Accounts settings. The system redirects to Google's OAuth2 consent screen. After granting calendar read-only access, Google redirects back to HomeDash. The tokens are stored encrypted, and the Google account appears alongside any existing Microsoft accounts.

**Why this priority**: Google Calendar is the second most popular calendar provider. The OAuth infrastructure from US1 is shared, so this story has low incremental cost.

**Independent Test**: Can be tested by clicking "Connect Google Account," completing the Google OAuth flow (mocked), verifying the account appears with correct email, and verifying tokens are encrypted.

**Acceptance Scenarios**:

1. **Given** an admin is on the Connected Accounts page, **When** they click "Connect Google Account," **Then** the browser redirects to `accounts.google.com` with `client_id`, `redirect_uri`, `scope=https://www.googleapis.com/auth/calendar.readonly`, `access_type=offline`, and `state` parameter.
2. **Given** the admin authorizes on Google, **When** Google redirects to `/api/auth/oauth/google/callback` with an authorization code, **Then** the backend exchanges the code, stores encrypted tokens in `oauth_accounts`, and redirects to settings.
3. **Given** a Google account is connected, **When** the admin views Connected Accounts, **Then** the Google account shows the user's Google email and display name.
4. **Given** the admin reconnects the same Google account (same `providerAccountId`), **When** the callback processes, **Then** the existing record is updated with new tokens rather than creating a duplicate.

---

### User Story 3 — Admin Adds a Calendar Widget to a Dashboard (Priority: P1)

An admin has connected at least one calendar source (Microsoft, Google, or iCal URL). They enter dashboard edit mode, open the widget picker, and select "Calendar." A configuration form lets them choose which calendar sources to display, the view mode (agenda list or mini calendar), how many days ahead to show, and the maximum number of events. After saving, the calendar widget appears on the dashboard showing upcoming events from the selected sources, color-coded by source, with event titles, times (timezone-aware), and locations.

**Why this priority**: This is the core user-facing feature — without the widget, connected accounts have no visible value.

**Independent Test**: Can be tested by adding a calendar widget to a dashboard, selecting sources, saving, and verifying events render correctly with title, time, location, and color coding.

**Acceptance Scenarios**:

1. **Given** the admin opens the widget picker in edit mode, **When** they select "Calendar," **Then** the CalendarConfigForm opens with source selection, view mode toggle, days ahead slider, and max events input.
2. **Given** the config form is open and sources are available, **When** the admin selects one or more sources and saves, **Then** the widget renders an agenda view of events sorted chronologically from all selected sources.
3. **Given** the widget is in agenda view, **When** events from multiple sources exist, **Then** each event is color-coded by its calendar source color.
4. **Given** events are displayed, **When** an event has a location, **Then** the location is shown below the event title and time.
5. **Given** the widget is configured, **When** the admin toggles to "Mini Calendar" view, **Then** a month grid is shown with colored dots on days that have events, and clicking a day expands to show that day's events.
6. **Given** the widget is on a dashboard, **When** the backend syncs new events from the provider, **Then** the widget updates to show the new events on the next frontend poll/refetch.

---

### User Story 4 — Admin Configures an iCal/CalDAV URL as a Read-Only Calendar Source (Priority: P2)

An admin has a calendar that doesn't require OAuth — for example, a public holiday calendar, a Nextcloud CalDAV URL, or a shared .ics feed. In the Connected Accounts or Calendar Widget config, they click "Add iCal URL," enter the URL and a display name, and optionally choose a color. The backend periodically fetches and parses the .ics file, caching events in the local database. The calendar appears as a selectable source in the calendar widget config.

**Why this priority**: iCal support is lower priority than the two main OAuth providers but broadens compatibility significantly with zero OAuth overhead.

**Independent Test**: Can be tested by adding a valid .ics URL, verifying the backend fetches and parses events, and verifying events appear in the calendar widget.

**Acceptance Scenarios**:

1. **Given** an admin is configuring calendar sources, **When** they click "Add iCal URL," **Then** a form appears with fields for URL (required), display name (required), and color (optional, with a default).
2. **Given** a valid .ics URL is entered, **When** the admin saves, **Then** the backend fetches the URL, parses VEVENT components, and stores events in `calendar_events`.
3. **Given** an iCal source is configured, **When** the sync interval elapses, **Then** the backend re-fetches the .ics file and updates cached events (adding new, updating changed, removing deleted).
4. **Given** the .ics URL is unreachable, **When** a sync attempt fails, **Then** the system logs the error, updates `lastSyncError` on the source, and continues displaying previously cached events.
5. **Given** an iCal source is listed, **When** the admin clicks "Remove," **Then** the source and its cached events are deleted.

---

### Edge Cases

1. **OAuth token expiry during sync**: When the access token expires mid-sync, the system uses the stored refresh token to obtain a new access token transparently. If the refresh token is also expired/revoked, the source is marked with an error status and the admin is prompted to reconnect.
2. **Calendar with thousands of events**: The sync service only fetches events within a configurable window (default: 30 days past to 90 days future). Older events are pruned from the cache.
3. **Recurring events**: RRULE-based recurring events are expanded into individual occurrences within the sync window before caching. Exceptions (EXDATE) are honored.
4. **All-day events spanning multiple days**: Multi-day events appear on each day in the agenda view and span multiple cells in the mini calendar month view.
5. **Timezone handling**: Events are stored in UTC internally. The widget renders times in the user's configured timezone (from the existing clock widget timezone infrastructure) or the event's original timezone.
6. **Duplicate events across sources**: If the same event appears in both a Microsoft calendar and an iCal feed, both are displayed — no deduplication is attempted (dedup is out of scope).
7. **iCal URL returns non-calendar content**: The parser validates that the response contains a valid VCALENDAR object. Invalid content is rejected and `lastSyncError` is set.
8. **OAuth provider rate limiting**: The sync service respects `Retry-After` headers and implements exponential backoff. Multiple sources for the same provider are batched to minimize API calls.

## Requirements *(mandatory)*

### Functional Requirements

**OAuth2 Infrastructure**

- **FR-001**: System MUST support OAuth2 Authorization Code flow with PKCE for Microsoft and Google calendar providers.
- **FR-002**: System MUST store OAuth credentials (access tokens, refresh tokens) encrypted at rest using AES-256-GCM with the existing `SESSION_SECRET` as the encryption key.
- **FR-003**: System MUST provide new environment variables: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — all optional (features degrade gracefully when not configured).
- **FR-004**: System MUST provide OAuth initiation routes: `GET /api/auth/oauth/microsoft` and `GET /api/auth/oauth/google` that redirect authenticated admins to the provider's authorization endpoint with correct scopes, state parameter, and PKCE challenge.
- **FR-005**: System MUST provide OAuth callback routes: `GET /api/auth/oauth/microsoft/callback` and `GET /api/auth/oauth/google/callback` that exchange the authorization code for tokens, validate the state parameter against the session, store the account in `oauth_accounts`, and redirect to the frontend settings page.
- **FR-006**: System MUST implement a token refresh service that automatically refreshes expired access tokens using the stored refresh token before making provider API calls. If refresh fails, the account status is set to `error` and `lastError` is populated.
- **FR-007**: System MUST prevent duplicate OAuth accounts — if a user reconnects the same provider account (same `providerAccountId`), the existing record is updated rather than creating a new one.

**Microsoft Graph Calendar API Integration**

- **FR-008**: System MUST integrate with the Microsoft Graph API `/me/calendarView` endpoint to fetch calendar events within a configurable date range.
- **FR-009**: Microsoft sync service MUST handle paginated responses (using `@odata.nextLink`) and map Graph event objects to the internal `CalendarEvent` schema.
- **FR-010**: Microsoft sync service MUST extract: event subject (title), start/end datetime with timezone, location display name, isAllDay flag, recurrence pattern, and calendar name.

**Google Calendar API Integration**

- **FR-011**: System MUST integrate with the Google Calendar API `/calendars/primary/events` endpoint to fetch events within a configurable date range.
- **FR-012**: Google sync service MUST handle paginated responses (using `nextPageToken`) and map Google event objects to the internal `CalendarEvent` schema.
- **FR-013**: Google sync service MUST extract: summary (title), start/end datetime with timezone, location, transparency, recurrence rules, and calendar summary (name).

**iCal/CalDAV Support**

- **FR-014**: System MUST support adding iCal (.ics) URLs as calendar sources without OAuth authentication.
- **FR-015**: Backend iCal service MUST fetch the .ics URL via HTTPS GET, parse VCALENDAR/VEVENT components, and map them to the internal `CalendarEvent` schema.
- **FR-016**: iCal parser MUST handle recurring events (RRULE), all-day events (DATE vs DATE-TIME), multi-day events, and timezone definitions (VTIMEZONE).
- **FR-017**: iCal sources MUST be periodically re-fetched at a configurable interval (default: 15 minutes).

**Calendar Event Sync & Caching**

- **FR-018**: System MUST provide a generic calendar sync service that pulls events for any source type, upserts them into `calendar_events` (keyed by `sourceId` + `providerEventId`), and deletes events no longer present in the provider response.
- **FR-019**: Sync service MUST only fetch events within a rolling window: 7 days past to 90 days future (configurable per source).
- **FR-020**: System MUST run background sync on a per-source configurable interval (default: 5 minutes for OAuth sources, 15 minutes for iCal).
- **FR-021**: Sync service MUST record `lastSyncAt` and `lastSyncError` on the `calendar_sources` record after each sync attempt.

**Calendar Widget Frontend**

- **FR-022**: System MUST register a `calendar` widget type in the widget registry with icon (`Calendar` from lucide-react), display name "Calendar", and appropriate default config.
- **FR-023**: Calendar widget display component MUST support two view modes: "Agenda" (chronological event list) and "Mini Calendar" (month grid with event indicators).
- **FR-024**: Agenda view MUST display events sorted by start time, grouped by day, showing: event title, start/end time (formatted for the configured timezone), location (if present), and a color indicator matching the calendar source color.
- **FR-025**: Mini Calendar view MUST render a month grid where days with events show colored dots. Clicking a day MUST expand to show that day's events in a detail panel.
- **FR-026**: Widget MUST handle all-day events (displayed at the top of each day) and multi-day events (shown on each day they span).
- **FR-027**: Widget MUST gracefully handle empty states: no sources configured, sources configured but no events in range, sources in error state.

**Widget Config Form**

- **FR-028**: `CalendarConfigForm` MUST allow selecting one or more calendar sources from a list of all sources available to the current user.
- **FR-029**: Config form MUST provide a view mode selector (Agenda / Mini Calendar).
- **FR-030**: Config form MUST provide a "Days Ahead" input (1–90, default: 7).
- **FR-031**: Config form MUST provide a "Max Events" input (5–100, default: 25).
- **FR-032**: Config form MUST provide an option to show/hide event locations.

**Account Management UI**

- **FR-033**: System MUST provide an admin-only "Connected Accounts" section in the settings UI listing all OAuth accounts with: provider icon, email, display name, connection status, and last sync time.
- **FR-034**: "Connect Microsoft Account" and "Connect Google Account" buttons MUST only appear when the corresponding `CLIENT_ID` env var is configured (checked via a new `/api/user/oauth/providers` endpoint).
- **FR-035**: Each connected account MUST have a "Disconnect" button that deletes the OAuth account, disables associated calendar sources, and purges cached events.
- **FR-036**: System MUST provide a UI to add/edit/remove iCal URL sources with fields: URL, display name, color, and sync interval.

**Calendar Source Management API**

- **FR-037**: System MUST provide `GET /api/user/calendar/sources` to list all calendar sources for the authenticated user.
- **FR-038**: System MUST provide `POST /api/admin/calendar/sources` to create an iCal source (admin + CSRF required).
- **FR-039**: System MUST provide `PUT /api/admin/calendar/sources/:id` to update a source's config (admin + CSRF).
- **FR-040**: System MUST provide `DELETE /api/admin/calendar/sources/:id` to delete a source and its cached events (admin + CSRF).
- **FR-041**: System MUST provide `GET /api/user/calendar/events` to fetch cached events for specified source IDs and date range (used by the widget).
- **FR-042**: System MUST provide `POST /api/admin/calendar/sources/:id/sync` to trigger an immediate sync for a specific source (admin + CSRF).

### Non-Functional Requirements

- **NFR-001 (Security — Token Encryption)**: OAuth access tokens and refresh tokens MUST be encrypted at rest using AES-256-GCM. The encryption key MUST be derived from `SESSION_SECRET`. Tokens MUST never appear in logs, error messages, or API responses.
- **NFR-002 (Security — Auth & CSRF)**: All mutation endpoints (account connection, source CRUD, manual sync) MUST require `requireAdmin` + `assertCsrf`, consistent with existing admin routes. Read endpoints MUST require `requireAuth` at minimum.
- **NFR-003 (Security — OAuth State)**: OAuth initiation MUST generate a cryptographically random `state` parameter stored in the session. Callbacks MUST validate `state` to prevent CSRF attacks on the OAuth flow.
- **NFR-004 (Performance — Cached Sync)**: Calendar events MUST be fetched and cached server-side on a configurable interval. The frontend widget MUST read from the local cache, NOT directly from external APIs. This ensures fast widget rendering regardless of provider latency.
- **NFR-005 (Performance — Sync Efficiency)**: Sync services SHOULD use incremental sync where supported (Microsoft `deltaLink`, Google `syncToken`) to minimize data transfer.
- **NFR-006 (Privacy — Data Locality)**: All calendar event data MUST be stored only on the HomeDash server. Event data MUST NOT be forwarded to any third-party service beyond the calendar provider APIs.
- **NFR-007 (Resilience — Graceful Degradation)**: When a calendar provider is unreachable, the widget MUST display previously cached events with a subtle "last synced X minutes ago" indicator. Sync errors MUST NOT crash the widget or block dashboard rendering.
- **NFR-008 (LAN Boundary Exception)**: This feature explicitly requires external API calls to Microsoft Graph and Google Calendar APIs. This is an acknowledged exception to the LAN-only default, justified because calendar integration is the core feature purpose.
- **NFR-009 (Mobile UI)**: Calendar widget agenda view and mini calendar MUST be usable on viewports ≥ 320px width. Month grid MUST adapt column sizing for mobile.
- **NFR-010 (Operability)**: Sync errors, token refresh failures, and provider connectivity issues MUST be logged with structured Pino log entries including source ID and provider name.

### Key Entities

- **OAuthAccount** (`oauth_accounts` table): Stores provider credentials. Fields: `id` (UUID PK), `userId` (FK to users), `provider` ('microsoft' | 'google'), `providerAccountId` (unique per provider), `accessTokenEnc` (AES-256-GCM encrypted), `refreshTokenEnc` (encrypted), `tokenExpiresAt` (ISO timestamp), `email`, `displayName`, `status` ('active' | 'error'), `lastError`, `createdAt`, `updatedAt`.

- **CalendarSource** (`calendar_sources` table): Represents a connected calendar. Fields: `id` (UUID PK), `userId` (FK to users), `oauthAccountId` (FK to oauth_accounts, nullable for iCal), `type` ('microsoft' | 'google' | 'ical'), `name` (display name), `url` (iCal URL, null for OAuth), `color` (hex color for UI), `syncIntervalSeconds` (default: 300 for OAuth, 900 for iCal), `lastSyncAt`, `lastSyncError`, `enabled` (boolean), `createdAt`, `updatedAt`.

- **CalendarEvent** (`calendar_events` table): Cached event data. Fields: `id` (UUID PK), `sourceId` (FK to calendar_sources), `providerEventId` (unique per source), `title`, `description`, `location`, `startAt` (ISO UTC), `endAt` (ISO UTC), `startTz` (original timezone), `endTz`, `isAllDay` (boolean), `recurrenceRule` (RRULE string, nullable), `calendarName`, `rawJson` (full provider response for debugging), `createdAt`, `updatedAt`. Composite unique constraint on (`sourceId`, `providerEventId`).

- **CalendarWidgetConfig** (stored in `app_widget_instances.configJson`): `{ sourceIds: string[], viewMode: 'agenda' | 'calendar', daysAhead: number, maxEvents: number, showLocation: boolean }`.

## Assumptions

- Microsoft and Google OAuth app credentials (client ID + secret) are obtained manually by the HomeDash administrator from the respective developer portals. HomeDash provides documentation for this setup.
- The `SESSION_SECRET` environment variable (already required, min 32 chars) is sufficient as a key source for AES-256-GCM token encryption — no additional encryption key env var is needed.
- Microsoft Graph API scope `Calendars.Read` and `offline_access` provide sufficient access for read-only calendar event retrieval with refresh token support.
- Google Calendar API scope `https://www.googleapis.com/auth/calendar.readonly` provides sufficient read-only access.
- The HomeDash server has outbound HTTPS access to `login.microsoftonline.com`, `graph.microsoft.com`, `accounts.google.com`, and `www.googleapis.com`. LAN-only setups that block outbound HTTPS will not be able to use OAuth features (iCal from internal URLs still works).
- better-sqlite3 synchronous operations are acceptable for token encryption/decryption, which involves small payloads and fast crypto operations.
- The existing Fastify server lifecycle (startup/shutdown) can accommodate a background sync scheduler using `setInterval` or a lightweight job runner without adding a separate process.
- Only one user (the admin) will typically connect OAuth accounts. Multi-user calendar support is possible via the data model but not a priority for this iteration.

## Out of Scope

- **Calendar write operations**: Creating, editing, or deleting events on the provider (read-only integration).
- **CalDAV protocol full support**: Only read-only .ics file fetching; no PROPFIND/REPORT or WebDAV operations.
- **Event deduplication across sources**: If the same event appears in multiple connected calendars, both instances are displayed.
- **Push notifications / webhooks**: No Microsoft Graph subscriptions or Google push notifications — sync is poll-based only.
- **Custom OAuth providers**: Only Microsoft and Google are supported. Generic OAuth2 provider configuration is not included.
- **Shared/team calendars**: Only the user's primary calendar is synced per OAuth account. Selecting specific calendar IDs from multi-calendar accounts is future work.
- **Event reminders / notifications**: No desktop or browser notifications for upcoming events.
- **Calendar event detail view**: No click-to-expand showing full event description, attendees, or attachments.
- **Two-way sync or conflict resolution**: This is strictly a read-only cache.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can connect a Microsoft account via OAuth and see it listed in Connected Accounts within 10 seconds of completing the authorization flow.
- **SC-002**: An admin can connect a Google account via OAuth and see it listed in Connected Accounts within 10 seconds of completing the authorization flow.
- **SC-003**: After connecting a Microsoft account, calendar events from the last 7 days and next 90 days are synced and visible in a calendar widget within 60 seconds.
- **SC-004**: After connecting a Google account, calendar events are synced and visible within 60 seconds.
- **SC-005**: An admin can add an iCal URL and see its events in the calendar widget within 30 seconds of saving.
- **SC-006**: The calendar widget agenda view renders cached events within 200ms (no external API call on render).
- **SC-007**: Token refresh occurs transparently — the admin does not need to manually reconnect unless the refresh token itself is revoked.
- **SC-008**: When a provider is unreachable, the widget displays cached events with a "last synced" indicator instead of an error state.
- **SC-009**: OAuth tokens stored in the `oauth_accounts` table are verified to be AES-256-GCM encrypted (not plaintext) by integration tests.
- **SC-010**: All admin mutation endpoints return 401 without auth and 403 without CSRF token.
- **SC-011**: Disconnecting an OAuth account removes all associated tokens, sources, and cached events within 5 seconds.

## Safety Constraints

- **Token Security**: OAuth tokens MUST be encrypted before writing to SQLite and decrypted only in-memory when needed for API calls. The encryption key is derived from `SESSION_SECRET` — if `SESSION_SECRET` changes, existing tokens become unrecoverable (admin must reconnect accounts). This is acceptable and documented.
- **OAuth State Validation**: The `state` parameter in OAuth flows MUST be a cryptographically random value stored in the HTTP session. Callbacks MUST reject mismatched state values to prevent CSRF-based account hijacking.
- **Scope Minimization**: OAuth scopes MUST be limited to read-only calendar access. No write scopes, no email access, no profile scopes beyond basic identity.
- **iCal URL Validation**: iCal URLs MUST be validated as HTTPS URLs (HTTP allowed only for `localhost` / RFC 1918 addresses for LAN-internal CalDAV servers). The fetch service MUST enforce a response size limit (default: 5 MB) and a timeout (default: 30 seconds) to prevent abuse.
- **No Token Leakage**: Encrypted tokens MUST NOT appear in log output, error messages, or API responses. API responses for connected accounts show email and status only — never tokens.
- **Sync Isolation**: Sync failures for one source MUST NOT affect other sources. Each source syncs independently.
- **Input Sanitization**: Event titles, descriptions, and locations fetched from providers MUST be treated as untrusted and sanitized before rendering in the frontend (React's default escaping is sufficient for text content; no `dangerouslySetInnerHTML`).
