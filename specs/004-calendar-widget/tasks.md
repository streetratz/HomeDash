# Tasks: Calendar Widget

**Input**: Design documents from `/specs/004-calendar-widget/`
**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: Backend integration tests (TDD — tests written before implementation). Frontend E2E tests for widget rendering, config, and account flows.

**Organization**: Tasks are grouped by phase. Phase 1 is foundational (OAuth + DB). Phases 2–4 are provider integrations (can partially parallel). Phase 5–6 are frontend. Phase 7 is E2E. US1–US3 are P1; US4 is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `backend/src/`, `frontend/src/`, `backend/tests/`, `frontend/tests/`

---

## Phase 1: OAuth2 Infrastructure

**Purpose**: Build the shared foundation for Microsoft and Google OAuth — database tables, token encryption, environment variables, OAuth callback routes, and account management API. This is the prerequisite for all provider-specific work.

- [x] T001 [P] [US1/US2] New Drizzle migration: `oauth_accounts` table — `id` TEXT PK (UUID), `userId` TEXT FK → users.id (NOT NULL, ON DELETE CASCADE), `provider` TEXT NOT NULL ('microsoft' | 'google'), `providerAccountId` TEXT NOT NULL, `accessTokenEnc` TEXT NOT NULL, `refreshTokenEnc` TEXT NOT NULL, `tokenExpiresAt` TEXT (ISO timestamp), `email` TEXT, `displayName` TEXT, `status` TEXT NOT NULL DEFAULT 'active' ('active' | 'error'), `lastError` TEXT, `createdAt` TEXT NOT NULL DEFAULT (datetime('now')), `updatedAt` TEXT NOT NULL DEFAULT (datetime('now')). UNIQUE constraint on (`provider`, `providerAccountId`). Generate migration to `backend/drizzle/0003_oauth_accounts.sql`. Add Drizzle schema definition in `backend/src/db/schema/index.ts`.

- [x] T002 [P] [US1/US2/US3/US4] New Drizzle migration: `calendar_sources` table — `id` TEXT PK (UUID), `userId` TEXT FK → users.id (NOT NULL, ON DELETE CASCADE), `oauthAccountId` TEXT FK → oauth_accounts.id (nullable, ON DELETE SET NULL), `type` TEXT NOT NULL ('microsoft' | 'google' | 'ical'), `name` TEXT NOT NULL, `url` TEXT (nullable — iCal URL, null for OAuth sources), `color` TEXT NOT NULL DEFAULT '#3b82f6' (hex color), `syncIntervalSeconds` INTEGER NOT NULL DEFAULT 300, `lastSyncAt` TEXT (nullable), `lastSyncError` TEXT (nullable), `enabled` INTEGER NOT NULL DEFAULT 1, `createdAt` TEXT NOT NULL DEFAULT (datetime('now')), `updatedAt` TEXT NOT NULL DEFAULT (datetime('now')). Generate to `backend/drizzle/0004_calendar_sources.sql`. Add Drizzle schema in `backend/src/db/schema/index.ts`.

- [x] T003 [P] [US3] New Drizzle migration: `calendar_events` table — `id` TEXT PK (UUID), `sourceId` TEXT FK → calendar_sources.id (NOT NULL, ON DELETE CASCADE), `providerEventId` TEXT NOT NULL, `title` TEXT NOT NULL, `description` TEXT, `location` TEXT, `startAt` TEXT NOT NULL (ISO UTC), `endAt` TEXT NOT NULL (ISO UTC), `startTz` TEXT, `endTz` TEXT, `isAllDay` INTEGER NOT NULL DEFAULT 0, `recurrenceRule` TEXT, `calendarName` TEXT, `rawJson` TEXT, `createdAt` TEXT NOT NULL DEFAULT (datetime('now')), `updatedAt` TEXT NOT NULL DEFAULT (datetime('now')). UNIQUE constraint on (`sourceId`, `providerEventId`). CREATE INDEX on (`sourceId`, `startAt`). Generate to `backend/drizzle/0005_calendar_events.sql`. Add Drizzle schema in `backend/src/db/schema/index.ts`.

