# Feature Specification: Todo / Checklist Widget

**Feature Branch**: `005-todo-widget`
**Created**: 2026-04-24
**Status**: Draft
**Input**: GitHub Issue #12
**Dependencies**: 004-calendar-widget (OAuth2 infrastructure, Microsoft OAuth accounts)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Creates a Local Todo List (Priority: P0)

An admin wants to track home lab tasks directly on the dashboard without connecting any external accounts. They add a Todo widget to a placeholder, which automatically creates a "My Tasks" local list. The admin clicks the inline "Add task" field at the bottom of the widget, types "Update Proxmox firmware," and presses Enter. The task appears in the list with a checkbox. They add a few more tasks, reorder them by dragging, and mark one complete by clicking its checkbox. The completed task fades with a strikethrough and moves to the bottom (or hides, depending on config).

**Why this priority**: Local todo is the foundation — it must work standalone with zero external dependencies. Every other integration layer (Microsoft, Apple) builds on this core data model and UI. Without local todos, the widget has no value if providers are unreachable.

**Independent Test**: Can be fully tested by adding a Todo widget, creating a local list, adding/editing/completing/deleting tasks, and verifying persistence after page reload. No external accounts or APIs needed.

**Acceptance Scenarios**:

1. **Given** an admin adds a Todo widget to a placeholder, **When** the widget renders, **Then** a default "My Tasks" local list is created and the widget shows an empty state with an "Add task" input.
2. **Given** the Todo widget is displayed, **When** the admin types a task title and presses Enter, **Then** the task appears in the list with an unchecked checkbox.
3. **Given** tasks exist in the list, **When** the admin clicks a task's checkbox, **Then** the task is marked complete with a strikethrough and the completion persists after reload.
4. **Given** completed tasks exist, **When** the admin unchecks a completed task, **Then** it reverts to the active state.
5. **Given** multiple tasks exist, **When** the admin drags a task to reorder, **Then** the new order persists after reload.
6. **Given** a task exists, **When** the admin clicks the delete action on a task, **Then** the task is removed and does not reappear after reload.

---

### User Story 2 — Admin Connects Microsoft To Do and Sees Task Lists (Priority: P1)

An admin has already connected their Microsoft account via the Calendar widget (004). They add a Todo widget, open the config form, and see their Microsoft To Do task lists alongside local lists. They select "Work Tasks" and "Shopping" from Microsoft To Do, save the config, and the widget displays tasks from those lists grouped by source with a Microsoft icon badge. New tasks added in the Microsoft To Do app appear in the widget after the next sync cycle.

**Why this priority**: Microsoft To Do is the most popular cross-platform task manager. Reusing the OAuth infrastructure from 004 makes this integration low-cost and high-value.

**Independent Test**: Requires a Microsoft account connected via 004's OAuth flow. Test by configuring the widget to show Microsoft To Do lists, verifying tasks display, completing a task in the widget, and confirming the completion syncs back to Microsoft To Do (check via Graph API or the To Do app).

**Acceptance Scenarios**:

1. **Given** a Microsoft account is connected via 004's OAuth, **When** the admin opens the Todo widget config, **Then** Microsoft To Do task lists appear in the list selector alongside local lists.
2. **Given** Microsoft To Do lists are selected, **When** the widget renders, **Then** tasks from those lists display with a Microsoft provider badge and correct titles/due dates/priorities.
3. **Given** the widget shows Microsoft tasks, **When** the admin checks off a task, **Then** the task is marked complete in Microsoft To Do via the Graph API.
4. **Given** a task is added in Microsoft To Do, **When** the next sync cycle runs, **Then** the new task appears in the widget.
5. **Given** the Microsoft token has expired, **When** the widget attempts to sync, **Then** it shows cached data with a "Last synced: X min ago" indicator and a refresh button.

---

### User Story 3 — Admin Connects Apple Reminders via CalDAV (Priority: P1)

An admin uses Apple Reminders on their iPhone and wants to see those tasks on the dashboard. They go to the Todo widget settings, click "Connect Apple Reminders," and enter their Apple ID email and an app-specific password (generated at appleid.apple.com). The system validates the credentials against `caldav.icloud.com`, fetches their reminder lists, and the admin selects which lists to display. Tasks from Apple Reminders appear in the widget with an Apple badge.

