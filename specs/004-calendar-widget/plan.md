# Implementation Plan: Calendar Widget

**Branch**: `004-calendar-widget` | **Date**: 2026-04-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-calendar-widget/spec.md`

## Summary

Deliver a calendar/agenda widget for HomeDash that displays events from Microsoft 365, Google Calendar, and iCal/CalDAV sources. This requires building (1) an OAuth2 infrastructure for provider authentication, (2) backend sync services that cache calendar events in SQLite, (3) an iCal parser for URL-based feeds, (4) a frontend calendar widget with agenda and mini-calendar views, and (5) an account management UI for connecting/disconnecting providers.

The OAuth infrastructure is the heaviest lift — it introduces external API dependencies (an acknowledged LAN-boundary exception), new database tables for token storage, and an AES-256-GCM encryption layer for tokens at rest. The calendar widget itself follows the existing widget registry pattern (`DisplayComponent` + `ConfigFormComponent` registered in `registry.tsx`). Background sync uses a lightweight `setInterval` scheduler within the existing Fastify process.

## Technical Context

**Language/Version**: TypeScript 5.5+ on Node.js ≥ 20 (pnpm 8+ monorepo)
**Primary Dependencies**:
- Backend: Fastify, Drizzle ORM, better-sqlite3, Zod
- Backend (new): `node:crypto` (built-in, for AES-256-GCM), `ical.js` or `node-ical` (iCal parsing)
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, Lucide icons
**Storage**: SQLite via better-sqlite3 / Drizzle ORM — three new tables: `oauth_accounts`, `calendar_sources`, `calendar_events`
**Testing**: Vitest (backend integration), Playwright (frontend E2E)
**Target Platform**: Docker container on Synology NAS, LAN-only host networking (with outbound HTTPS for OAuth providers)
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Constraints**: Outbound HTTPS required for Microsoft Graph + Google Calendar APIs. iCal sources may be LAN-internal.

## Constitution Check

*GATE: Must pass before implementation.*

- [x] **Secure-by-default**: OAuth tokens encrypted at rest (AES-256-GCM using `SESSION_SECRET`).
  OAuth routes use session-bound `state` parameter to prevent CSRF. All mutation endpoints
  use `requireAdmin` + `assertCsrf`. Token values never appear in logs or API responses.
  iCal URLs validated as HTTPS (HTTP only for RFC 1918 / localhost addresses).
- [x] **LAN-only boundary — EXCEPTION**: This feature requires outbound HTTPS to
  `login.microsoftonline.com`, `graph.microsoft.com`, `accounts.google.com`, and
  `www.googleapis.com`. This is an acknowledged exception justified by the core feature
  purpose. iCal sources from LAN-internal CalDAV servers work without external access.
  All fetched data is stored locally — no calendar data leaves the HomeDash server.
- [x] **Mobile-first UI**: Calendar widget agenda view stacks vertically on mobile.
  Mini calendar month grid adapts to narrow viewports. Account management UI is
  scrollable on small screens. Config form uses responsive shadcn/ui components.
- [x] **Operability**: Sync errors logged via structured Pino entries with source ID and
  provider. Token refresh failures surface in the Connected Accounts UI with actionable
  "Reconnect" prompts. `lastSyncAt` and `lastSyncError` fields enable admin debugging.
- [x] **Testing & change safety**: Backend integration tests for OAuth callback flows (mocked
  providers), sync services, token encryption, and calendar event API. Frontend E2E tests
  for widget rendering, config form, and account connection flow. Three new DB migrations
  with Drizzle.

## Project Structure

### Documentation (this feature)

```text
specs/004-calendar-widget/
├── spec.md              # Feature specification
├── plan.md              # This file
├── tasks.md             # Implementation tasks
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
backend/
├── drizzle/
│   ├── 0003_oauth_accounts.sql           # NEW: oauth_accounts table
│   ├── 0004_calendar_sources.sql         # NEW: calendar_sources table
│   └── 0005_calendar_events.sql          # NEW: calendar_events table
├── src/
│   ├── config/
│   │   └── env.ts                        # MODIFY: add OAuth env vars (optional)
│   ├── db/
│   │   └── schema/index.ts              # MODIFY: add 3 new table schemas
│   ├── api/
│   │   ├── authOAuth.ts                 # NEW: OAuth initiation + callback routes
│   │   ├── adminCalendar.ts             # NEW: calendar source CRUD routes
│   │   └── userCalendar.ts              # NEW: calendar events read routes
│   ├── services/
│   │   ├── oauthService.ts              # NEW: OAuth token exchange, refresh, account CRUD
│   │   ├── calendarSyncService.ts       # NEW: generic sync orchestrator + scheduler
│   │   ├── microsoftCalendarService.ts  # NEW: Microsoft Graph API client
│   │   ├── googleCalendarService.ts     # NEW: Google Calendar API client
│   │   └── icalService.ts              # NEW: iCal fetch + parse service
│   ├── lib/
│   │   ├── tokenEncryption.ts          # NEW: AES-256-GCM encrypt/decrypt
│   │   └── validation.ts              # MODIFY: add CalendarConfigSchema, source schemas
│   └── auth/                           # No changes (existing middleware reused)
└── tests/
    └── integration/
        ├── oauthFlow.test.ts            # NEW: OAuth callback integration tests
        ├── calendarSync.test.ts         # NEW: sync service tests (mocked providers)
        ├── microsoftCalendar.test.ts    # NEW: Microsoft Graph API tests
        ├── googleCalendar.test.ts       # NEW: Google Calendar API tests
        ├── icalParser.test.ts           # NEW: iCal parsing tests
        └── tokenEncryption.test.ts      # NEW: encryption round-trip tests

