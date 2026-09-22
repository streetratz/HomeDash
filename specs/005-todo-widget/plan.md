# Implementation Plan: Todo / Checklist Widget

**Branch**: `005-todo-widget` | **Date**: 2026-04-24 | **Spec**: [spec.md](spec.md)
**Depends on**: `004-calendar-widget` (OAuth2 infrastructure, `oauth_accounts` table, token encryption, Microsoft OAuth routes)

## Summary

Deliver a Todo / Checklist widget for HomeDash with three task sources: local (standalone, no external deps), Microsoft To Do (via Graph API reusing 004's OAuth), and Apple Reminders (via CalDAV with app-specific passwords). The widget supports two-way sync for completion status, configurable sorting/grouping/filtering, and inline task creation for local lists. Implementation is phased so that local todo (Phases 1–2) is fully functional before any external integration work begins.

## Technical Context

**Language/Version**: TypeScript 5.5+ on Node.js ≥ 20 (pnpm 8+ monorepo)
**Primary Dependencies**:
- Backend: Fastify, Drizzle ORM, better-sqlite3, Zod
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, Lucide icons
- New (backend): `node-fetch` or native fetch for Microsoft Graph API calls; XML parser (e.g., `fast-xml-parser`) for CalDAV/iCalendar VTODO parsing
**Storage**: SQLite via better-sqlite3 / Drizzle ORM — three new tables (`todo_lists`, `todo_items`, `caldav_accounts`)
**Testing**: Vitest (backend integration), Playwright (frontend E2E)
**Target Platform**: Docker container on Synology NAS, LAN-only, host networking
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Env Vars**: Uses existing `SESSION_SECRET` for CalDAV password encryption. Uses 004's `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` for Microsoft Graph API.

## Constitution Check

*GATE: Must pass before implementation.*

- [x] **Secure-by-default**: CalDAV passwords encrypted at rest (AES-256-GCM via SESSION_SECRET).
  All mutations require `requireAdmin` + `assertCsrf`. Microsoft tokens managed by 004's
  infrastructure. CalDAV account GET endpoint excludes encrypted passwords. External API
  calls are server-side only.
- [x] **LAN-only boundary**: Dashboard operates on LAN. External calls (Microsoft Graph,
  CalDAV) are server-to-server only. Frontend never contacts external providers directly.
  Local todos have zero external dependencies.
- [x] **Mobile-first UI**: Todo widget uses scrollable list with 44×44px tap targets for
  checkboxes. Inline add input is thumb-reachable. Widget is responsive within
  react-grid-layout cells.
- [x] **Operability**: Graceful degradation when providers unreachable — shows cached data
  with "Last synced" timestamp. CalDAV credential validation on connect. Sync errors
  logged but don't crash the widget.
- [x] **Testing & change safety**: Backend integration tests for all CRUD endpoints and
  sync services. Frontend E2E tests for widget interaction. TDD for API routes.
  Database migrations are additive (new tables only).

## Project Structure

### Documentation (this feature)

```text
specs/005-todo-widget/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Implementation tasks
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
backend/
├── drizzle/
│   └── XXXX_add_todo_tables.sql         # NEW: migration for todo_lists, todo_items, caldav_accounts
├── src/
│   ├── db/
│   │   └── schema/index.ts              # EXTEND: add todo_lists, todo_items, caldav_accounts tables
│   ├── api/
│   │   ├── adminTodo.ts                 # NEW: CRUD routes for lists + items
│   │   ├── adminTodoSync.ts             # NEW: sync routes for Microsoft + CalDAV
│   │   ├── adminTodoCaldav.ts           # NEW: CalDAV account management routes
│   │   └── index.ts                     # EXTEND: register new route groups
│   ├── services/
│   │   ├── todoService.ts               # NEW: local todo CRUD business logic
│   │   ├── microsoftTodoService.ts      # NEW: Microsoft Graph Tasks API client + sync
│   │   ├── caldavService.ts             # NEW: CalDAV client (PROPFIND, REPORT, PUT)
│   │   ├── caldavAccountService.ts      # NEW: CalDAV account CRUD + credential encryption
│   │   └── todoSyncService.ts           # NEW: orchestrates sync across providers
│   ├── lib/
│   │   ├── caldavClient.ts              # NEW: low-level CalDAV HTTP client
│   │   ├── vtodoParser.ts              # NEW: iCalendar VTODO ↔ TodoItem mapper
│   │   └── validation.ts               # EXTEND: add todo Zod schemas
│   └── config/env.ts                    # NO CHANGES (uses existing SESSION_SECRET + 004's vars)
└── tests/
    └── integration/
        ├── todoLists.test.ts            # NEW: list CRUD tests
        ├── todoItems.test.ts            # NEW: item CRUD tests
        ├── todoSyncMicrosoft.test.ts    # NEW: Microsoft sync tests (mocked Graph API)
        ├── todoSyncCaldav.test.ts       # NEW: CalDAV sync tests (mocked CalDAV server)
        └── caldavAccounts.test.ts       # NEW: CalDAV account management tests

frontend/
├── src/
│   ├── components/
│   │   └── widgets/
│   │       ├── TodoWidget.tsx           # NEW: display component
│   │       ├── TodoConfigForm.tsx       # NEW: config form component
│   │       └── registry.tsx             # EXTEND: register 'todo' widget type
│   ├── components/
│   │   ├── TodoTaskItem.tsx             # NEW: individual task row (checkbox, title, badges)
│   │   ├── TodoListGroup.tsx            # NEW: list group header with color + provider icon
│   │   ├── TodoAddInput.tsx             # NEW: inline add task input
│   │   ├── CalDavAccountDialog.tsx      # NEW: connect Apple Reminders dialog
│   │   └── TodoAccountManager.tsx       # NEW: manage connected todo accounts
│   ├── state/
│   │   ├── todoQueries.ts              # NEW: TanStack Query hooks for todo data
│   │   └── todoMutations.ts            # NEW: TanStack Query mutation hooks
│   ├── lib/apiClient.ts                 # NO CHANGES
│   └── types/todo.ts                    # NEW: TypeScript interfaces for todo data
└── tests/
    └── e2e/
        ├── todoWidgetLocal.spec.ts      # NEW: local todo E2E tests
        ├── todoWidgetSync.spec.ts       # NEW: synced provider E2E tests
        └── todoWidgetConfig.spec.ts     # NEW: widget configuration E2E tests
```

**Structure Decision**: New route files (`adminTodo.ts`, `adminTodoSync.ts`, `adminTodoCaldav.ts`) follow the existing pattern of grouped admin routes registered in `backend/src/api/index.ts`. Services are split by provider responsibility. The CalDAV client is isolated in `lib/` for testability.

## Architecture Overview

### Phase 1: Local Todo Storage + API

**Goal**: Standalone local todo CRUD — works without any external providers.

**Database**: Add three new tables via Drizzle migration:
- `todo_lists` — user-owned task lists with name and color
- `todo_items` — individual tasks with title, notes, due date, priority, completion, ordering
- `caldav_accounts` — CalDAV credentials (created now, used in Phase 4)

**Service layer** (`todoService.ts`):
- `getListsForUser(userId)` — returns all todo lists for a user
- `createList(userId, { name, color })` — creates a new list
- `updateList(listId, { name?, color? })` — updates list metadata
- `deleteList(listId)` — cascade-deletes list and all items
- `getItemsForList(listId)` — returns items sorted by orderIndex
- `createItem(listId, { title, notes?, dueDate?, priority? })` — creates item with next orderIndex
- `updateItem(itemId, updates)` — updates any item fields
- `deleteItem(itemId)` — removes item
- `reorderItems(listId, items)` — batch-updates orderIndex values

**API routes** (`adminTodo.ts`):
- `GET /api/admin/todo/lists` → `requireAdmin`
- `POST /api/admin/todo/lists` → `requireAdmin` + `assertCsrf`
- `PUT /api/admin/todo/lists/:id` → `requireAdmin` + `assertCsrf`
- `DELETE /api/admin/todo/lists/:id` → `requireAdmin` + `assertCsrf`
- `GET /api/admin/todo/lists/:listId/items` → `requireAdmin`
- `POST /api/admin/todo/lists/:listId/items` → `requireAdmin` + `assertCsrf`
- `PUT /api/admin/todo/items/:id` → `requireAdmin` + `assertCsrf`
- `DELETE /api/admin/todo/items/:id` → `requireAdmin` + `assertCsrf`
- `PUT /api/admin/todo/lists/:listId/reorder` → `requireAdmin` + `assertCsrf`

### Phase 2: Todo Widget Frontend (Local Mode)

**Goal**: Widget that displays and interacts with local todos — fully functional without external providers.

**Widget registration** in `registry.tsx`:
```typescript
{
  type: 'todo',
  displayName: 'Todo List',
  description: 'Task lists with checkboxes — local or synced from Microsoft To Do / Apple Reminders',
  icon: CheckSquare,
  defaultConfig: { selectedListIds: [], sortBy: 'manual', groupByList: false, maxItems: 50, showCompleted: true },
  DisplayComponent: TodoWidget,
  ConfigFormComponent: TodoConfigForm,
}
```

**Display component** (`TodoWidget.tsx`):
- Fetches todo lists and items via TanStack Query
- Renders `TodoListGroup` headers when grouping enabled
- Renders `TodoTaskItem` rows with checkboxes
- Renders `TodoAddInput` at bottom (local lists only)
- Handles optimistic complete/uncomplete mutations
- Shows empty state when no tasks

**Config form** (`TodoConfigForm.tsx`):
- Multi-select list of available lists with checkboxes
- Sort order dropdown (due date, priority, created, manual)
- Group by list toggle
- Max items number input
- Show completed toggle

### Phase 3: Microsoft To Do Sync

**Goal**: Fetch and sync tasks from Microsoft To Do via Graph API, reusing 004's OAuth.

**Prerequisite**: 004-calendar-widget is implemented. `oauth_accounts` table exists. Microsoft OAuth flow works. Token refresh is available.

**Microsoft To Do service** (`microsoftTodoService.ts`):
- `getMicrosoftTaskLists(oauthAccountId)` — `GET /me/todo/lists` via Graph API
- `getMicrosoftTasks(oauthAccountId, listId)` — `GET /me/todo/lists/{listId}/tasks`
- `completeMicrosoftTask(oauthAccountId, listId, taskId)` — `PATCH` with `{ status: 'completed' }`
- `uncompleteMicrosoftTask(oauthAccountId, listId, taskId)` — `PATCH` with `{ status: 'notStarted' }`
- Uses token refresh from 004's infrastructure
- Maps Graph API task format to TodoItem model

**Sync orchestration** (`todoSyncService.ts`):
- `syncMicrosoftTodo(userId)` — fetches all lists/tasks, upserts into `todo_lists`/`todo_items`
- Deduplicates by `providerItemId`
- Detects deleted tasks (present in cache but missing from API) and marks them
- Records `lastSyncedAt` timestamp

**API routes** (`adminTodoSync.ts`):
- `POST /api/admin/todo/sync/microsoft` → `requireAdmin` + `assertCsrf` — triggers Microsoft sync
- `GET /api/admin/todo/providers/microsoft/lists` → `requireAdmin` — lists available Microsoft To Do lists

### Phase 4: Apple Reminders (CalDAV)

**Goal**: Connect Apple Reminders via CalDAV, fetch/sync VTODO items.

**CalDAV client** (`caldavClient.ts`):
- Low-level HTTP client for CalDAV operations
- `propfind(url, depth, body)` — PROPFIND request
- `report(url, body)` — REPORT request (calendar-query)
- `put(url, body, etag)` — PUT request for updating VTODOs
- Handles Basic auth with decrypted credentials
- All requests use HTTPS

**VTODO parser** (`vtodoParser.ts`):
- Parses iCalendar VTODO components from CalDAV REPORT responses
- Maps VTODO fields to TodoItem: SUMMARY→title, DESCRIPTION→notes, DUE→dueDate, PRIORITY→priority, STATUS→completed, UID→providerItemId
- Generates VTODO from TodoItem for write-back (completion status)

**CalDAV account service** (`caldavAccountService.ts`):
- `connectAccount(userId, { serverUrl, username, password })` — validates credentials via PROPFIND, encrypts password, saves to `caldav_accounts`
- `disconnectAccount(accountId)` — deletes account + cascade-deletes cached tasks
- `getAccounts(userId)` — returns accounts WITHOUT encrypted passwords
- `getDecryptedPassword(accountId)` — internal use only, decrypts for CalDAV requests

**CalDAV sync** (`caldavService.ts`):
- `discoverCalendars(accountId)` — PROPFIND to find calendar collections with VTODO support
- `fetchTodos(accountId, calendarUrl)` — REPORT calendar-query for VTODOs
- `syncCaldavTodos(userId)` — orchestrates full sync: discover → fetch → upsert cache
- `completeCaldavTask(accountId, todoUid)` — PUT updated VTODO with COMPLETED status
- `uncompleteCaldavTask(accountId, todoUid)` — PUT updated VTODO with NEEDS-ACTION status

**API routes** (`adminTodoCaldav.ts`):
- `GET /api/admin/todo/caldav/accounts` → `requireAdmin`
- `POST /api/admin/todo/caldav/accounts` → `requireAdmin` + `assertCsrf`
- `DELETE /api/admin/todo/caldav/accounts/:id` → `requireAdmin` + `assertCsrf`
- `POST /api/admin/todo/sync/caldav` → `requireAdmin` + `assertCsrf`
- `GET /api/admin/todo/providers/caldav/lists` → `requireAdmin` — lists available CalDAV calendars

### Phase 5: Account Management & Config UI

**Goal**: UI for connecting/disconnecting accounts and configuring the widget with lists from all sources.

**CalDAV account dialog** (`CalDavAccountDialog.tsx`):
- Form with: server URL (pre-filled `https://caldav.icloud.com`), username (Apple ID email), password (app-specific password)
- Link to Apple's app-specific password page
- "Test Connection" button before saving
- Loading/error/success states

**Account manager** (`TodoAccountManager.tsx`):
- Shows connected Microsoft accounts (from 004) with To Do list count
- Shows connected CalDAV accounts with reminder list count
- "Connect Apple Reminders" button opens CalDavAccountDialog
- "Connect Microsoft" links to 004's OAuth flow
- Disconnect buttons with confirmation

**Enhanced config form** (`TodoConfigForm.tsx` update):
- Lists from all sources: local (📋 icon), Microsoft (Microsoft icon), Apple (Apple icon)
- Each list shows provider badge and task count
- "Manage Accounts" link at the bottom of list selector

### Phase 6: Integration & E2E Tests

**Goal**: Comprehensive test coverage across all features.

**Backend integration tests**:
- `todoLists.test.ts` — CRUD for lists, auth enforcement, cascade delete
- `todoItems.test.ts` — CRUD for items, reorder, complete/uncomplete, auth/CSRF
- `todoSyncMicrosoft.test.ts` — Microsoft sync with mocked Graph API responses
- `todoSyncCaldav.test.ts` — CalDAV sync with mocked CalDAV server responses
- `caldavAccounts.test.ts` — account CRUD, credential validation, password exclusion from GET

**Frontend E2E tests**:
- `todoWidgetLocal.spec.ts` — add widget, create list, add/complete/delete tasks, reorder, reload persistence
- `todoWidgetSync.spec.ts` — mock synced tasks display, completion sync, error states, cached data
- `todoWidgetConfig.spec.ts` — list selection, sort/group/filter config, max items

## Phase Dependencies

```
Phase 1: Local Storage + API ──► Phase 2: Widget Frontend (Local) ──┐
                                                                     ├──► Phase 5: Account Mgmt UI ──► Phase 6: Tests
Phase 3: Microsoft To Do Sync ──────────────────────────────────────┤
Phase 4: Apple Reminders CalDAV ────────────────────────────────────┘
```

**Key relationships**:
- **Phases 1–2 are standalone**: Local todo works without 004 or any external providers. This is the MVP.
- **Phase 3 depends on 004**: Requires `oauth_accounts` table, Microsoft OAuth flow, and token refresh.
- **Phase 4 depends on Phase 1**: Uses `todo_items` table and encryption utilities (from 004).
- **Phase 3 and 4 are parallel**: Microsoft and CalDAV integrations are independent of each other.
- **Phase 5 depends on 3 + 4**: Config UI needs to know about all available providers.
- **Phase 6 depends on all**: Tests cover the complete feature set.

**004 dependency boundary**: Phases 1–2 can be implemented and merged independently. Phases 3–5 require 004 to be merged first. Phase 4 requires the encryption utilities from 004 but not the Microsoft OAuth (it uses CalDAV Basic auth).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| CalDAV XML parsing | Required by CalDAV protocol (RFC 4791) — responses are XML with iCalendar payloads | No simpler protocol for Apple Reminders exists; CalDAV is the only non-proprietary option |
| Background sync polling | External providers don't support webhooks to LAN devices | Real-time push requires public endpoints (not available on LAN) |
| Dual encryption (CalDAV passwords + OAuth tokens) | CalDAV uses stored passwords; Microsoft uses OAuth tokens — different credential types | Unifying on OAuth would require Apple developer program membership (not available for personal use) |

*All other patterns reuse existing infrastructure — no unnecessary complexity.*
