# Tasks: Full Backup & Restore + Settings Enhancements

**Input**: Design documents from `/specs/023-full-backup-restore/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Backend services (backupService, scheduledJobService, sessionStore changes) and all new API endpoints involve auth, data, and network changes — tests are REQUIRED per constitution. Frontend E2E tests cover critical user flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- **Backend tests**: `backend/tests/integration/`, `backend/tests/contract/`
- **Frontend E2E**: `frontend/tests/e2e/`
- **DB schema**: `backend/src/db/schema/index.ts`
- **Migrations**: `backend/drizzle/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and prepare project structure for the feature

- [x] T001 Install `croner` dependency in backend workspace via `cd backend && pnpm add croner`
- [x] T002 Add backup-restore OpenAPI contract to `backend/tests/contract/openapi.test.ts` test config (so existing contract tests validate new endpoints once routes exist)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, shared types, and Zod validation schemas that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `scheduled_jobs` table to Drizzle schema in `backend/src/db/schema/index.ts` per data-model.md (columns: id, name, action_type, action_params, cron_expression, enabled, is_system, last_run_at, last_run_status, last_run_error, disabled_reason, created_at, updated_at)
- [x] T004 Generate Drizzle migration for `scheduled_jobs` table via `cd backend && npx drizzle-kit generate`
- [x] T005 [P] Create shared backup types and Zod schemas in `backend/src/services/backupTypes.ts` — define `BackupFile`, `BackupSummary`, `BackupData`, `backupFileSchema` (Zod), per data-model.md envelope and data section; include BACKUP_VERSION = 1 constant and list of included/excluded tables
- [x] T006 [P] Create scheduled job Zod validation schemas in `backend/src/services/scheduledJobTypes.ts` — define `CreateScheduledJobSchema`, `UpdateScheduledJobSchema`, `SonosPlaybackParamsSchema`, `CalendarSyncParamsSchema`, action type enum, per contracts/ and data-model.md
- [x] T007 [P] Add `homeTimezone` validation helper to `backend/src/services/shellSettingsService.ts` — add `isValidTimezone(tz: string): boolean` using `Intl.supportedValuesOf('timeZone')` and `getTimezoneList(): string[]` endpoint helper per R-04

**Checkpoint**: Foundation ready — `scheduled_jobs` table exists, shared types defined, user story implementation can begin

---

## Phase 3: User Story 1 — Full System Backup (Priority: P1) 🎯 MVP

**Goal**: Admin can download a single JSON backup file containing all HomeDash state (minus secrets/transient data)

**Independent Test**: Create a backup, inspect the downloaded JSON — verify it contains all expected data categories (users, dashboards, widgets, etc.), excludes password hashes and OAuth tokens, has correct envelope metadata

### Tests for User Story 1 (REQUIRED — auth + data changes) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Write integration test for backup download in `backend/tests/integration/backup.test.ts` — test: admin can GET `/api/admin/backup` and receive valid JSON with correct envelope (format, version, appVersion, exportedAt, summary, data); test: non-admin receives 403; test: unauthenticated receives 401; test: backup excludes passwordHash from users; test: backup excludes accessToken/refreshToken from oauth_accounts; test: backup excludes password from caldav_accounts; test: backup excludes sessions, calendar_events, shortcut_ping_results, icon_cache_entries, uploaded_assets tables; test: backup summary counts match actual row counts

### Implementation for User Story 1

- [x] T009 [US1] Implement backup export logic in `backend/src/services/backupService.ts` — create `exportBackup(): BackupFile` that reads all 24 included tables via Drizzle, strips sensitive fields (users.passwordHash, oauth_accounts.accessToken/refreshToken/tokenExpiresAt, caldav_accounts.password), builds the BackupFile envelope with summary counts, format/version/appVersion/exportedAt metadata; add `restoreInProgress` flag for concurrent restore prevention (R-08)
- [x] T010 [US1] Create backup API route file `backend/src/api/admin-backup.ts` — implement `registerAdminBackupRoutes(app)` with GET `/api/admin/backup` endpoint; use `requireAdmin` middleware; call `backupService.exportBackup()`, set `Content-Disposition: attachment; filename="homedash-backup-YYYY-MM-DD.json"` header, return JSON response
- [x] T011 [US1] Wire backup routes into `backend/src/api/index.ts` — import and call `registerAdminBackupRoutes(app)` in `registerAllRoutes()`

**Checkpoint**: Admin can download a complete system backup — User Story 1 is functional and testable

---

