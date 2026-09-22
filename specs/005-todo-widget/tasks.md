# Tasks: Todo / Checklist Widget

**Input**: Design documents from `/specs/005-todo-widget/`
**Prerequisites**: plan.md ✓, spec.md ✓
**Dependency**: 004-calendar-widget must be merged before starting Phase 3+

**Tests**: Backend integration tests written TDD-style (test first, then implement). Frontend E2E tests in Phase 6.

**Organization**: Tasks grouped by phase. Phases 1–2 are standalone (no 004 dependency). Phases 3–4 depend on 004. Phase 5 integrates all sources. Phase 6 covers E2E and security testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `backend/src/`, `frontend/src/`, `backend/tests/`, `frontend/tests/`

---

## Phase 1: Local Todo Storage + API

**Purpose**: Create the database tables, service layer, and CRUD API routes for local todo lists and items. This is the foundation that all other phases build on. No external dependencies — works standalone.

### Database & Schema

- [x] T001 [P] [US1] Add `todo_lists`, `todo_items`, and `caldav_accounts` tables to Drizzle schema: In `backend/src/db/schema/index.ts`, add three new table definitions:
  - `todo_lists`: `id` (text PK, UUID), `userId` (text, FK → users, NOT NULL), `name` (text, NOT NULL), `color` (text, nullable, hex color), `providerType` (text, enum 'local'|'microsoft'|'apple', default 'local'), `providerListId` (text, nullable — external list ID for synced lists), `oauthAccountId` (text, nullable, FK → oauth_accounts for Microsoft lists), `caldavAccountId` (text, nullable, FK → caldav_accounts for Apple lists), `lastSyncedAt` (text, nullable, ISO8601), `createdAt` (text, NOT NULL, ISO8601), `updatedAt` (text, NOT NULL, ISO8601). Index on `userId`.
  - `todo_items`: `id` (text PK, UUID), `listId` (text, FK → todo_lists, NOT NULL), `title` (text, NOT NULL), `notes` (text, nullable), `dueDate` (text, nullable, ISO8601), `priority` (integer, NOT NULL, default 0), `completed` (integer, NOT NULL, default 0), `completedAt` (text, nullable, ISO8601), `orderIndex` (integer, NOT NULL), `providerItemId` (text, nullable), `createdAt` (text, NOT NULL, ISO8601), `updatedAt` (text, NOT NULL, ISO8601). Index on `listId`. Index on `providerItemId`.
  - `caldav_accounts`: `id` (text PK, UUID), `userId` (text, FK → users, NOT NULL), `serverUrl` (text, NOT NULL), `username` (text, NOT NULL), `encryptedPassword` (text, NOT NULL), `displayName` (text, nullable), `createdAt` (text, NOT NULL, ISO8601), `updatedAt` (text, NOT NULL, ISO8601). Index on `userId`.
  - Add Drizzle `relations()` for all foreign keys. Generate migration via `pnpm drizzle-kit generate` and verify it lands in `backend/drizzle/`.

### Service Layer

- [x] T002 [P] [US1] Create `todoService.ts` with local CRUD operations: In `backend/src/services/todoService.ts`, implement:
  - `getListsForUser(userId: string): TodoList[]` — select all from `todo_lists` where userId matches, ordered by createdAt
  - `createList(userId: string, input: { name: string, color?: string }): TodoList` — insert with generated UUID, providerType='local', return created row
  - `updateList(listId: string, input: { name?: string, color?: string }): TodoList` — update matching row, set updatedAt, return updated row. Throw NotFound if missing.
  - `deleteList(listId: string): void` — delete all items in list first (cascade), then delete list. Throw NotFound if missing. Wrap in transaction.
  - `getItemsForList(listId: string, includeCompleted?: boolean): TodoItem[]` — select from `todo_items` where listId matches, optionally filter out completed, order by orderIndex
  - `createItem(listId: string, input: { title: string, notes?: string, dueDate?: string, priority?: number }): TodoItem` — calculate next orderIndex (max + 1), insert with generated UUID, providerType='local', return created row. Validate listId exists.
  - `updateItem(itemId: string, input: Partial<TodoItemUpdate>): TodoItem` — update matching row. If `completed` changes to true, set `completedAt` to now. If `completed` changes to false, clear `completedAt`. Set updatedAt. Return updated row.
  - `deleteItem(itemId: string): void` — delete item. Throw NotFound if missing.
  - `reorderItems(listId: string, items: { id: string, orderIndex: number }[]): void` — batch update orderIndex for all items in the list. Wrap in transaction.
  - Define TypeScript interfaces: `TodoList`, `TodoItem`, `TodoItemUpdate`, `CreateListInput`, `CreateItemInput`.