- [x] T004 [P] [US1/US2] Add new optional environment variables to `backend/src/config/env.ts`: `MICROSOFT_CLIENT_ID` (string, optional), `MICROSOFT_CLIENT_SECRET` (string, optional), `MICROSOFT_REDIRECT_URI` (string, optional, default: computed from HOST+PORT), `GOOGLE_CLIENT_ID` (string, optional), `GOOGLE_CLIENT_SECRET` (string, optional), `GOOGLE_REDIRECT_URI` (string, optional). Add to Zod `envSchema` with `.optional()`. Update the `getEnv()` return type.

- [x] T005 [P] [US1/US2] Create token encryption utility in `backend/src/lib/tokenEncryption.ts`: export `encryptToken(plaintext: string): string` and `decryptToken(ciphertext: string): string`. Use `node:crypto` — derive a 256-bit key from `SESSION_SECRET` via HKDF (SHA-256, salt: 'homedash-oauth-tokens'). Encrypt with AES-256-GCM, output format: `iv_hex:ciphertext_hex:authTag_hex`. Decrypt by splitting the string, verifying auth tag. Throw typed error on decryption failure (corrupted or wrong key).

- [x] T006 [P] [US1/US2] Create token encryption integration tests in `backend/tests/integration/tokenEncryption.test.ts`: test encrypt→decrypt round-trip returns original plaintext; test different plaintexts produce different ciphertexts; test same plaintext encrypted twice produces different ciphertexts (random IV); test tampered ciphertext throws error; test truncated ciphertext throws error; test decryption with wrong key fails (mock SESSION_SECRET change).

- [x] T007 [US1/US2] Create OAuth service in `backend/src/services/oauthService.ts`: export `exchangeMicrosoftCode(code: string, sessionUserId: string): Promise<OAuthAccount>` — POST to `https://login.microsoftonline.com/common/oauth2/v2.0/token` with code, client_id, client_secret, redirect_uri, grant_type=authorization_code; encrypt tokens; upsert into oauth_accounts; auto-create a calendar_source record (type: 'microsoft', name from displayName). Export `exchangeGoogleCode(code: string, sessionUserId: string): Promise<OAuthAccount>` — POST to `https://oauth2.googleapis.com/token`; same pattern. Export `refreshAccessToken(accountId: string): Promise<string>` — check tokenExpiresAt, if expired POST refresh request to provider, update stored tokens, return new access token. Export `getAccountsForUser(userId: string)`, `deleteAccount(accountId: string)` (cascade deletes sources + events). Export `getAvailableProviders()` — returns which providers have CLIENT_ID configured.

- [x] T008 [US1/US2] Create OAuth routes in `backend/src/api/authOAuth.ts`: `GET /api/auth/oauth/microsoft` — requireAuth, generate cryptographic `state` (32 bytes hex), store in session (new `oauthState` field), redirect to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with params: client_id, response_type=code, redirect_uri, scope='Calendars.Read offline_access openid profile email', state. `GET /api/auth/oauth/microsoft/callback` — validate state matches session, call oauthService.exchangeMicrosoftCode, redirect to frontend `/settings?tab=accounts&connected=microsoft`. `GET /api/auth/oauth/google` — same pattern, redirect to `https://accounts.google.com/o/oauth2/v2/auth` with scope='https://www.googleapis.com/auth/calendar.readonly openid email profile', access_type=offline, prompt=consent. `GET /api/auth/oauth/google/callback` — validate state, call exchangeGoogleCode, redirect to frontend. Register routes in the Fastify app (follow pattern in existing route registration).