## Phase 4: User Story 2 — Full System Restore (Priority: P1)

**Goal**: Admin uploads a backup file, previews contents, confirms with "RESTORE" keyword, and system atomically replaces all data

**Independent Test**: Download a backup (US1), modify some data, restore from the backup, verify original state is restored; test rollback by inducing an error mid-restore

### Tests for User Story 2 (REQUIRED — destructive data operation + auth) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US2] Write integration test for restore preview in `backend/tests/integration/restorePreview.test.ts` — test: admin POST `/api/admin/backup/preview` with valid backup returns RestorePreview with counts and warnings; test: invalid format returns 400; test: unsupported version returns 400 with descriptive message; test: non-admin receives 403
- [x] T013 [P] [US2] Write integration test for restore execution in `backend/tests/integration/restore.test.ts` — test: admin POST `/api/admin/backup/restore` with valid backup + confirmationWord="RESTORE" succeeds and returns summary; test: wrong confirmation word returns 400; test: missing confirmation word returns 400; test: after restore, all sessions are invalidated; test: after restore, data matches backup contents; test: concurrent restore returns 409; test: restore rolls back on simulated error (original data preserved); test: non-admin receives 403

### Implementation for User Story 2

- [x] T014 [US2] Implement restore preview logic in `backupService.ts` — add `previewRestore(backup: unknown): RestorePreview` that validates the backup against `backupFileSchema`, checks version compatibility (reject version > BACKUP_VERSION per FR-009), returns summary counts plus warnings array (e.g., "OAuth tokens excluded — integrations will need re-authentication")
- [x] T015 [US2] Implement atomic restore logic in `backupService.ts` — add `executeRestore(backup: BackupFile): BackupSummary` that: checks `restoreInProgress` flag (FR-010, return 409 if true), sets flag in try/finally, runs inside `db.transaction()`, deletes all data from included tables in FK-safe order (R-02), inserts backup data in parent-first order, deletes all sessions (FR-006), clears in-memory caches; add structured logging for each restore step (NFR-006)
- [x] T016 [US2] Add preview and restore endpoints to `backend/src/api/admin-backup.ts` — add POST `/api/admin/backup/preview` (validate and return preview); add POST `/api/admin/backup/restore` (validate confirmationWord === "RESTORE" per FR-007, call `executeRestore`, return success + summary); both endpoints use `requireAdmin`; set Fastify body size limit to handle backup payloads (10 MB)
- [x] T017 [US2] Create backup/restore TanStack Query hooks in `frontend/src/state/backupHooks.ts` — `useDownloadBackup()` mutation (GET `/api/admin/backup`, trigger file download), `usePreviewRestore()` mutation (POST `/api/admin/backup/preview`), `useExecuteRestore()` mutation (POST `/api/admin/backup/restore` with confirmationWord)
- [x] T018 [US2] Create backup/restore UI component in `frontend/src/components/settings/BackupRestoreSection.tsx` — "Download Backup" button that triggers file download; "Restore from Backup" file upload area; on file upload: parse JSON, call preview endpoint, display RestorePreview summary (counts + warnings); confirmation dialog requiring user to type "RESTORE"; progress/success/error states; use shadcn/ui Card, Button, Dialog, Input components; mobile-responsive layout (NFR-005)
- [x] T019 [US2] Add BackupRestoreSection to GeneralTab in `frontend/src/components/settings/GeneralTab.tsx` — import and render `<BackupRestoreSection />` at bottom of GeneralTab, gated behind `isAdmin` prop check

**Checkpoint**: Admin can back up and restore the entire system — User Stories 1 AND 2 work together

---

## Phase 5: User Story 3 — Default Timezone Setting (Priority: P2)

**Goal**: User selects an IANA timezone from a searchable dropdown in Settings → General; all time-dependent features respect it

**Independent Test**: Set timezone to a non-UTC value, verify clock widget and calendar event times display in the selected timezone

### Tests for User Story 3 (REQUIRED — data change, settings persistence) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US3] Write integration test for timezone endpoint in `backend/tests/integration/timezone.test.ts` — test: GET `/api/admin/timezones` returns array of valid IANA timezone strings (includes "America/New_York", "Europe/London", "UTC"); test: authenticated user can access; test: unauthenticated receives 401; test: list contains ≥ 400 entries; test: timezone persists via existing shell settings PUT endpoint with valid IANA value; test: invalid timezone value is rejected with 400

### Implementation for User Story 3