### Zod Validation Schemas

- [x] T003 [P] [US1] Add Zod validation schemas for todo API inputs: In `backend/src/lib/validation.ts`, add:
  - `CreateTodoListSchema`: `{ name: z.string().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }`
  - `UpdateTodoListSchema`: `{ name: z.string().min(1).max(100).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() }`
  - `CreateTodoItemSchema`: `{ title: z.string().min(1).max(500), notes: z.string().max(5000).optional(), dueDate: z.string().datetime().optional(), priority: z.number().int().min(0).max(3).optional() }`
  - `UpdateTodoItemSchema`: `{ title, notes, dueDate, priority (all optional), completed: z.boolean().optional(), orderIndex: z.number().int().min(0).optional() }`
  - `ReorderItemsSchema`: `{ items: z.array(z.object({ id: z.string().uuid(), orderIndex: z.number().int().min(0) })).min(1) }`

### API Routes

- [x] T004 [US1] Create `adminTodo.ts` route group with CRUD endpoints: In `backend/src/api/adminTodo.ts`, implement:
  - `GET /api/admin/todo/lists` — `requireAdmin(request, reply)`, call `getListsForUser(request.userId)`, return 200 with list array
  - `POST /api/admin/todo/lists` — `requireAdmin` + `assertCsrf`, validate body with `CreateTodoListSchema`, call `createList`, return 201
  - `PUT /api/admin/todo/lists/:id` — `requireAdmin` + `assertCsrf`, validate body with `UpdateTodoListSchema`, call `updateList`, return 200
  - `DELETE /api/admin/todo/lists/:id` — `requireAdmin` + `assertCsrf`, call `deleteList`, return 204
  - `GET /api/admin/todo/lists/:listId/items` — `requireAdmin`, query param `includeCompleted` (default true), call `getItemsForList`, return 200
  - `POST /api/admin/todo/lists/:listId/items` — `requireAdmin` + `assertCsrf`, validate body with `CreateTodoItemSchema`, call `createItem`, return 201
  - `PUT /api/admin/todo/items/:id` — `requireAdmin` + `assertCsrf`, validate body with `UpdateTodoItemSchema`, call `updateItem`, return 200
  - `DELETE /api/admin/todo/items/:id` — `requireAdmin` + `assertCsrf`, call `deleteItem`, return 204
  - `PUT /api/admin/todo/lists/:listId/reorder` — `requireAdmin` + `assertCsrf`, validate body with `ReorderItemsSchema`, call `reorderItems`, return 204
  - Register the route group in `backend/src/api/index.ts`.

### Integration Tests

- [x] T005 [P] [US1] Write integration tests for todo list CRUD: In `backend/tests/integration/todoLists.test.ts`:
  - Test `GET /api/admin/todo/lists` returns 401 without auth, returns empty array initially, returns created lists after POST
  - Test `POST /api/admin/todo/lists` returns 403 without CSRF, returns 400 with invalid body (empty name, name > 100 chars, invalid color format), returns 201 with valid body
  - Test `PUT /api/admin/todo/lists/:id` returns 404 for non-existent ID, returns 200 with updated fields
  - Test `DELETE /api/admin/todo/lists/:id` returns 204, verify cascade-deletes items, verify list no longer in GET response

- [x] T006 [P] [US1] Write integration tests for todo item CRUD: In `backend/tests/integration/todoItems.test.ts`:
  - Test `GET /api/admin/todo/lists/:listId/items` returns items sorted by orderIndex, respects includeCompleted filter
  - Test `POST /api/admin/todo/lists/:listId/items` creates item with auto-incremented orderIndex, validates required title, validates priority range
  - Test `PUT /api/admin/todo/items/:id` updates title/notes/dueDate/priority, toggles completed flag and sets/clears completedAt
  - Test `DELETE /api/admin/todo/items/:id` removes item, returns 404 for non-existent
  - Test `PUT /api/admin/todo/lists/:listId/reorder` updates orderIndex for all items in batch, validates within transaction
  - All mutations verify auth (401) and CSRF (403)