frontend/
├── src/
│   ├── components/
│   │   ├── widgets/
│   │   │   ├── CalendarWidget.tsx        # NEW: calendar display component
│   │   │   ├── CalendarConfigForm.tsx    # NEW: calendar config form component
│   │   │   └── registry.tsx             # MODIFY: register 'calendar' widget type
│   │   ├── calendar/
│   │   │   ├── AgendaView.tsx            # NEW: chronological event list view
│   │   │   ├── MiniCalendarView.tsx      # NEW: month grid view with event dots
│   │   │   ├── EventCard.tsx             # NEW: single event display card
│   │   │   └── DayDetailPanel.tsx        # NEW: expanded day event list
│   │   └── settings/
│   │       ├── ConnectedAccounts.tsx     # NEW: OAuth account list + connect buttons
│   │       ├── ICalSourceForm.tsx        # NEW: add/edit iCal URL form
│   │       └── CalendarSourceList.tsx    # NEW: list all calendar sources
│   ├── state/
│   │   ├── calendarSources.ts           # NEW: TanStack Query hooks for sources
│   │   └── calendarEvents.ts            # NEW: TanStack Query hooks for events
│   ├── lib/
│   │   └── apiClient.ts                # No changes (existing client reused)
│   └── pages/
│       └── SettingsPage.tsx             # MODIFY: add Connected Accounts section
└── tests/
    └── e2e/
        ├── calendarWidget.spec.ts       # NEW: widget display E2E tests
        ├── calendarConfig.spec.ts       # NEW: widget config E2E tests
        └── oauthAccounts.spec.ts        # NEW: account connection E2E tests
```

**Structure Decision**: New route files (`authOAuth.ts`, `adminCalendar.ts`, `userCalendar.ts`)
follow the existing route group pattern in `backend/src/api/`. Calendar-specific frontend
components are in a new `frontend/src/components/calendar/` directory to keep the widget
directory focused on the registry-pattern files. Settings components go in a new
`frontend/src/components/settings/` directory.

## Architecture Overview

### Phase 1: OAuth2 Infrastructure

Build the foundational OAuth2 support that Microsoft and Google calendar integrations share.

**Database**: Three new Drizzle migrations adding `oauth_accounts`, `calendar_sources`, and
`calendar_events` tables. `oauth_accounts` stores encrypted tokens with `accessTokenEnc` and
`refreshTokenEnc` columns (AES-256-GCM ciphertext as hex strings). The `calendar_sources`
table links to `oauth_accounts` for OAuth sources and stores the URL directly for iCal sources.
`calendar_events` is a denormalized cache of provider events keyed by `(sourceId, providerEventId)`.

**Environment Variables**: Six new optional env vars in `backend/src/config/env.ts` using Zod
`.optional()` — `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Missing vars disable
the corresponding provider buttons in the frontend UI.

**Token Encryption**: New `backend/src/lib/tokenEncryption.ts` module using Node.js
`node:crypto` built-in. Derives a 256-bit key from `SESSION_SECRET` via HKDF. Encrypts with
AES-256-GCM, storing `iv:ciphertext:authTag` as a single hex string. Decryption reverses
the process. If `SESSION_SECRET` changes, tokens are unrecoverable — admin must reconnect.