- [x] T021 [US3] Add timezone list endpoint to `backend/src/api/admin.ts` or create `backend/src/api/admin-timezone.ts` — implement GET `/api/admin/timezones` using `requireAuth` middleware; return `{ timezones: Intl.supportedValuesOf('timeZone') }`; wire into route registration
- [x] T022 [US3] Add timezone validation to shell settings update in `backend/src/services/shellSettingsService.ts` — when `homeTimezone` is included in an update, validate it against `Intl.supportedValuesOf('timeZone')` and reject invalid values with a descriptive error
- [x] T023 [US3] Create searchable timezone dropdown component in `frontend/src/components/settings/TimezoneSelector.tsx` — use shadcn/ui Combobox or Command pattern for searchable dropdown; fetch timezone list from `/api/admin/timezones`; display current selection from shell settings; on change, update via existing shell settings mutation; show "(System default)" option that clears the setting (FR-014)
- [x] T024 [US3] Add TimezoneSelector to GeneralTab in `frontend/src/components/settings/GeneralTab.tsx` — import and render `<TimezoneSelector />` in the General tab (visible to all users, editable by admin); position above BackupRestoreSection

**Checkpoint**: Timezone selection works independently — time-dependent features respect the configured timezone

---

## Phase 6: User Story 4 — Login "Remember Me" (Priority: P2)

**Goal**: Login form has a "Remember me" checkbox; when checked, session persists 30 days; when unchecked, session cookie is cleared on browser close

**Independent Test**: Login with "Remember me" checked — verify cookie has `maxAge: 2592000`; login without it — verify session cookie has no `maxAge`; verify explicit logout destroys both session types

### Tests for User Story 4 (REQUIRED — auth/security change) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T025 [P] [US4] Write integration test for remember-me login in `backend/tests/integration/rememberMe.test.ts` — test: POST `/api/auth/login` with `rememberMe: true` returns Set-Cookie with `Max-Age=2592000`; test: POST `/api/auth/login` with `rememberMe: false` returns Set-Cookie without Max-Age (session cookie); test: POST `/api/auth/login` without rememberMe field defaults to false behavior; test: session created with rememberMe=true has expiresAt ~30 days from now; test: session created with rememberMe=false has expiresAt ~7 days from now; test: explicit POST `/api/auth/logout` destroys remember-me session; test: expired remember-me session returns 401 on GET `/api/auth/me`

### Implementation for User Story 4

- [x] T026 [US4] Modify session store to support variable TTL in `backend/src/auth/sessionStore.ts` — add `REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000` constant; update `createSession()` to accept optional `rememberMe: boolean` parameter; when true, set `expiresAt = now + 30 days`; update `getSessionCookieOptions()` to accept optional `rememberMe` parameter; when true, set `maxAge: 2592000`; when false, set `maxAge: undefined` (session cookie); preserve existing 7-day default behavior (R-03)
- [x] T027 [US4] Update login endpoint in `backend/src/api/auth.ts` — add `rememberMe` (optional boolean, default false) to login request body Zod schema; pass `rememberMe` to `createSession()` and `getSessionCookieOptions()`
- [x] T028 [US4] Add "Remember me" checkbox to login form in `frontend/src/pages/LoginPage.tsx` — add `rememberMe` state (default false); render shadcn/ui Checkbox with label "Remember me on this machine" below password field; include `rememberMe` in login POST request body

**Checkpoint**: Remember-me login works independently — session persistence behavior matches spec

---

## Phase 7: User Story 5 — Scheduled Jobs Management (Priority: P3)

**Goal**: Unified scheduled jobs system replacing scattered `setInterval` patterns; admin UI for viewing, creating, editing, enabling/disabling, and deleting jobs; calendar sync migrated to system job; Sonos playback jobs supported

**Independent Test**: Create a Sonos playback job via Settings → Scheduled Jobs; verify it appears in the list with correct schedule; toggle enable/disable; trigger manual run; verify calendar sync appears as a system job