**Checkpoint**: Local todo CRUD is fully functional. Lists and items can be created, read, updated, deleted, and reordered via the API. All integration tests pass. US1 backend is complete.

---

## Phase 2: Todo Widget Frontend (Local Mode)

**Purpose**: Build the widget display component, config form, and register it in the widget system. Fully functional with only local todos — no external providers needed.

### TypeScript Types

- [x] T007 [P] [US1/US5] Create todo TypeScript interfaces: In `frontend/src/types/todo.ts`, define:
  - `TodoList`: `{ id, userId, name, color, providerType, providerListId, lastSyncedAt, createdAt, updatedAt }`
  - `TodoItem`: `{ id, listId, title, notes, dueDate, priority, completed, completedAt, orderIndex, providerItemId, createdAt, updatedAt }`
  - `TodoWidgetConfig`: `{ selectedListIds: string[], sortBy: 'dueDate' | 'priority' | 'createdAt' | 'manual', groupByList: boolean, maxItems: number, showCompleted: boolean }`
  - `TodoProvider`: `'local' | 'microsoft' | 'apple'`

### TanStack Query Hooks

- [x] T008 [P] [US1] Create TanStack Query hooks for todo data: In `frontend/src/state/todoQueries.ts`:
  - `useTodoLists()` — `GET /api/admin/todo/lists`, returns `TodoList[]`
  - `useTodoItems(listId: string, includeCompleted?: boolean)` — `GET /api/admin/todo/lists/:listId/items`
  - `useAllTodoItems(listIds: string[], includeCompleted?: boolean)` — fetches items for multiple lists in parallel
  In `frontend/src/state/todoMutations.ts`:
  - `useCreateList()` — POST mutation, invalidates lists query
  - `useUpdateList()` — PUT mutation, invalidates lists query
  - `useDeleteList()` — DELETE mutation, invalidates lists query
  - `useCreateItem()` — POST mutation, invalidates items query for the list
  - `useUpdateItem()` — PUT mutation with optimistic update (toggle completed immediately), invalidates items query on settle
  - `useDeleteItem()` — DELETE mutation, invalidates items query
  - `useReorderItems()` — PUT mutation with optimistic reorder

### Widget Components

- [x] T009 [US1] Create `TodoTaskItem` component: In `frontend/src/components/TodoTaskItem.tsx`:
  - Props: `item: TodoItem`, `onToggleComplete: (id, completed) => void`, `onDelete: (id) => void`
  - Renders: shadcn/ui Checkbox (44×44px tap target), task title (strikethrough + muted when complete), due date badge (red if overdue, yellow if today, gray if future, hidden if no date), priority badge (🔴/🟡/🔵/hidden), provider icon (local=CheckSquare, microsoft=Microsoft logo, apple=Apple logo), delete button (trash icon, visible on hover/focus)
  - Checkbox click calls `onToggleComplete`
  - Use `cn()` utility for conditional Tailwind classes

- [x] T010 [US1] Create `TodoAddInput` component: In `frontend/src/components/TodoAddInput.tsx`:
  - Props: `listId: string`, `onAdd: (listId, title) => void`
  - Renders: text input with placeholder "Add a task...", styled as a subtle inline row matching task item height
  - On Enter press: calls `onAdd` if input is non-empty, clears input
  - On Escape: clears input and blurs
  - Only rendered for local lists (providerType === 'local')

- [x] T011 [US1/US5] Create `TodoWidget` display component and `TodoConfigForm`: In `frontend/src/components/widgets/TodoWidget.tsx`:
  - Props: `{ widget: WidgetView }` (standard widget props)
  - Reads config from `widget.configJson` as `TodoWidgetConfig`
  - Uses `useAllTodoItems` to fetch items for `selectedListIds`
  - Applies sorting (sortBy config), filtering (showCompleted config), and truncation (maxItems config)
  - If `groupByList` enabled: groups items by listId, renders `TodoListGroup` header (list name + color bar + provider icon) above each group
  - If `groupByList` disabled: renders flat list of `TodoTaskItem` components
  - Renders `TodoAddInput` at bottom for each local list (or single input if not grouped)
  - Empty state: "No tasks yet" with add input visible
  - Error state: "Failed to load tasks" with retry button
  In `frontend/src/components/widgets/TodoConfigForm.tsx`:
  - Props: `{ config: unknown, onChange: (config: unknown) => void }` (standard config form props)
  - Fetches available lists via `useTodoLists()`
  - Renders: multi-select checkboxes for each list (name + color dot + provider badge), sort order select (Due Date / Priority / Created / Manual), group by list toggle (shadcn Switch), max items number input (min 1, max 200, default 50), show completed toggle (shadcn Switch)
  - Calls `onChange` on every field change with the full updated config object