**OAuth Routes**: New `backend/src/api/authOAuth.ts` with four routes:
- `GET /api/auth/oauth/microsoft` — generates state, stores in session, redirects to Microsoft
- `GET /api/auth/oauth/microsoft/callback` — validates state, exchanges code, stores account
- `GET /api/auth/oauth/google` — same pattern for Google
- `GET /api/auth/oauth/google/callback` — same pattern for Google
All routes require `requireAuth` (admin only). Callbacks redirect to frontend settings page.

**OAuth Service**: New `backend/src/services/oauthService.ts` handling token exchange
(POST to provider token endpoint), account upsert (create or update based on
`provider` + `providerAccountId`), token refresh, and account deletion with cascade.

### Phase 2: Microsoft Calendar Integration

**Microsoft Graph Client**: New `backend/src/services/microsoftCalendarService.ts` that
calls `GET https://graph.microsoft.com/v1.0/me/calendarView` with `startDateTime` and
`endDateTime` query parameters. Handles `@odata.nextLink` pagination. Maps Graph event
objects to the internal `CalendarEvent` shape. Uses the `oauthService` for transparent
token refresh.

**Sync Service**: New `backend/src/services/calendarSyncService.ts` providing a generic
`syncSource(sourceId)` function that dispatches to the appropriate provider client,
receives events, upserts into `calendar_events` (matched by `sourceId` + `providerEventId`),
and deletes events no longer in the provider response. Records `lastSyncAt` and any
`lastSyncError` on the source.

**Background Scheduler**: The sync service starts a `setInterval` loop on Fastify startup
(`onReady` hook) that checks `calendar_sources` for sources past their `syncIntervalSeconds`.
Each overdue source is synced sequentially. Shutdown hook clears the interval.

### Phase 3: Google Calendar Integration

**Google Calendar Client**: New `backend/src/services/googleCalendarService.ts` that calls
`GET https://www.googleapis.com/calendar/v3/calendars/primary/events` with `timeMin`,
`timeMax`, `singleEvents=true`, and `orderBy=startTime`. Handles `nextPageToken` pagination.
Maps Google event objects to `CalendarEvent`. Uses `oauthService` for token refresh.

The generic `calendarSyncService` from Phase 2 handles Google sources identically — the
sync orchestrator dispatches based on `source.type`.

### Phase 4: iCal/CalDAV Support

**iCal Service**: New `backend/src/services/icalService.ts` that:
1. Fetches the .ics URL via `fetch()` with timeout (30s) and size limit (5 MB)
2. Parses the response using an iCal parsing library (`ical.js` or `node-ical`)
3. Extracts VEVENT components, expanding recurring events (RRULE) within the sync window
4. Maps to `CalendarEvent` objects
5. Returns the event list to `calendarSyncService` for upsert

**URL Validation**: iCal URLs are validated to be HTTPS or HTTP-to-RFC1918/localhost only.
This allows internal CalDAV servers while blocking arbitrary HTTP endpoints.

### Phase 5: Calendar Widget Frontend

**CalendarWidget**: New `frontend/src/components/widgets/CalendarWidget.tsx` implementing
`WidgetDisplayProps`. Reads `configJson` for `sourceIds`, `viewMode`, `daysAhead`, and
`maxEvents`. Fetches events from `GET /api/user/calendar/events?sourceIds=...&from=...&to=...`
via TanStack Query with a 60-second stale time. Renders either `AgendaView` or
`MiniCalendarView` based on config.

**AgendaView**: New `frontend/src/components/calendar/AgendaView.tsx`. Groups events by day,
renders day headers with relative labels ("Today", "Tomorrow", "Wednesday, Apr 30").
Each event rendered as an `EventCard` with color bar, title, time range, and optional location.

**MiniCalendarView**: New `frontend/src/components/calendar/MiniCalendarView.tsx`. Renders
a 7×6 month grid with day numbers. Days with events show colored dots (up to 3 dots for
3+ sources). Clicking a day renders `DayDetailPanel` below the grid with that day's events.

**EventCard**: New `frontend/src/components/calendar/EventCard.tsx`. Compact event display
with left color border (source color), title, formatted time (respects timezone config),
and location line. All-day events show "All Day" instead of a time range.

### Phase 6: Widget Config & Account Management UI

**CalendarConfigForm**: New `frontend/src/components/widgets/CalendarConfigForm.tsx`
implementing `WidgetConfigFormProps`. Fetches available sources from `GET /api/user/calendar/sources`.
Multi-select checkboxes for sources (grouped by provider). View mode radio (Agenda/Calendar).
Numeric inputs for days ahead and max events. Toggle for show location.