- [x] T009 [US1/US2] Create account management API routes: `GET /api/user/oauth/accounts` — requireAuth, return list of OAuth accounts for current user (id, provider, email, displayName, status, lastError, createdAt — NO tokens). `DELETE /api/admin/oauth/accounts/:id` — requireAdmin + assertCsrf, call oauthService.deleteAccount, return 204. `GET /api/user/oauth/providers` — requireAuth, return `{ microsoft: boolean, google: boolean }` indicating which providers are configured. Add routes to `backend/src/api/authOAuth.ts` or a new `backend/src/api/userOAuth.ts` file.

- [x] T010 [P] [US1/US2] Create OAuth flow integration tests in `backend/tests/integration/oauthFlow.test.ts`: mock Microsoft and Google token endpoints; test GET /api/auth/oauth/microsoft redirects with correct params; test callback with valid code creates account with encrypted tokens; test callback with invalid state returns 403; test callback with duplicate providerAccountId updates existing account; test GET /api/user/oauth/accounts returns accounts without tokens; test DELETE /api/admin/oauth/accounts/:id deletes account + cascades; test endpoints without auth return 401; test DELETE without CSRF returns 403.

**Checkpoint**: OAuth flow works end-to-end (with mocked providers). Tokens are encrypted. Accounts can be listed and deleted. All integration tests pass.

---

## Phase 2: Microsoft Calendar Sync

**Purpose**: Fetch and cache calendar events from Microsoft Graph API. Build the generic sync orchestrator that Phase 3 and Phase 4 also use.

- [x] T011 [P] [US1/US3] Create Microsoft Graph calendar client in `backend/src/services/microsoftCalendarService.ts`: export `fetchCalendarEvents(accessToken: string, startDate: string, endDate: string): Promise<CalendarEvent[]>` — GET `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start}&endDateTime={end}&$top=250&$select=subject,start,end,location,isAllDay,recurrence,calendar`; handle `@odata.nextLink` pagination (max 10 pages as safety limit); map each event: `title` ← subject, `startAt` ← start.dateTime (convert to UTC), `endAt` ← end.dateTime, `startTz` ← start.timeZone, `location` ← location.displayName, `isAllDay` ← isAllDay, `calendarName` ← calendar.name, `providerEventId` ← id. Return array of mapped events.

- [x] T012 [US1/US3] Create generic calendar sync service in `backend/src/services/calendarSyncService.ts`: export `syncSource(sourceId: string): Promise<SyncResult>` — load source from DB; load associated oauth_account; call oauthService.refreshAccessToken if needed; dispatch to provider-specific fetch function based on source.type; compute date window (7 days past → source-configured days future, default 90); receive events; within a DB transaction: upsert events (INSERT OR REPLACE on sourceId+providerEventId), delete events with sourceId that aren't in the fetched set; update source.lastSyncAt; on error, update source.lastSyncError and log via Pino. Export `startSyncScheduler()` — called on Fastify `onReady`; runs every 60 seconds; queries calendar_sources for enabled sources past their syncIntervalSeconds; syncs each sequentially. Export `stopSyncScheduler()` — called on Fastify `onClose`; clears the interval.

- [x] T013 [P] [US1/US3] Create Microsoft calendar integration tests in `backend/tests/integration/microsoftCalendar.test.ts`: mock Graph API responses; test single-page event fetch maps fields correctly; test paginated response follows nextLink; test all-day event handling; test event with no location; test token refresh triggered when 401 received; test sync service upserts new events, updates changed events, deletes removed events.

**Checkpoint**: Microsoft calendar events are fetched, cached in calendar_events, and periodically refreshed. Sync scheduler runs on startup.

---

## Phase 3: Google Calendar Sync

**Purpose**: Fetch and cache calendar events from Google Calendar API. Reuses the sync orchestrator from Phase 2.

- [x] T014 [P] [US2/US3] Create Google Calendar API client in `backend/src/services/googleCalendarService.ts`: export `fetchCalendarEvents(accessToken: string, startDate: string, endDate: string): Promise<CalendarEvent[]>` — GET `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={start}&timeMax={end}&singleEvents=true&orderBy=startTime&maxResults=250`; handle `nextPageToken` pagination (max 10 pages); map each event: `title` ← summary, `startAt` ← start.dateTime or start.date (all-day), `endAt` ← end.dateTime or end.date, `startTz` ← start.timeZone, `location` ← location, `isAllDay` ← (start.date exists and start.dateTime does not), `calendarName` ← summary from calendar metadata, `providerEventId` ← id. Return mapped events.