### Tests for User Story 5 (REQUIRED — new table, new service, auth, data) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T029 [P] [US5] Write integration test for scheduled job CRUD in `backend/tests/integration/scheduledJobs.test.ts` — test: GET `/api/admin/scheduled-jobs` returns list of jobs (admin-only, 403 for non-admin); test: POST creates a job with valid data and returns 201; test: POST with invalid cron expression returns 400; test: POST with invalid action_params returns 400; test: PUT `/api/admin/scheduled-jobs/:id` updates job; test: PUT on system job allows enable/disable but not action_type change; test: DELETE on user job returns 204; test: DELETE on system job returns 403; test: POST `/:id/run` triggers immediate execution; test: GET returns system-seeded calendar sync job after startup
- [x] T030 [P] [US5] Write unit test for scheduledJobService in `backend/tests/integration/scheduledJobService.test.ts` — test: `startScheduler()` creates Cron instances for enabled jobs; test: `stopScheduler()` stops all Cron instances; test: job execution updates last_run_at, last_run_status; test: failed job execution records last_run_error; test: disabled jobs are not scheduled; test: timezone is respected when resolving cron times; test: `addJob()` / `removeJob()` dynamically update running scheduler

### Implementation for User Story 5

- [x] T031 [US5] Implement scheduled job service in `backend/src/services/scheduledJobService.ts` — create `ScheduledJobService` with: `startScheduler()` that loads all enabled jobs from DB and creates `Cron` instances (from `croner`) with timezone from shellSettings; `stopScheduler()` that stops all Cron instances; `addJob(job)` / `updateJob(id, updates)` / `removeJob(id)` for dynamic CRUD with live scheduler updates; `runJobNow(id)` for on-demand execution; job execution handler that resolves action_type to handler (calendar_sync → existing `runScheduledSync`, sonos_playback → Sonos service call), updates last_run_at/status/error in DB; seed system job for calendar sync on startup if not present (R-07: cron `* * * * *`, is_system=true, action_type=calendar_sync)
- [x] T032 [US5] Migrate calendar sync to scheduled job system in `backend/src/services/calendar-sync-service.ts` — remove `startSyncScheduler()` / `stopSyncScheduler()` setInterval logic; export only `runScheduledSync()` as the callable function; update `backend/src/server.ts` to call `scheduledJobService.startScheduler()` on startup and `stopScheduler()` on shutdown instead of `startSyncScheduler()`/`stopSyncScheduler()`
- [x] T033 [US5] Create scheduled jobs API route file `backend/src/api/admin-scheduled-jobs.ts` — implement `registerAdminScheduledJobRoutes(app)` with: GET `/api/admin/scheduled-jobs` (list all); POST `/api/admin/scheduled-jobs` (create, validate with Zod schemas from T006); PUT `/api/admin/scheduled-jobs/:id` (update, enforce system job restrictions); DELETE `/api/admin/scheduled-jobs/:id` (delete, reject system jobs with 403); POST `/api/admin/scheduled-jobs/:id/run` (trigger immediate run); all endpoints use `requireAdmin` middleware
- [x] T034 [US5] Wire scheduled job routes into `backend/src/api/index.ts` — import and call `registerAdminScheduledJobRoutes(app)` in `registerAllRoutes()`
- [x] T035 [US5] Integrate scheduled job service lifecycle in `backend/src/server.ts` — import scheduledJobService; call `startScheduler()` after DB migration/ready; call `stopScheduler()` in Fastify `onClose` hook; after successful restore (in backupService), call `stopScheduler()` then `startScheduler()` to reload restored jobs
- [x] T036 [P] [US5] Create scheduled jobs TanStack Query hooks in `frontend/src/state/scheduledJobHooks.ts` — `useScheduledJobs()` query (GET `/api/admin/scheduled-jobs`), `useCreateJob()` mutation, `useUpdateJob()` mutation, `useDeleteJob()` mutation, `useRunJobNow()` mutation; invalidate jobs query on mutations
- [x] T037 [US5] Create Scheduled Jobs tab component in `frontend/src/components/settings/ScheduledJobsTab.tsx` — list all jobs in a table/card layout showing: name, human-readable schedule description, action type badge, enabled/disabled toggle (Switch), last run status (success/failure/never run badge), last run time; "Add Job" button opening a dialog/form with: name input, action type select, action-specific params (for sonos_playback: playlist selector, volume slider, speaker picker using existing Sonos state), cron expression input with simple-mode helpers (daily/weekdays/custom), enabled toggle; edit and delete actions per row (delete disabled for system jobs); mobile-responsive layout (NFR-005); use shadcn/ui Table, Switch, Dialog, Select, Input, Button, Badge
- [x] T038 [US5] Add Scheduled Jobs tab to SettingsPage in `frontend/src/pages/SettingsPage.tsx` — add new TabsTrigger "Scheduled Jobs" (with Clock/Calendar icon) after "Integrations"; add corresponding TabsContent rendering `<ScheduledJobsTab />`; gate behind admin role check

**Checkpoint**: All 5 user stories are independently functional — scheduled jobs system replaces setInterval, calendar sync migrated, Sonos jobs supported