**Why this priority**: Apple Reminders is the default task manager for iOS/Mac users. CalDAV is a standard protocol that doesn't require Apple developer program membership — just an app-specific password.

**Independent Test**: Requires an Apple ID with app-specific password and existing reminders. Test by connecting the account, verifying lists appear, selecting lists, viewing tasks, and completing a task to verify two-way sync.

**Acceptance Scenarios**:

1. **Given** the admin is in the Todo widget settings, **When** they click "Connect Apple Reminders," **Then** a form appears requesting Apple ID email and app-specific password.
2. **Given** valid CalDAV credentials are entered, **When** the admin clicks "Connect," **Then** the system validates against `caldav.icloud.com` and shows available reminder lists.
3. **Given** credentials are invalid, **When** the admin clicks "Connect," **Then** the system shows a clear error message (e.g., "Authentication failed — check your app-specific password").
4. **Given** Apple Reminders lists are connected, **When** the widget renders, **Then** tasks display with due dates, priorities, and an Apple provider badge.
5. **Given** the admin completes a task in the widget, **When** the next sync cycle runs, **Then** the task is marked complete in Apple Reminders.

---

### User Story 4 — Admin Checks Off a Task and It Syncs Back (Priority: P1)

An admin sees a task from Microsoft To Do on their dashboard: "Buy NAS drives." They click the checkbox to mark it complete. The UI immediately shows the task as done (optimistic update). In the background, the system sends the completion status to the provider. If the sync fails, a toast notification appears and the checkbox reverts. The admin also completes a local task and an Apple Reminders task — local completes instantly, Apple syncs on the next CalDAV push cycle.

**Why this priority**: Two-way sync is what makes the widget useful — otherwise it's just a read-only mirror. Users expect that checking off a task on the dashboard means it's done everywhere.

**Independent Test**: Test by completing tasks from each provider type (local, Microsoft, Apple), verifying optimistic UI update, verifying backend sync request is made, and verifying the completion persists in the source provider.

**Acceptance Scenarios**:

1. **Given** a local task is displayed, **When** the admin clicks its checkbox, **Then** the task is immediately marked complete and the change persists in the database.
2. **Given** a Microsoft To Do task is displayed, **When** the admin clicks its checkbox, **Then** the UI optimistically marks it complete and a PATCH request is sent to Microsoft Graph API.
3. **Given** a Microsoft sync request fails, **When** the error is returned, **Then** the checkbox reverts and a toast notification shows "Failed to sync — will retry."
4. **Given** an Apple Reminders task is displayed, **When** the admin clicks its checkbox, **Then** the UI optimistically marks it complete and a CalDAV update is queued.
5. **Given** a synced task is unchecked, **When** the admin clicks the checkbox again, **Then** the uncomplete status syncs back to the provider.

---

### User Story 5 — Admin Configures the Todo Widget (Priority: P2)

An admin has multiple lists: "Home Lab" (local), "Work" (Microsoft), "Groceries" (Apple). They open the widget config form and see all available lists with checkboxes. They select "Home Lab" and "Groceries," set the sort order to "Due date," enable "Group by list," set max items to 20, and toggle "Hide completed." They save, and the widget updates to show only tasks from those two lists, sorted by due date, grouped under colored headings, with completed tasks hidden.

**Why this priority**: Configuration is important for usability but not blocking — the widget works with sensible defaults (show all lists, sort by created date, show completed).

**Independent Test**: Test by creating multiple lists from different providers, opening the config form, selecting/deselecting lists, changing sort/group/filter options, saving, and verifying the widget reflects the configuration.

**Acceptance Scenarios**:

1. **Given** the admin opens the Todo widget config, **When** the form loads, **Then** all available lists (local + connected providers) appear with checkboxes and provider badges.
2. **Given** the config form is open, **When** the admin selects specific lists and saves, **Then** the widget only shows tasks from the selected lists.
3. **Given** the config form is open, **When** the admin changes the sort order to "Due date," **Then** tasks are sorted by due date (nulls last) after save.
4. **Given** "Group by list" is enabled, **When** the widget renders, **Then** tasks are grouped under colored headings showing the list name and provider icon.
5. **Given** "Hide completed" is enabled, **When** the widget renders, **Then** completed tasks are not visible; disabling the toggle reveals them.
6. **Given** "Max items" is set to 20, **When** the widget has more than 20 active tasks, **Then** only the top 20 (by sort order) are shown with a "+N more" indicator.