### Widget Registration

- [x] T012 [US1] Register 'todo' widget type in the registry: In `frontend/src/components/widgets/registry.tsx`:
  - Import `TodoWidget` from `./TodoWidget`
  - Import `TodoConfigForm` from `./TodoConfigForm`
  - Import `CheckSquare` from `lucide-react`
  - Add entry to the widget registry Map with key `'todo'`:
    ```
    type: 'todo',
    displayName: 'Todo List',
    description: 'Task lists with checkboxes',
    icon: CheckSquare,
    defaultConfig: { selectedListIds: [], sortBy: 'manual', groupByList: false, maxItems: 50, showCompleted: true },
    DisplayComponent: TodoWidget,
    ConfigFormComponent: TodoConfigForm,
    ```

**Checkpoint**: Admin can add a Todo widget, create a local list, add/complete/reorder/delete tasks, and configure the widget display. Everything persists after reload. US1 and US5 (local mode) are fully functional. No external dependencies.

---

## Phase 3: Microsoft To Do Sync

**Purpose**: Integrate Microsoft To Do via Graph API. Reuses OAuth accounts from 004-calendar-widget. Enables two-way completion sync.

**⚠️ Prerequisite**: 004-calendar-widget must be merged. `oauth_accounts` table, token encryption, Microsoft OAuth routes, and `MICROSOFT_*` env vars must exist.

### Microsoft To Do Service

- [x] T013 [US2] Create `microsoftTodoService.ts` for Graph API interactions: In `backend/src/services/microsoftTodoService.ts`:
  - Import token refresh utilities from 004's OAuth infrastructure
  - `getMicrosoftTaskLists(oauthAccountId: string): MicrosoftTaskList[]` — GET `https://graph.microsoft.com/v1.0/me/todo/lists` using access token from oauth_accounts. Map response to `{ id, displayName, isOwner }[]`. Handle 401 by refreshing token and retrying once.
  - `getMicrosoftTasks(oauthAccountId: string, listId: string, includeCompleted?: boolean): MicrosoftTask[]` — GET `https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks` with optional `$filter=status ne 'completed'`. Map response to `{ id, title, body, dueDateTime, importance, status }[]`.
  - `updateMicrosoftTaskStatus(oauthAccountId: string, listId: string, taskId: string, completed: boolean): void` — PATCH `https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks/{taskId}` with `{ status: completed ? 'completed' : 'notStarted' }`.
  - Handle rate limiting (429) by respecting Retry-After header.
  - Define interfaces: `MicrosoftTaskList`, `MicrosoftTask`.

### Sync Orchestration

- [x] T014 [US2] Create `todoSyncService.ts` for Microsoft sync orchestration: In `backend/src/services/todoSyncService.ts`:
  - `syncMicrosoftTodoForUser(userId: string): SyncResult` — for each Microsoft oauth_account belonging to userId:
    1. Fetch task lists via `getMicrosoftTaskLists`
    2. Upsert `todo_lists` rows with `providerType='microsoft'`, `providerListId=list.id`, `oauthAccountId`
    3. For each list, fetch tasks via `getMicrosoftTasks`
    4. Upsert `todo_items` rows: match by `providerItemId`, update title/notes/dueDate/priority/completed, insert new items, soft-mark removed items
    5. Update `lastSyncedAt` on each list
    6. Return `{ listssynced: number, itemsSynced: number, errors: string[] }`
  - Map Microsoft `importance` (low/normal/high) to priority (1/0/3)
  - Map Microsoft `dueDateTime` to ISO8601 dueDate
  - Wrap all upserts in a transaction per account

### Sync API Routes

- [x] T015 [US2] Add Microsoft sync routes: In `backend/src/api/adminTodoSync.ts`:
  - `POST /api/admin/todo/sync/microsoft` — `requireAdmin` + `assertCsrf`, call `syncMicrosoftTodoForUser(request.userId)`, return 200 with sync result
  - `GET /api/admin/todo/providers/microsoft/lists` — `requireAdmin`, fetch Microsoft task lists (live from API, not cached) for account selection in the config UI
  - Register route group in `backend/src/api/index.ts`