**ConnectedAccounts**: New `frontend/src/components/settings/ConnectedAccounts.tsx`. Lists
OAuth accounts with provider icon, email, status badge, last sync time. "Connect Microsoft"
and "Connect Google" buttons (conditionally shown based on `/api/user/oauth/providers`
response). "Disconnect" button with confirmation dialog. Integrated into the settings page.

**ICalSourceForm**: New `frontend/src/components/settings/ICalSourceForm.tsx`. Form with
URL input, display name, color picker, and sync interval selector. Used for both add and edit.

**CalendarSourceList**: New `frontend/src/components/settings/CalendarSourceList.tsx`. Lists
all calendar sources (OAuth-backed + iCal) with source name, type badge, color swatch,
status, and actions (edit, sync now, enable/disable, delete).

### Phase 7: Integration & E2E Tests

**Backend Integration Tests**:
- `oauthFlow.test.ts` — OAuth callback with mocked provider token endpoints, state validation,
  token encryption verification, duplicate account handling
- `calendarSync.test.ts` — sync service with mocked provider responses, upsert/delete logic,
  error handling, scheduler behavior
- `microsoftCalendar.test.ts` — Graph API response parsing, pagination, event mapping
- `googleCalendar.test.ts` — Google API response parsing, pagination, event mapping
- `icalParser.test.ts` — .ics parsing for simple events, recurring events, all-day, multi-day,
  timezone handling, malformed input
- `tokenEncryption.test.ts` — encrypt/decrypt round-trip, key derivation consistency,
  tampered ciphertext detection

**Frontend E2E Tests**:
- `calendarWidget.spec.ts` — add calendar widget, view events in agenda mode, switch to
  mini calendar, verify event rendering
- `calendarConfig.spec.ts` — configure sources, change view mode, adjust days ahead
- `oauthAccounts.spec.ts` — connect account flow (mocked OAuth), disconnect flow

## Phase Dependencies

```
Phase 1: OAuth2 Infrastructure ──────────┬──► Phase 2: Microsoft Sync ──┐
                                         │                              │
                                         ├──► Phase 3: Google Sync ─────┤
                                         │                              │
                                         └──► Phase 4: iCal Support ────┤
                                                                        │
                                         Phase 5: Calendar Widget ◄─────┤
                                         (can start display w/ mock     │
                                          data, needs events API        │
                                          for integration)              │
                                                                        │
                                         Phase 6: Config & Accounts ◄───┤
                                         (needs sources API from        │
                                          Phase 1, events from 2-4)     │
                                                                        │
                                         Phase 7: E2E Tests ◄───────────┘
                                         (depends on all prior phases)
```

- **Phase 1** (OAuth Infrastructure): No dependencies — must start first
- **Phase 2** (Microsoft Sync): Depends on Phase 1 (oauth_accounts, token encryption)
- **Phase 3** (Google Sync): Depends on Phase 1; can parallel with Phase 2
- **Phase 4** (iCal Support): Depends on Phase 1 (calendar_sources table); can parallel with 2–3
- **Phase 5** (Widget Frontend): Can start UI with mock data; needs events API (Phase 1 tables + Phase 2–4 sync)
- **Phase 6** (Config & Account UI): Needs sources API from Phase 1; full integration needs 2–4
- **Phase 7** (E2E Tests): Depends on all prior phases

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| External API calls (Microsoft Graph, Google Calendar) | Core feature purpose — calendar events come from external providers | There is no LAN-only alternative for fetching events from cloud calendars |
| AES-256-GCM token encryption | OAuth refresh tokens are long-lived secrets that must be protected at rest | Storing tokens in plaintext would be a security vulnerability; relying on filesystem permissions alone is insufficient for a SQLite database |
| Background sync scheduler | Events must be cached locally for fast widget rendering; polling on every widget render would be slow and hit rate limits | Client-side polling would expose tokens to the frontend and bypass the LAN boundary |
| New npm dependency (iCal parser) | RFC 5545 iCal format is complex (RRULE, VTIMEZONE, etc.) — hand-rolling a parser is error-prone and unjustified | Writing a custom parser would be a multi-week effort with ongoing maintenance burden |

*OAuth2 adds significant complexity to this feature. This is justified because calendar integration with major providers is the entire purpose of the feature, and OAuth2 is the industry-standard authentication method required by both Microsoft and Google.*