---

### Edge Cases

1. **Microsoft token refresh failure**: If the OAuth refresh token is revoked or expired, the widget shows cached tasks with a warning banner "Microsoft account needs reconnection" and a link to re-authenticate via 004's OAuth flow.
2. **CalDAV server unreachable**: If `caldav.icloud.com` is unreachable (network issue), the widget shows cached Apple Reminders tasks with a "Last synced: X ago" timestamp. Local todos continue working normally.
3. **Concurrent edits**: If a task is completed on both the dashboard and the provider simultaneously, the most recent completion wins (last-write-wins). Conflict resolution is not required for v1.
4. **Empty lists**: If all selected lists have no tasks, the widget shows a friendly empty state: "All caught up! 🎉" with the inline "Add task" input visible (for local lists only).
5. **Provider rate limiting**: If Microsoft Graph API returns 429 (rate limited), the sync service respects the `Retry-After` header and queues the next sync accordingly. The widget shows cached data in the meantime.
6. **Large task lists**: If a provider list has 500+ tasks, the initial sync fetches only incomplete tasks plus recently completed (last 7 days). A "Load more" action is available in the widget.
7. **CalDAV password rotation**: If the admin changes their Apple app-specific password, existing CalDAV connections fail. The widget shows a "Reconnect" action that re-opens the credential form.
8. **Widget deleted while sync in progress**: If the widget instance is removed while a background sync is running, the sync completes silently and the orphaned cached data is cleaned up on the next maintenance cycle.

## Requirements *(mandatory)*

### Functional Requirements

**Local Todo Storage**

- **FR-001**: System MUST provide a `todo_lists` table with columns: `id` (TEXT PK, UUID), `userId` (TEXT FK → users), `name` (TEXT NOT NULL), `color` (TEXT, hex color), `createdAt` (TEXT, ISO8601), `updatedAt` (TEXT, ISO8601).
- **FR-002**: System MUST provide a `todo_items` table with columns: `id` (TEXT PK, UUID), `listId` (TEXT FK → todo_lists), `title` (TEXT NOT NULL), `notes` (TEXT), `dueDate` (TEXT, ISO8601), `priority` (INTEGER, 0=none/1=low/2=medium/3=high), `completed` (INTEGER, 0|1), `completedAt` (TEXT, ISO8601 nullable), `orderIndex` (INTEGER NOT NULL), `providerType` (TEXT, 'local'|'microsoft'|'apple'), `providerItemId` (TEXT, nullable — external ID for synced items), `createdAt` (TEXT, ISO8601), `updatedAt` (TEXT, ISO8601).
- **FR-003**: System MUST provide CRUD API routes for todo lists: `GET /api/admin/todo/lists` (list all for user), `POST /api/admin/todo/lists` (create), `PUT /api/admin/todo/lists/:id` (update name/color), `DELETE /api/admin/todo/lists/:id` (delete list and all items).
- **FR-004**: System MUST provide CRUD API routes for todo items: `GET /api/admin/todo/lists/:listId/items` (list items), `POST /api/admin/todo/lists/:listId/items` (create), `PUT /api/admin/todo/items/:id` (update title/notes/dueDate/priority/completed/orderIndex), `DELETE /api/admin/todo/items/:id` (delete).
- **FR-005**: System MUST provide a batch reorder endpoint: `PUT /api/admin/todo/lists/:listId/reorder` accepting `{ items: [{ id, orderIndex }] }` for drag-and-drop reorder.
- **FR-006**: All todo mutation endpoints MUST require `requireAdmin` + `assertCsrf`.

**Microsoft To Do Integration**