---

## Phase 8: Full Database Backup (Disaster Recovery)

**Purpose**: Provide a complete SQLite database backup for true disaster recovery — no stripped fields, no manual re-auth. Complements the existing portable JSON backup which remains the tool for sharing/migrating.

**Rationale**: The portable JSON backup strips password hashes, OAuth tokens, and CalDAV passwords for security. This means after a disaster restore, no user can log in and all integrations need manual re-configuration. A raw SQLite `.db` copy preserves everything, allowing instant recovery by simply replacing the database file before starting a new container.

### Implementation

- [x] T043 [US1] Add `database_backup` action handler to `backend/src/services/scheduledJobService.ts` — implement `runDatabaseBackup()` that: uses better-sqlite3's `.backup()` API to create a hot, consistent copy of `homedash.db`; saves to `$HOMEDASH_DATA_DIR/backups/homedash_YYYYMMDD_HHmmss.db`; ensures `backups/` directory exists (create if not); applies configurable retention policy (default: keep last 7 `.db` files, delete oldest); logs backup start/complete/error with file size; register `database_backup` in the action handler map alongside `calendar_sync`

- [x] T044 [US1] Add `portable_backup` action handler to `backend/src/services/scheduledJobService.ts` — implement `runPortableBackup()` that: calls existing `exportBackup()` from backupService; writes JSON output to `$HOMEDASH_DATA_DIR/backups/homedash_YYYYMMDD_HHmmss.json`; applies same retention policy (default: keep last 7 `.json` files); logs backup start/complete/error with file size; register `portable_backup` in the action handler map

- [x] T045 [US1] Seed `database_backup` system job in `scheduledJobService.ts` `seedSystemJobs()` — add a second system job (alongside `calendar_sync`): name="Database Backup", action_type="database_backup", cron_expression="0 2 * * *" (daily at 2am), is_system=true, enabled=true; add action_params schema `{ retention: number }` with default `{ retention: 7 }`

- [x] T046 [US1] Seed `portable_backup` system job in `scheduledJobService.ts` `seedSystemJobs()` — add a third system job: name="Portable Backup", action_type="portable_backup", cron_expression="0 2 * * *" (daily at 2am), is_system=true, enabled=true; add action_params with default `{ retention: 7 }`

- [x] T047 [US1] Add "Download Full Backup" button to `frontend/src/components/settings/BackupRestoreSection.tsx` — add a new card/section titled "Full Database Backup (Disaster Recovery)"; add "Download Full Backup" button that hits GET `/api/admin/backup/database` and triggers `.db` file download; add info text explaining: "Downloads a complete copy of the database including all credentials. For disaster recovery only — store securely."; add warning badge: "Contains sensitive data"

- [x] T048 [US1] Add GET `/api/admin/backup/database` endpoint to `backend/src/api/admin-backup.ts` — uses `requireAdmin` + `assertCsrf`; uses better-sqlite3 `.backup()` to create temp file, streams it as response with `Content-Disposition: attachment; filename="homedash-full-YYYY-MM-DD.db"`; cleans up temp file after response; set appropriate content-type `application/x-sqlite3`

- [x] T049 [US1] Add `DatabaseBackupParamsSchema` to `backend/src/services/scheduledJobTypes.ts` — Zod schema: `{ retention: z.number().int().min(1).max(30).default(7) }`; add `database_backup` and `portable_backup` to the action type enum; export the schema

- [x] T050 [US1] Add CLI restore instructions to `BackupRestoreSection.tsx` — below the full backup download button, add a collapsible "How to restore from full backup" section with: step 1: stop the container (`docker compose down`); step 2: copy backup file (`cp homedash_YYYYMMDD.db /path/to/data/homedash.db`); step 3: start container (`docker compose up -d`); style with shadcn/ui Collapsible + code blocks

- [x] T051 [US1] Generate `RESTORE_README.md` in backups directory — on every scheduled backup run (either type), write/overwrite `$HOMEDASH_DATA_DIR/backups/RESTORE_README.md` with: overview of backup types (`.db` = full DR, `.json` = portable/migration); full restore instructions for each scenario (Docker crash, new server migration, moving hosts); docker compose examples; file naming convention explanation; retention policy note; contact/project URL. This ensures the README is always present alongside the backups regardless of how the user discovers the directory.

**Checkpoint**: Full disaster recovery backup available — both scheduled and on-demand. Users can recover from total data loss with a single file copy.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Ensure backup includes scheduled jobs correctly, restore restarts scheduler, cross-story integration verified