- [x] T015 [P] [US2/US3] Create Google calendar integration tests in `backend/tests/integration/googleCalendar.test.ts`: mock Google API responses; test single-page fetch maps fields correctly; test paginated response follows nextPageToken; test all-day event (date vs dateTime); test event with no location; test token refresh on 401; test sync service upserts/deletes correctly for Google source.

**Checkpoint**: Google calendar events are fetched, cached, and synced on schedule alongside Microsoft sources.

---

## Phase 4: iCal/CalDAV Support

**Purpose**: Fetch and parse .ics files from URLs (public calendars, LAN CalDAV servers). No OAuth required.

- [x] T016 [P] [US4] Create iCal parser service in `backend/src/services/icalService.ts`: add iCal parsing dependency to `backend/package.json` (`ical.js` or `node-ical`). Export `fetchAndParseIcal(url: string, startDate: string, endDate: string): Promise<CalendarEvent[]>` — fetch URL with 30s timeout and 5MB size limit; validate response contains VCALENDAR; parse VEVENT components; for recurring events (RRULE), expand occurrences within the [startDate, endDate] window; handle EXDATE exceptions; map each event/occurrence: `title` ← SUMMARY, `startAt` ← DTSTART (convert to UTC), `endAt` ← DTEND (convert to UTC), `startTz` ← DTSTART TZID, `location` ← LOCATION, `isAllDay` ← (VALUE=DATE), `providerEventId` ← UID + recurrence instance date (for expanded occurrences), `calendarName` ← X-WR-CALNAME or source.name. Return mapped events.

- [x] T017 [US4] Add iCal URL validation to `backend/src/lib/validation.ts`: export `ICalUrlSchema` — Zod string, must be valid URL, protocol must be 'https:' OR ('http:' AND hostname is localhost/127.0.0.1/::1 or RFC 1918 range 10.x, 172.16-31.x, 192.168.x). Add `CalendarSourceCreateSchema` — Zod object: `type` literal 'ical', `name` string (1-100 chars), `url` ICalUrlSchema, `color` HexColorSchema (optional, default '#3b82f6'), `syncIntervalSeconds` number (60-3600, default 900).

- [x] T018 [US4] Create calendar source CRUD routes in `backend/src/api/adminCalendar.ts`: `GET /api/user/calendar/sources` — requireAuth, list all sources for current user (id, type, name, color, url, enabled, lastSyncAt, lastSyncError, oauthAccountId, createdAt). `POST /api/admin/calendar/sources` — requireAdmin + assertCsrf, validate body with CalendarSourceCreateSchema, insert source, trigger initial sync, return 201 with source. `PUT /api/admin/calendar/sources/:id` — requireAdmin + assertCsrf, validate updates, update source. `DELETE /api/admin/calendar/sources/:id` — requireAdmin + assertCsrf, delete source (cascade deletes events), return 204. `POST /api/admin/calendar/sources/:id/sync` — requireAdmin + assertCsrf, trigger immediate syncSource(id), return sync result.

- [x] T019 [US3] Create calendar events read route in `backend/src/api/userCalendar.ts`: `GET /api/user/calendar/events` — requireAuth, query params: `sourceIds` (comma-separated UUIDs, required), `from` (ISO date, required), `to` (ISO date, required). Validate that requested sourceIds belong to the current user. Query calendar_events WHERE sourceId IN (...) AND startAt >= from AND startAt <= to ORDER BY startAt ASC LIMIT 200. Return array of event objects (id, sourceId, title, description, location, startAt, endAt, startTz, endTz, isAllDay, calendarName). Include source color in response by joining with calendar_sources.