### Integration Tests (Mocked)

- [x] T016 [P] [US2] Write integration tests for Microsoft sync: In `backend/tests/integration/todoSyncMicrosoft.test.ts`:
  - Mock Microsoft Graph API responses (use `msw` or `nock` or manual fetch mock)
  - Test `syncMicrosoftTodoForUser` creates lists and items from mocked API response
  - Test sync updates existing items when API response changes
  - Test sync handles token refresh (401 → refresh → retry)
  - Test sync handles rate limiting (429 with Retry-After)
  - Test completing a task calls PATCH with correct status
  - Test uncompleting a task calls PATCH with 'notStarted'
  - Test sync endpoint returns 401 without auth, 403 without CSRF

**Checkpoint**: Microsoft To Do lists and tasks sync to local cache. Completing/uncompleting a task syncs back to Microsoft. Sync can be triggered manually. US2 is functionally complete.

---

## Phase 4: Apple Reminders (CalDAV)

**Purpose**: Connect Apple Reminders via CalDAV protocol. Store credentials encrypted. Parse VTODO components. Enable two-way completion sync.

**⚠️ Prerequisite**: 004-calendar-widget's encryption utilities (AES-256-GCM with SESSION_SECRET) must exist.

### CalDAV Client

- [DEFERRED] T017 [P] [US3] Create low-level CalDAV HTTP client: In `backend/src/lib/caldavClient.ts`:
  - `propfind(url: string, depth: 0|1, body: string, auth: { username: string, password: string }): Promise<string>` — sends HTTP PROPFIND request with `Depth` header and `Content-Type: application/xml`, returns XML response body. Enforce HTTPS (reject http:// URLs).
  - `report(url: string, body: string, auth: { username: string, password: string }): Promise<string>` — sends HTTP REPORT request (calendar-query) with XML body, returns XML response.
  - `put(url: string, body: string, etag: string | undefined, auth: { username: string, password: string }): Promise<void>` — sends HTTP PUT with `Content-Type: text/calendar`, optional `If-Match` header for etag.
  - All methods: set `User-Agent: HomeDash/1.0`, handle HTTP errors (401 → throw AuthError, 404 → throw NotFoundError, 5xx → throw ServerError), timeout after 30 seconds.

### VTODO Parser

- [DEFERRED] T018 [P] [US3] Create iCalendar VTODO parser: In `backend/src/lib/vtodoParser.ts`:
  - `parseVtodosFromCalDav(xmlResponse: string): ParsedVtodo[]` — parse CalDAV REPORT XML response, extract `<cal:calendar-data>` elements, parse each iCalendar body to extract VTODO components.
  - `vtodoToTodoItem(vtodo: ParsedVtodo): Partial<TodoItem>` — map: `SUMMARY` → title, `DESCRIPTION` → notes, `DUE` → dueDate (convert to ISO8601), `PRIORITY` → priority (iCal 1=high→3, 5=medium→2, 9=low→1, 0=none→0), `STATUS` (COMPLETED→true, NEEDS-ACTION→false) → completed, `COMPLETED` → completedAt, `UID` → providerItemId.
  - `todoItemToVtodo(item: TodoItem, existingVcal?: string): string` — generate minimal iCalendar document with VTODO component for write-back. If existingVcal provided, update STATUS and COMPLETED fields in-place (preserving other properties).
  - Define `ParsedVtodo` interface.
  - Use `fast-xml-parser` (add to backend dependencies) for XML parsing.

### CalDAV Account Service

- [DEFERRED] T019 [US3] Create `caldavAccountService.ts` for account CRUD + encryption: In `backend/src/services/caldavAccountService.ts`:
  - Import encryption utilities from 004 (AES-256-GCM with SESSION_SECRET)
  - `connectAccount(userId: string, input: { serverUrl: string, username: string, password: string, displayName?: string }): CalDavAccount` — validate serverUrl is HTTPS, encrypt password, test connection via `propfind(serverUrl, 0, ...)` with credentials, if successful save to `caldav_accounts`, return account (without password). On auth failure, throw descriptive error.
  - `disconnectAccount(accountId: string): void` — delete account + cascade-delete all `todo_lists` with `caldavAccountId=accountId` + their items. Wrap in transaction.
  - `getAccounts(userId: string): CalDavAccountSafe[]` — return accounts WITHOUT `encryptedPassword` field.
  - `getDecryptedPassword(accountId: string): string` — internal use: fetch account, decrypt password, return plain text. Never exposed via API.
  - Zod schemas: `ConnectCaldavAccountSchema` — `{ serverUrl: z.string().url().startsWith('https://'), username: z.string().min(1), password: z.string().min(1), displayName: z.string().max(100).optional() }`

### CalDAV Sync Service

- [DEFERRED] T020 [US3/US4] Create `caldavService.ts` for CalDAV sync operations: In `backend/src/services/caldavService.ts`:
  - `discoverCalendars(accountId: string): CalDavCalendar[]` — PROPFIND depth:1 on the principal URL, find calendar collections that support VTODO (`<comp name="VTODO"/>`), return `{ url, displayName, color }[]`.
  - `fetchTodos(accountId: string, calendarUrl: string): ParsedVtodo[]` — REPORT calendar-query on the calendar URL requesting VTODO components, parse via `vtodoParser`.
  - `syncCaldavForUser(userId: string): SyncResult` — for each caldav_account: discover calendars → fetch todos → upsert `todo_lists` (providerType='apple', caldavAccountId) → upsert `todo_items` (providerItemId=UID) → update lastSyncedAt. Return sync result.
  - `completeCaldavTask(accountId: string, calendarUrl: string, todoUid: string): void` — fetch current VTODO, update STATUS to COMPLETED + add COMPLETED timestamp, PUT back.
  - `uncompleteCaldavTask(accountId: string, calendarUrl: string, todoUid: string): void` — fetch current VTODO, update STATUS to NEEDS-ACTION + remove COMPLETED, PUT back.

### CalDAV API Routes

- [DEFERRED] T021 [US3] Create `adminTodoCaldav.ts` route group: In `backend/src/api/adminTodoCaldav.ts`:
  - `GET /api/admin/todo/caldav/accounts` — `requireAdmin`, call `getAccounts(request.userId)`, return 200 (no passwords in response)
  - `POST /api/admin/todo/caldav/accounts` — `requireAdmin` + `assertCsrf`, validate with `ConnectCaldavAccountSchema`, call `connectAccount`, return 201
  - `DELETE /api/admin/todo/caldav/accounts/:id` — `requireAdmin` + `assertCsrf`, call `disconnectAccount`, return 204
  - `POST /api/admin/todo/sync/caldav` — `requireAdmin` + `assertCsrf`, call `syncCaldavForUser(request.userId)`, return 200 with sync result
  - `GET /api/admin/todo/providers/caldav/lists` — `requireAdmin`, discover calendars for all connected accounts, return list for config UI
  - Register route group in `backend/src/api/index.ts`

### Integration Tests (Mocked)

- [DEFERRED] T022 [P] [US3] Write integration tests for CalDAV accounts and sync: In `backend/tests/integration/caldavAccounts.test.ts`:
  - Test `POST /api/admin/todo/caldav/accounts` validates HTTPS URL, rejects invalid credentials (mock PROPFIND 401), saves on valid credentials
  - Test `GET /api/admin/todo/caldav/accounts` returns accounts WITHOUT encryptedPassword field
  - Test `DELETE /api/admin/todo/caldav/accounts/:id` cascade-deletes lists and items
  - Test auth (401) and CSRF (403) on all mutation endpoints
  In `backend/tests/integration/todoSyncCaldav.test.ts`:
  - Mock CalDAV server responses (PROPFIND, REPORT, PUT)
  - Test sync creates lists and items from mocked VTODO responses
  - Test VTODO parsing: SUMMARY, DUE, PRIORITY mapping, STATUS mapping
  - Test completion sync sends correct PUT with updated VTODO
  - Test sync handles unreachable server gracefully (returns error, preserves cache)

**Checkpoint**: Apple Reminders can be connected via CalDAV credentials. Tasks sync from iCloud. Completing/uncompleting tasks syncs back via CalDAV PUT. Credentials are encrypted at rest. US3 and US4 (Apple path) are complete.

---

## Phase 5: Account Management & Config UI

**Purpose**: Frontend UI for connecting/disconnecting todo provider accounts and enhanced widget configuration showing lists from all sources.

### Account Management

- [DEFERRED] T023 [US3/US5] Create `CalDavAccountDialog` component: In `frontend/src/components/CalDavAccountDialog.tsx`:
  - shadcn/ui Dialog with form fields: Server URL (pre-filled `https://caldav.icloud.com`, editable), Username (Apple ID email), Password (app-specific password, type=password)
  - Link text: "Generate an app-specific password at appleid.apple.com" with external link
  - "Test & Connect" button: POSTs to `/api/admin/todo/caldav/accounts` with CSRF
  - Loading spinner during connection test
  - Error state: shows descriptive error (auth failed, server unreachable)
  - Success: closes dialog, invalidates todo lists query, shows success toast

- [x] T024 [US2/US3/US5] Create `TodoAccountManager` component: In `frontend/src/components/TodoAccountManager.tsx`:
  - Section "Connected Accounts" showing:
    - Microsoft accounts (from 004's oauth_accounts with Tasks scope): display name, email, task list count, "Disconnect" button (links to 004's account management)
    - CalDAV accounts: display name, server URL, "Disconnect" button with confirmation dialog
  - "Connect Apple Reminders" button → opens `CalDavAccountDialog`
  - "Connect Microsoft" button → redirects to 004's OAuth flow (with Tasks.ReadWrite scope)
  - "Sync Now" button per provider → triggers POST to sync endpoint, shows spinner + result toast
  - Render this component in the TodoConfigForm as a collapsible "Manage Accounts" section

### Enhanced Config Form

- [x] T025 [US5] Update `TodoConfigForm` to show all provider lists: In `frontend/src/components/widgets/TodoConfigForm.tsx`:
  - Extend list selector to show lists from all providers with visual distinction:
    - Local lists: 📋 icon + list name + color dot
    - Microsoft lists: Microsoft icon + list name + "Microsoft To Do" subtitle
    - Apple lists: Apple icon + list name + "Apple Reminders" subtitle
  - Each list shows task count badge (fetched from API)
  - "Create Local List" inline action at top of list selector (name + color input)
  - "Manage Accounts" expandable section at bottom renders `TodoAccountManager`
  - Sync status per provider: "Last synced: X ago" with refresh icon button

**Checkpoint**: Admin can connect/disconnect Microsoft and Apple accounts from the widget config. Config form shows lists from all sources with provider badges. Full widget configuration experience. US5 is complete.

---

## Phase 6: E2E & Integration Tests

**Purpose**: Comprehensive end-to-end tests and security verification across all phases.

### Widget E2E Tests

- [DEFERRED:006] T026 [P] [US1] Add E2E tests for local todo workflow: In `frontend/tests/e2e/todoWidgetLocal.spec.ts`:
  - Add a Todo widget to a dashboard placeholder
  - Create a local list with custom name and color
  - Add 3 tasks via inline input
  - Complete a task → verify strikethrough + checkbox state
  - Uncomplete a task → verify revert
  - Delete a task → verify removal
  - Reorder tasks via drag → verify new order persists after reload
  - Toggle "Hide completed" in config → verify completed tasks hidden/shown
  - Delete the list → verify cascade removes all tasks
  - Page reload between each step to verify persistence

- [DEFERRED:006] T027 [P] [US2/US3] Add E2E tests for synced provider display: In `frontend/tests/e2e/todoWidgetSync.spec.ts`:
  - Mock backend sync responses (seed todo_lists and todo_items with providerType='microsoft' and 'apple')
  - Verify widget displays tasks grouped by provider with correct badges
  - Verify "Last synced" timestamp displays
  - Verify "Sync Now" button triggers sync and updates display
  - Verify error state when sync fails (mock 500 response) — shows cached data + error indicator
  - Verify completing a synced task shows optimistic update
  - Verify failing to sync completion shows revert + error toast

### Config & Security Tests

- [DEFERRED:006] T028 [P] [US5] Add E2E tests for widget configuration: In `frontend/tests/e2e/todoWidgetConfig.spec.ts`:
  - Open widget config form
  - Verify local lists appear with correct icons
  - Select/deselect lists → save → verify widget shows only selected lists
  - Change sort order → verify tasks reorder
  - Toggle group by list → verify grouping headers appear/disappear
  - Set max items to 3 → verify only 3 tasks shown with "+N more" indicator
  - Toggle show completed → verify completed tasks visibility

- [x] T029 [P] [US1-US5] Security and edge case tests: In `backend/tests/integration/todoSecurity.test.ts`:
  - Verify all POST/PUT/DELETE todo endpoints return 401 without auth
  - Verify all POST/PUT/DELETE todo endpoints return 403 without CSRF token
  - Verify `GET /api/admin/todo/caldav/accounts` never includes `encryptedPassword` in response
  - Verify `POST /api/admin/todo/caldav/accounts` rejects `http://` server URLs
  - Verify task title > 500 chars is rejected (400)
  - Verify notes > 5000 chars is rejected (400)
  - Verify list name > 100 chars is rejected (400)
  - Verify a user cannot access another user's todo lists (if multi-user scenario is testable)

**Checkpoint**: All E2E tests pass. Security tests confirm auth/CSRF enforcement and credential safety. Edge cases are covered. Feature is complete and ready for review.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Local Storage + API ──► Phase 2: Widget Frontend ──┐
                                                             ├──► Phase 5: Account Mgmt UI ──► Phase 6: E2E Tests
          ┌─ Phase 3: Microsoft Sync ───────────────────────┤
004 done ─┤                                                  │
          └─ Phase 4: CalDAV Sync ──────────────────────────┘
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 (needs API routes to exist)
- **Phase 3**: Depends on 004-calendar-widget being merged (OAuth infrastructure)
- **Phase 4**: Depends on 004 (encryption utilities) + Phase 1 (todo tables)
- **Phase 3 and 4**: Can run in parallel with each other
- **Phase 5**: Depends on Phases 2 + 3 + 4 (needs all providers to build UI)
- **Phase 6**: Depends on all prior phases

### User Story Independence

| Story | Depends On | Can Parallel With | Backend Changes |
|-------|-----------|-------------------|----------------|
| US1 (P0) | — | US5 (partial) | New tables + CRUD endpoints |
| US2 (P1) | 004, US1 | US3 | Microsoft sync service + routes |
| US3 (P1) | 004, US1 | US2 | CalDAV client + account routes |
| US4 (P1) | US2, US3 | — | Completion sync in existing services |
| US5 (P2) | US1, US2, US3 | — | No new backend (frontend only) |

### Within Each Phase

1. Backend tests (if any) → written first (TDD), verified to FAIL
2. Backend services → before routes (services are called by routes)
3. Backend routes → before frontend hooks (hooks call routes)
4. Frontend components → can be parallel within phase
5. Integration verification → last in the phase

---

## Implementation Strategy

### MVP First (US1 = Phases 1–2 = 12 tasks)

1. Complete Phase 1: Database + Service + API (T001–T006)
2. Complete Phase 2: Widget Frontend (T007–T012)
3. **STOP and VALIDATE**: Admin can create local todo lists, add/complete/delete/reorder tasks
4. Deploy/demo — this is a fully usable product increment with zero external dependencies

### Incremental Delivery

| Increment | Phases | What It Delivers | Cumulative Tasks |
|-----------|--------|-----------------|-----------------|
| **MVP** | 1–2 | Local todo lists + widget | 12 |
| **+ Microsoft** | 3 | Microsoft To Do sync | 16 |
| **+ Apple** | 4 | Apple Reminders via CalDAV | 22 |
| **+ Config** | 5 | Account management + full config | 25 |
| **+ Tests** | 6 | E2E + security test coverage | 29 |

### Parallel Team Strategy

With multiple developers:

1. **Developer A** (full-stack): Phase 1 → Phase 2 (local todo MVP)
2. **Developer B** (backend): Phase 3 (Microsoft) + Phase 4 (CalDAV) in parallel with A
3. **Both**: Phase 5 → Phase 6

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete tasks in the same phase
- **[Story] label** maps each task to a specific user story for traceability
- Phases 1–2 have **zero** dependency on 004-calendar-widget — local todo is standalone
- CalDAV passwords use the **same encryption** (AES-256-GCM) as 004's OAuth tokens
- Microsoft To Do uses the **same oauth_accounts** table — no new credential storage
- The `todo_lists` table serves triple duty: local lists, Microsoft To Do list cache, Apple Reminders list cache
- `todo_items.providerItemId` is the foreign key to external systems (Graph API task ID or VTODO UID)
- `fast-xml-parser` is the only new backend dependency (for CalDAV XML parsing)
- Commit after each task or logical group for clean git history
- Stop at any checkpoint to validate the story independently