- [x] T039 Verify backup/restore includes scheduled_jobs table in `backend/src/services/backupService.ts` — confirm `exportBackup()` includes scheduledJobs in data section and summary count; confirm `executeRestore()` deletes and re-inserts scheduled_jobs; confirm restored jobs with references to unconfigured integrations are set to `enabled=false` with `disabled_reason` per FR-030
- [x] T040 [P] Add structured logging to backup, restore, and scheduled job operations — ensure all new services use the existing logger pattern with operation context (NFR-006); log: backup started/completed with summary, restore started/completed/rolled-back with reason, job execution started/completed/failed with job name and error
- [x] T041 [P] Update contract test in `backend/tests/contract/openapi.test.ts` — ensure the OpenAPI contract file at `specs/023-full-backup-restore/contracts/backup-restore-api.yaml` is included in contract validation if the test supports multiple spec files
- [x] T042 Run quickstart.md validation — follow all steps in `specs/023-full-backup-restore/quickstart.md` on a clean dev environment to verify setup instructions are accurate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion
  - US1 and US2 share `backupService.ts` — US1 must complete before US2
  - US3 (Timezone) is independent — can run in parallel with US1/US2
  - US4 (Remember Me) is independent — can run in parallel with US1/US2
  - US5 (Scheduled Jobs) is independent — can run in parallel with US1/US2
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (needs backup export format and `backupService.ts` structure)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — independent of US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) — independent (no shared files with other stories)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) — independent (owns scheduledJobService.ts, own route file, own UI tab)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend services before API routes
- API routes before frontend hooks
- Frontend hooks before UI components
- Core implementation before integration with other stories
- Story complete before moving to next priority

### Parallel Opportunities

- T005, T006, T007 (foundational schemas/types) can all run in parallel
- T008 (US1 test) can run in parallel with T020, T025, T029, T030 (other story tests) — once foundational is done
- US3, US4, and US5 can all start in parallel after foundational phase
- T036 (scheduled job hooks) can run in parallel with T031–T035 (backend implementation) since it targets a different directory
- Frontend components (T018, T023, T028, T037) all target different files and can run in parallel once their hooks/backend are ready

---

## Parallel Example: Foundational Phase

```text
# All three schema/type tasks in parallel (different files):
T005: Create backup types in backend/src/services/backupTypes.ts
T006: Create scheduled job types in backend/src/services/scheduledJobTypes.ts
T007: Add timezone helpers to backend/src/services/shellSettingsService.ts
```

## Parallel Example: Independent User Stories (after Foundational)

```text
# Developer A: US1 → US2 (sequential — shared backupService.ts)
T008 → T009 → T010 → T011 → T012/T013 → T014 → T015 → T016 → T017 → T018 → T019

# Developer B: US3 + US4 (parallel — completely independent files)
T020 → T021 → T022 → T023 → T024   (US3 — timezone)
T025 → T026 → T027 → T028           (US4 — remember me)

# Developer C: US5 (independent — own service, routes, UI)
T029/T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007)
3. Complete Phase 3: User Story 1 — Full Backup (T008–T011)
4. Complete Phase 4: User Story 2 — Full Restore (T012–T019)
5. **STOP and VALIDATE**: Backup and restore the system end-to-end
6. Deploy/demo if ready — core disaster-recovery capability is live

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Backup) → Test independently → Partial value (can inspect state)
3. Add US2 (Restore) → Test with US1 → Deploy/Demo — **MVP complete!**
4. Add US3 (Timezone) → Test independently → Deploy/Demo
5. Add US4 (Remember Me) → Test independently → Deploy/Demo
6. Add US5 (Scheduled Jobs) → Test independently → Deploy/Demo — **Full feature complete**
7. Polish phase → Final validation

### Parallel Team Strategy

With 3 developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - **Developer A**: US1 → US2 (backup/restore — sequential, shared service file)
   - **Developer B**: US3 (timezone) + US4 (remember me) — parallel, no shared files
   - **Developer C**: US5 (scheduled jobs) — independent service, routes, and UI
3. All stories complete independently; polish phase follows

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- `backupService.ts` is shared between US1 (export) and US2 (import/restore) — do US1 first
- Calendar sync migration (T032) removes `setInterval` — coordinate with T035 (server lifecycle) to avoid broken sync during development
- Restore body size: set Fastify `bodyLimit` to ~15 MB on restore endpoint to handle large backup files