- [x] T020 [P] [US4] Create iCal parser integration tests in `backend/tests/integration/icalParser.test.ts`: test parse simple .ics with 3 events; test recurring event (RRULE FREQ=WEEKLY) expands within window; test EXDATE excludes specific occurrence; test all-day event (VALUE=DATE); test multi-day event; test VTIMEZONE handling; test .ics with no events returns empty array; test malformed .ics throws validation error; test oversized response (>5MB) is rejected; test HTTP URL to non-RFC1918 address is rejected.

**Checkpoint**: iCal URLs can be added, fetched, parsed, and events cached. Recurring events are expanded. Source CRUD API works. Events API returns cached events for the widget.

---

## Phase 5: Calendar Widget Frontend

**Purpose**: Build the CalendarWidget display component with agenda and mini-calendar views. Register it in the widget registry.

- [x] T021 [P] [US3] Create TanStack Query hooks for calendar data in `frontend/src/state/calendarSources.ts` and `frontend/src/state/calendarEvents.ts`: `useCalendarSources()` — GET /api/user/calendar/sources, returns list of sources. `useCalendarEvents(sourceIds: string[], from: string, to: string)` — GET /api/user/calendar/events?sourceIds=...&from=...&to=..., staleTime 60s. `useOAuthAccounts()` — GET /api/user/oauth/accounts. `useOAuthProviders()` — GET /api/user/oauth/providers. `useDeleteOAuthAccount()` — DELETE mutation. `useCreateCalendarSource()` — POST mutation. `useDeleteCalendarSource()` — DELETE mutation. `useSyncCalendarSource()` — POST /api/admin/calendar/sources/:id/sync mutation.

- [x] T022 [P] [US3] Create `EventCard` component in `frontend/src/components/calendar/EventCard.tsx`: accepts props `{ title, startAt, endAt, startTz, isAllDay, location, color, calendarName }`. Renders: left border with `color`; title (bold, truncate with ellipsis if long); time line — if isAllDay show "All Day", else format startAt–endAt using Intl.DateTimeFormat with timezone; location line (if present, with MapPin icon from Lucide); calendar name in muted text. Responsive: full info on desktop, compact on mobile.

- [x] T023 [P] [US3] Create `AgendaView` component in `frontend/src/components/calendar/AgendaView.tsx`: accepts `{ events: CalendarEvent[], sources: CalendarSource[] }`. Group events by date (using startAt). Render day headers with relative labels: "Today", "Tomorrow", date string for others. Under each day header, render EventCard for each event (lookup source color by sourceId). All-day events appear first in each day group. Empty state: "No upcoming events" message.

- [x] T024 [P] [US3] Create `MiniCalendarView` component in `frontend/src/components/calendar/MiniCalendarView.tsx`: accepts `{ events, sources, onDaySelect }`. Render month grid (7 columns × 6 rows). Header row: Sun–Sat. Day cells show day number; days with events show up to 3 colored dots (one per source with events that day). Current day highlighted. Clicking a day calls `onDaySelect(date)`. Navigation arrows to go to previous/next month. Below the grid, render `DayDetailPanel` for the selected day.

- [x] T025 [P] [US3] Create `DayDetailPanel` component in `frontend/src/components/calendar/DayDetailPanel.tsx`: accepts `{ date, events, sources }`. Filter events for the selected date. Render a compact list of EventCards. If no events, show "No events on this day."

- [x] T026 [US3] Create `CalendarWidget` display component in `frontend/src/components/widgets/CalendarWidget.tsx`: implements `WidgetDisplayProps`. Parse configJson for `sourceIds`, `viewMode`, `daysAhead`, `maxEvents`, `showLocation`. Compute date range: today → today + daysAhead. Call `useCalendarEvents(sourceIds, from, to)`. Also call `useCalendarSources()` to get source colors. Slice events to maxEvents. Render: loading state (skeleton), error state (retry button with "Calendar unavailable" message and last sync time), empty state (no sources: "Configure calendar sources"; no events: "No upcoming events"). For viewMode 'agenda' render AgendaView; for 'calendar' render MiniCalendarView. Header shows view mode toggle button (list/grid icons). If any source has lastSyncError, show a subtle warning icon with tooltip.