- **FR-007**: System MUST reuse the `oauth_accounts` table from 004-calendar-widget to access Microsoft accounts with the `Tasks.ReadWrite` scope.
- **FR-008**: System MUST provide a service that fetches task lists from Microsoft Graph API: `GET https://graph.microsoft.com/v1.0/me/todo/lists`.
- **FR-009**: System MUST provide a service that fetches tasks from a specific list: `GET https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks` with `$filter=status ne 'completed'` (default) or all tasks.
- **FR-010**: System MUST sync task completion status bidirectionally: completing a task in the widget sends `PATCH https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks/{taskId}` with `{ status: 'completed' }`.
- **FR-011**: System MUST sync task uncomplete status: unchecking a task sends `PATCH` with `{ status: 'notStarted' }`.
- **FR-012**: System MUST cache Microsoft tasks in the `todo_items` table with `providerType='microsoft'` and `providerItemId` set to the Graph API task ID.
- **FR-013**: System MUST provide a background sync endpoint: `POST /api/admin/todo/sync/microsoft` that fetches latest tasks from Microsoft and updates the local cache.

**Apple Reminders Integration (CalDAV)**

- **FR-014**: System MUST provide a `caldav_accounts` table with columns: `id` (TEXT PK, UUID), `userId` (TEXT FK → users), `serverUrl` (TEXT NOT NULL, default `https://caldav.icloud.com`), `username` (TEXT NOT NULL), `encryptedPassword` (TEXT NOT NULL), `displayName` (TEXT), `createdAt` (TEXT, ISO8601), `updatedAt` (TEXT, ISO8601).
- **FR-015**: CalDAV passwords MUST be encrypted at rest using AES-256-GCM with `SESSION_SECRET` as the encryption key, consistent with the token encryption pattern from 004.
- **FR-016**: System MUST provide CalDAV account management endpoints: `POST /api/admin/todo/caldav/accounts` (connect), `DELETE /api/admin/todo/caldav/accounts/:id` (disconnect), `GET /api/admin/todo/caldav/accounts` (list connected accounts).
- **FR-017**: The connect endpoint MUST validate credentials by performing a `PROPFIND` request against `caldav.icloud.com` before saving.
- **FR-018**: System MUST provide a CalDAV client that performs `PROPFIND` to discover calendar collections and `REPORT` (calendar-query) to fetch `VTODO` components.
- **FR-019**: System MUST parse iCalendar `VTODO` components to extract: `SUMMARY` → title, `DESCRIPTION` → notes, `DUE` → dueDate, `PRIORITY` → priority (iCal 1-9 mapped to 0-3), `STATUS` (COMPLETED/NEEDS-ACTION) → completed, `UID` → providerItemId.
- **FR-020**: System MUST sync completion status bidirectionally: completing a task sends a CalDAV `PUT` with updated `STATUS:COMPLETED` and `COMPLETED:{timestamp}` properties.
- **FR-021**: System MUST cache Apple Reminders tasks in the `todo_items` table with `providerType='apple'` and `providerItemId` set to the VTODO UID.
- **FR-022**: System MUST provide a background sync endpoint: `POST /api/admin/todo/sync/caldav` that fetches latest VTODOs and updates the local cache.

**Todo Widget Frontend**

- **FR-023**: System MUST register a `todo` widget type in the widget registry (`frontend/src/components/widgets/registry.tsx`) with a `CheckSquare` Lucide icon.
- **FR-024**: The `TodoWidget` display component MUST render a scrollable list of tasks with: checkbox (toggle complete/incomplete), task title (with strikethrough when complete), due date badge (color-coded: red if overdue, yellow if today, gray if future), priority badge (🔴 high, 🟡 medium, 🔵 low), and provider icon (local/Microsoft/Apple).
- **FR-025**: The widget MUST support grouping tasks by list/source with a colored header showing list name and provider icon.
- **FR-026**: The widget MUST provide an inline "Add task" input at the bottom for adding tasks to local lists. External provider lists are read-only for task creation.
- **FR-027**: The widget MUST support inline toggle of complete/incomplete via checkbox click with optimistic UI update.
- **FR-028**: The widget MUST support sorting by: due date, priority, created date, or manual drag order.
- **FR-029**: The widget MUST support filtering: show/hide completed tasks.
- **FR-030**: The widget MUST show a "Last synced: X ago" timestamp for external provider lists, with a manual refresh button.

**Widget Configuration Form**

- **FR-031**: The `TodoConfigForm` MUST display a multi-select list of all available todo lists (local + connected providers) with checkboxes, provider icons, and list color indicators.
- **FR-032**: The config form MUST allow configuring: sort order (enum: 'dueDate' | 'priority' | 'createdAt' | 'manual'), grouping (boolean: group by list), max items (number, default 50), and show completed (boolean, default true).
- **FR-033**: Widget configuration MUST be stored in `appWidgetInstances.configJson` as: `{ selectedListIds: string[], sortBy: string, groupByList: boolean, maxItems: number, showCompleted: boolean }`.

### Non-Functional Requirements

- **NFR-001 (Security — Encryption)**: CalDAV passwords MUST be encrypted at rest using AES-256-GCM. The encryption key MUST be derived from `SESSION_SECRET` via the same pattern established in 004-calendar-widget. Passwords MUST never appear in logs, API responses, or error messages.
- **NFR-002 (Security — Auth)**: All todo mutation endpoints MUST require `requireAdmin` middleware. All POST/PUT/DELETE endpoints MUST additionally require `assertCsrf`. CalDAV account management (connect/disconnect) MUST be admin-only.
- **NFR-003 (Security — External Credentials)**: CalDAV passwords and Microsoft OAuth tokens MUST be transmitted only over HTTPS to their respective providers. The `GET /api/admin/todo/caldav/accounts` endpoint MUST NOT return the `encryptedPassword` field.
- **NFR-004 (Performance — Caching)**: Tasks from external providers MUST be cached server-side in the `todo_items` table. The widget MUST render from cached data, not live API calls. Sync runs in the background at a configurable interval (default: 5 minutes).
- **NFR-005 (Performance — Optimistic UI)**: Task completion toggling MUST update the UI immediately via optimistic mutation. If the backend/provider request fails, the UI MUST revert and show an error toast.
- **NFR-006 (Resilience — Graceful Degradation)**: When an external provider is unreachable, the widget MUST display cached data with a "Last synced" timestamp and a visual warning indicator. Local todos MUST always work regardless of provider connectivity.
- **NFR-007 (Resilience — Offline Local)**: Local todo CRUD operations MUST work independently of any external provider connectivity. The local todo feature has zero external dependencies.
- **NFR-008 (UX — Mobile)**: The Todo widget MUST be usable on mobile viewports (≥ 320px width). Checkboxes MUST have a minimum tap target of 44×44px. The inline add input MUST be thumb-reachable.
- **NFR-009 (Data Integrity)**: Deleting a CalDAV account MUST cascade-delete all cached tasks from that account. Deleting a todo list MUST cascade-delete all items in that list.
- **NFR-010 (LAN-only)**: All backend operations are LAN-hosted. External API calls (Microsoft Graph, CalDAV) are made server-side only. The frontend never directly contacts external providers.

### Key Entities

- **TodoList**: A task list that can be local (user-created) or a cached representation of an external provider list. Stored in `todo_lists` table. Has a name, color, and belongs to a user.
- **TodoItem**: An individual task with title, optional notes, optional due date, priority level, completion status, and ordering. Stored in `todo_items` table. Linked to a TodoList. May have a `providerItemId` for synced items.
- **CalDavAccount**: Connection credentials for Apple Reminders via CalDAV. Stored in `caldav_accounts` table. Contains encrypted app-specific password. Belongs to a user.
- **OAuthAccount** (from 004): Microsoft account with OAuth tokens. Reused from 004-calendar-widget's `oauth_accounts` table. Provides access to Microsoft To Do via Graph API. The `Tasks.ReadWrite` scope must be included in the OAuth consent.
- **TodoWidgetConfig**: JSON configuration stored in `appWidgetInstances.configJson`. Specifies which lists to show, sort order, grouping, max items, and completed task visibility.

## Assumptions