- [x] T027 [US3] Register 'calendar' widget type in `frontend/src/components/widgets/registry.tsx`: import CalendarWidget and CalendarConfigForm (from T030). Register with `.set('calendar', { type: 'calendar', displayName: 'Calendar', description: 'Show upcoming events from connected calendars', icon: Calendar (from lucide-react), defaultConfig: { sourceIds: [], viewMode: 'agenda', daysAhead: 7, maxEvents: 25, showLocation: true }, DisplayComponent: CalendarWidget, ConfigFormComponent: CalendarConfigForm })`.

**Checkpoint**: Calendar widget renders in agenda and mini-calendar views with color-coded events. Registered in widget picker. Loading, error, and empty states handled.

---

## Phase 6: Config Form & Account Management UI

**Purpose**: Build the CalendarConfigForm for widget settings, and the account management UI for connecting/disconnecting OAuth providers and managing iCal sources.

- [x] T028 [P] [US3] Add CalendarConfigSchema to `backend/src/lib/validation.ts`: Zod object — `sourceIds` array of UuidSchema (min 0, max 20), `viewMode` enum('agenda', 'calendar'), `daysAhead` number (1–90, default 7), `maxEvents` number (5–100, default 25), `showLocation` boolean (default true). Export for use in widget config validation.

- [x] T029 [P] [US3] Create `CalendarConfigForm` component in `frontend/src/components/widgets/CalendarConfigForm.tsx`: implements `WidgetConfigFormProps`. Fetch sources via `useCalendarSources()`. Render: multi-select checkbox list of sources grouped by type (Microsoft/Google/iCal), each with color swatch and name; view mode radio group (Agenda/Mini Calendar); days ahead number input with label; max events number input; show location toggle switch. If no sources available, show message "No calendar sources connected" with link to settings page. On save, serialize to configJson matching CalendarConfigSchema.

- [x] T030 [P] [US1/US2] Create `ConnectedAccounts` component in `frontend/src/components/settings/ConnectedAccounts.tsx`: use `useOAuthAccounts()` to list accounts. Use `useOAuthProviders()` to determine which connect buttons to show. Render: section header "Connected Accounts". For each account: provider icon (Microsoft/Google), email, display name, status badge (green "Active" or red "Error" with lastError tooltip), "Disconnect" button (with confirmation dialog — "This will remove the account and all cached calendar events"). "Connect Microsoft Account" button → navigate to `/api/auth/oauth/microsoft` (full page redirect). "Connect Google Account" button → navigate to `/api/auth/oauth/google`. Buttons hidden when corresponding provider not configured. Empty state: "No accounts connected. Connect a Microsoft or Google account to sync calendars."