- **004-calendar-widget is implemented first**: The `oauth_accounts` table, token encryption utilities (AES-256-GCM), Microsoft OAuth routes (`GET /api/auth/oauth/microsoft`, `GET /api/auth/oauth/microsoft/callback`), and environment variables (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`) all exist before 005 work begins.
- **Microsoft OAuth scope extension**: The existing Microsoft OAuth consent from 004 requests `Calendars.ReadWrite`. For 005, the scope must be extended to include `Tasks.ReadWrite`. This may require users to re-consent. The OAuth flow should request both scopes together.
- **Apple app-specific passwords**: Users know how to generate app-specific passwords at `appleid.apple.com`. The UI provides a link and brief instructions but does not automate this process.
- **CalDAV compatibility**: Apple's CalDAV endpoint at `caldav.icloud.com` supports standard CalDAV `PROPFIND`, `REPORT` (calendar-query), and `PUT` operations for VTODO components. No Apple-proprietary extensions are required.
- **No real-time push**: External provider changes are detected via polling (background sync), not webhooks or push notifications. This is appropriate for a LAN dashboard with periodic refresh.
- **Single user per widget**: The todo widget shows lists for the currently authenticated admin user only. Multi-user task sharing is out of scope.

## Out of Scope

- **Subtasks / nested tasks**: Tasks are flat — no parent/child task hierarchy in v1.
- **File attachments on tasks**: No file upload support on individual todo items.
- **Shared / collaborative lists**: No sharing lists between HomeDash users.
- **Recurring tasks**: No recurrence rules (RRULE) support in v1. Recurring Apple Reminders show as individual instances.
- **Google Tasks integration**: Only Microsoft To Do and Apple Reminders are supported in v1.
- **Todoist / Notion / other third-party integrations**: Deferred to future features.
- **Push notifications / reminders**: No notification system — the widget is a passive display.
- **Natural language task input**: No "remind me to X tomorrow" parsing. Tasks are plain text with optional manual due date.
- **Task comments / activity log**: No comment threads or history on individual tasks.
- **Bulk operations**: No "complete all" or "delete all completed" actions in v1.

## Success Criteria *(mandatory)*

- **SC-001**: An admin can add a Todo widget, create a local list, add 5 tasks, complete 2, reorder 1, and see all changes persist after page reload — within 2 minutes of starting.
- **SC-002**: An admin with a connected Microsoft account can see their To Do task lists in the widget config and display tasks from selected lists within 10 seconds of opening the widget.
- **SC-003**: An admin can connect Apple Reminders via CalDAV credentials and see their reminder lists within 15 seconds of entering valid credentials.
- **SC-004**: Completing a task in the widget syncs the completion to Microsoft To Do within 5 seconds (optimistic UI update is instant).
- **SC-005**: Completing a task in the widget syncs the completion to Apple Reminders on the next sync cycle (≤ 5 minutes by default).
- **SC-006**: When Microsoft Graph API is unreachable, the widget displays cached tasks with a "Last synced" timestamp and local todos continue working normally.
- **SC-007**: When CalDAV is unreachable, the widget displays cached Apple Reminders tasks with a "Last synced" timestamp and local todos continue working normally.
- **SC-008**: All todo mutation endpoints reject unauthenticated requests with 401 and missing CSRF with 403.
- **SC-009**: The `GET /api/admin/todo/caldav/accounts` endpoint never returns encrypted passwords in the response body.
- **SC-010**: The widget renders ≤ 100 tasks with grouping and sorting in under 200ms on the frontend.

## Safety Constraints

- **Credential storage**: CalDAV passwords are encrypted at rest using AES-256-GCM. The encryption key is derived from `SESSION_SECRET`. Raw passwords never appear in database columns, log output, or API responses. The `encryptedPassword` column is excluded from all GET responses.
- **Token handling**: Microsoft OAuth tokens are managed by 004's infrastructure. This feature only reads tokens from `oauth_accounts` — it never stores or modifies them directly.
- **CSRF protection**: All state-mutating endpoints (POST, PUT, DELETE) require a valid CSRF token via `assertCsrf`. This prevents cross-site request forgery attacks on task completion, list management, and account connections.
- **Input validation**: All API inputs are validated via Zod schemas. Task titles are limited to 500 characters. Notes are limited to 5000 characters. List names are limited to 100 characters. Due dates must be valid ISO8601.
- **External API calls**: All external HTTP requests (Microsoft Graph, CalDAV) are made server-side. The frontend never directly contacts external services, preventing credential leakage via browser dev tools.
- **CalDAV transport security**: All CalDAV requests to `caldav.icloud.com` MUST use HTTPS. The system MUST reject `http://` CalDAV server URLs.
- **Rate limiting respect**: The sync service MUST respect HTTP 429 responses from Microsoft Graph and CalDAV servers, backing off per the `Retry-After` header.
- **Data isolation**: Todo lists and items are scoped to the authenticated user's ID. No API endpoint allows accessing another user's tasks.