- [x] T031 [P] [US4] Create `ICalSourceForm` component in `frontend/src/components/settings/ICalSourceForm.tsx`: shadcn/ui Dialog form with: URL input (required, validated as URL), display name input (required), color picker (hex input + color swatch preview, default #3b82f6), sync interval select (5min, 15min, 30min, 1hr). Submit calls `useCreateCalendarSource()` mutation (POST /api/admin/calendar/sources). Edit mode: pre-fill fields, submit calls PUT mutation.

- [x] T032 [P] [US3/US4] Create `CalendarSourceList` component in `frontend/src/components/settings/CalendarSourceList.tsx`: use `useCalendarSources()`. Render table/list of all sources: color swatch, name, type badge (Microsoft/Google/iCal), enabled toggle, last sync time, last sync error (if any), actions (Sync Now button, Edit for iCal sources, Delete with confirmation). "Add iCal URL" button opens ICalSourceForm dialog. "Sync Now" calls useSyncCalendarSource mutation.

- [x] T033 [US1/US2/US3/US4] Integrate calendar settings into the settings page: modify `frontend/src/pages/SettingsPage.tsx` (or equivalent settings layout) to add a "Calendars" section containing: `<ConnectedAccounts />` and `<CalendarSourceList />`. Ensure section is only visible to admin users. Add tab or accordion entry if the settings page uses tabs.

**Checkpoint**: Admins can connect/disconnect OAuth accounts, add/manage iCal sources, and configure the calendar widget with source selection and display options.

---

## Phase 7: E2E & Integration Tests

**Purpose**: End-to-end Playwright tests for the full calendar workflow, and security verification tests.

- [x] T034 [P] [US3] Add E2E test for calendar widget display in `frontend/tests/e2e/calendarWidget.spec.ts`: seed database with calendar_sources and calendar_events via API or direct DB insert; add a calendar widget to a dashboard via edit mode; verify widget renders with correct events in agenda view; verify events show title, time, location, and color; toggle to mini calendar view; verify month grid renders with event dots; click a day with events; verify day detail panel shows events.

- [x] T035 [P] [US3] Add E2E test for calendar widget config in `frontend/tests/e2e/calendarConfig.spec.ts`: open widget picker; select "Calendar" widget; verify config form shows source selection, view mode, days ahead, max events; select sources; change view mode to "Mini Calendar"; set days ahead to 14; save; verify widget renders with updated config.

- [x] T036 [P] [US1/US2] Add E2E test for account connection flow in `frontend/tests/e2e/oauthAccounts.spec.ts`: navigate to settings page; verify Connected Accounts section visible; test that connect buttons are shown/hidden based on configured providers (seed env vars accordingly); mock OAuth redirect flow (intercept the redirect to provider and simulate callback with test code); verify account appears in connected list; click Disconnect; confirm dialog; verify account is removed.

- [x] T037 [P] [US1/US2/US3] Security tests: verify GET /api/user/calendar/events without auth returns 401; verify POST /api/admin/calendar/sources without admin role returns 403; verify DELETE /api/admin/oauth/accounts/:id without CSRF returns 403; verify OAuth callback with forged state parameter returns 403; verify encrypted tokens in oauth_accounts are not readable as plaintext (query DB directly, assert ciphertext format); verify API responses for oauth_accounts never include accessTokenEnc or refreshTokenEnc fields.

- [x] T038 [P] [US4] Add integration test for iCal source end-to-end in `backend/tests/integration/calendarSync.test.ts` (extend): create an iCal source with a mocked .ics URL; trigger sync; verify events appear in calendar_events; modify the .ics (add/remove/change events); re-sync; verify upserts and deletes are correct; verify lastSyncAt updated; simulate URL unreachable; verify lastSyncError set and old events preserved.

- [x] T039 [US1/US2/US3/US4] Final integration verification: run all backend integration tests together (Vitest); run all frontend E2E tests together (Playwright); verify no test isolation issues; verify no regressions in existing widget tests.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: OAuth2 Infrastructure ──────────┬──► Phase 2: Microsoft Sync ──┐
                                         │                              │
                                         ├──► Phase 3: Google Sync ─────┤
                                         │                              │
                                         └──► Phase 4: iCal Support ────┼──► Phase 5: Widget Frontend
                                                                        │         │
                                                                        │         ▼
                                                                        ├──► Phase 6: Config & Accounts
                                                                        │
                                                                        └──► Phase 7: E2E Tests
```

- **Phase 1** (OAuth Infrastructure): No dependencies — must start first
- **Phase 2** (Microsoft Sync): Depends on Phase 1 (T001, T005, T007)
- **Phase 3** (Google Sync): Depends on Phase 1; can parallel with Phase 2
- **Phase 4** (iCal Support): Depends on Phase 1 (T002, T003); can parallel with Phases 2–3
- **Phase 5** (Widget Frontend): Depends on Phase 1 (T003 for events table), Phase 4 (T018–T019 for API routes); widget display can start with mock data in parallel
- **Phase 6** (Config & Accounts): Depends on Phase 1 (T009 for account API), Phase 4 (T018 for source API)
- **Phase 7** (E2E Tests): Depends on all prior phases

### Task-Level Dependencies Within Phases

| Task | Depends On | Reason |
|------|-----------|--------|
| T007 | T001, T004, T005 | OAuth service needs oauth_accounts table, env vars, encryption |
| T008 | T007 | OAuth routes call oauthService methods |
| T009 | T007 | Account API uses oauthService |
| T012 | T003, T007, T011 | Sync service needs events table, oauth service, MS client |
| T018 | T002, T003 | Source CRUD needs calendar_sources and calendar_events tables |
| T019 | T003 | Events read route needs calendar_events table |
| T026 | T021, T022, T023, T024, T025 | CalendarWidget composes sub-components |
| T027 | T026, T029 | Registry needs both display + config form components |
| T033 | T030, T031, T032 | Settings page integrates all sub-components |

### User Story Independence

| Story | Depends On | Can Parallel With | Backend Changes |
|-------|-----------|-------------------|----------------|
| US1 (P1) | — | US2 (shared infra) | New tables, OAuth routes, encryption, MS sync |
| US2 (P1) | Phase 1 shared with US1 | US1 (shared infra), US4 | Google sync service + tests |
| US3 (P1) | US1 or US2 (need events) | — | Widget display, config, events API |
| US4 (P2) | Phase 1 (tables) | US2, US3 | iCal service, source CRUD |

### Within Each Phase

1. Database migrations and schemas → before services that use them
2. Backend tests (TDD) → written first, verified to FAIL
3. Backend services → before routes that expose them
4. Backend routes → before frontend hooks that call them
5. Frontend hooks → before components that use them
6. Frontend components → can be parallel (different files)
7. Integration/registration → last in the phase

---

## Implementation Strategy

### MVP First (Phase 1 + 4 partial + 5 + 6 = iCal-only calendar widget)

If OAuth setup is complex, deliver iCal support first as a standalone MVP:
1. Phase 1: T002, T003, T004 (tables + env only, skip OAuth-specific tasks)
2. Phase 4: T016–T020 (iCal service + source API + events API)
3. Phase 5: T021–T027 (widget frontend)
4. Phase 6: T028–T033 (config + source management UI)
5. **STOP and VALIDATE**: Admin can add iCal URLs and see events in a widget

### Full Delivery

| Increment | Phases | What It Delivers | Cumulative Tasks |
|-----------|--------|-----------------|-----------------|
| **Foundation** | 1 | OAuth infra, tables, encryption | 10 |
| **+ Microsoft** | 2 | Microsoft calendar sync | 13 |
| **+ Google** | 3 | Google calendar sync | 15 |
| **+ iCal** | 4 | iCal parsing, source CRUD, events API | 20 |
| **+ Widget** | 5 | Calendar widget (agenda + mini cal) | 27 |
| **+ Config/UI** | 6 | Config form, account management | 33 |
| **+ Tests** | 7 | E2E tests, security audit | 39 |

### Parallel Team Strategy

With multiple developers:

1. **Developer A** (backend focus): Phase 1 → Phase 2 → Phase 3
2. **Developer B** (full-stack focus): Phase 4 → Phase 5 → Phase 6
3. **Both**: Phase 7 (E2E + integration verification)

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete tasks in the same phase
- **[Story] label** maps each task to a specific user story for traceability
- OAuth2 is the most complex part — budget extra time for provider-specific edge cases
- Token encryption uses `SESSION_SECRET` — document that changing the secret requires reconnecting accounts
- Background sync uses `setInterval` on the Fastify process — no separate worker needed for MVP
- iCal parsing library is a new dependency — evaluate `ical.js` vs `node-ical` for RRULE support quality
- All provider API calls happen server-side only — frontend never sees OAuth tokens
- Widget reads from local SQLite cache — no external API latency on render
- Commit after each task or logical group for clean git history
- Stop at any checkpoint to validate the story independently
