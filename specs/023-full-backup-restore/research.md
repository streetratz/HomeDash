# Research — Full Backup & Restore + Settings Enhancements

## Table of Contents
- [R-01: Full System Backup Format](#r-01-full-system-backup-format)
- [R-02: Atomic Restore Strategy](#r-02-atomic-restore-strategy)
- [R-03: Session TTL Extension for Remember Me](#r-03-session-ttl-extension-for-remember-me)
- [R-04: IANA Timezone Bundling](#r-04-iana-timezone-bundling)
- [R-05: Cron Scheduling in Node.js](#r-05-cron-scheduling-in-nodejs)
- [R-06: Existing Export/Import Reuse](#r-06-existing-exportimport-reuse)
- [R-07: Calendar Sync Migration](#r-07-calendar-sync-migration)
- [R-08: Concurrent Restore Prevention](#r-08-concurrent-restore-prevention)

---

## R-01: Full System Backup Format

**Decision**: JSON file with metadata envelope and per-table data arrays.

**Rationale**: The existing `DashboardExport` uses JSON (version 1/2 format). A full system backup extends this pattern to all 29 tables. JSON is human-inspectable, diff-friendly, and natively handled by both SQLite/Drizzle (read) and the browser (download/upload). The file is structured as:

```json
{
  "format": "homedash-backup",
  "version": 1,
  "appVersion": "x.y.z",
  "exportedAt": "ISO8601",
  "summary": { "users": 3, "dashboards": 5, ... },
  "data": {
    "users": [...],
    "dashboards": [...],
    ...
  }
}
```

**Alternatives considered**:
- SQLite dump file: More compact but not inspectable, harder to version, and couples restore to SQLite internals.
- ZIP with multiple files: More complex to generate/parse in-browser; unnecessary for typical <10 MB payloads.
- Protocol Buffers: Overkill for a single-instance LAN app; adds build complexity.

**Excluded tables/fields**:
- `sessions` — excluded entirely (sessions invalidated on restore; FR-006)
- `users.passwordHash` — excluded (FR-005; users must re-set passwords or use existing ones)
- `oauth_accounts` token fields (`accessToken`, `refreshToken`) — excluded (FR-005)
- `caldav_accounts.password` — excluded (sensitive credential)
- `calendar_events` — excluded (derived data; re-synced from sources after restore)
- `shortcut_ping_results` — excluded (transient runtime data)
- `icon_cache_entries` — excluded (cache; rebuilt on demand)
- `uploaded_assets` — excluded per scope (binary files; users backup volume separately)

**Included tables** (21 data tables):
`users` (sans passwordHash), `user_preferences`, `app_shell_settings`, `dashboards`, `placeholder_widgets`, `placeholder_breakpoint_layouts`, `app_widget_instances`, `links_list_items`, `calendar_sources` (sans tokens), `todo_lists`, `todo_items`, `groups`, `group_permissions`, `user_group_memberships`, `dashboard_access_rules`, `shortcut_groups`, `app_shortcuts`, `pihole_instances`, `unifi_instances`, `docker_connections`, `widget_connections`, `integration_configs`, `photo_sources`, `scheduled_jobs` (new table).

---

## R-02: Atomic Restore Strategy

**Decision**: Use SQLite's `SAVEPOINT` within a Drizzle transaction. Delete all data from included tables in FK-dependency order, then insert backup data in reverse order.

**Rationale**: better-sqlite3 runs synchronously and supports nested savepoints. Drizzle's `db.transaction()` wraps this cleanly. The delete-then-insert approach within a single transaction guarantees atomicity (FR-004). If any step fails, the entire transaction rolls back and the original data is preserved (SC-003).

**Alternatives considered**:
- Copy-on-write (backup current DB file first): Adds file I/O complexity and disk space usage. SQLite transactions are sufficient and simpler.
- Merge-mode: Explicitly out of scope per spec; replace-only for v1.

**Delete order** (respects FK cascades): sessions → calendar_events → icon_cache_entries → shortcut_ping_results → (then leaf tables first, working up to parent tables). In practice, since most FKs have `ON DELETE CASCADE`, deleting parent tables cascades to children. Order: delete from all included tables; insertion order follows parent-first.

**Post-restore actions**:
1. Delete all rows from `sessions` table (invalidate all sessions; FR-006)
2. Clear any in-memory caches (scheduled job timers, calendar sync intervals)
3. Restart scheduled job service with restored job definitions

---

## R-03: Session TTL Extension for Remember Me

**Decision**: Add an optional `rememberMe: boolean` parameter to the login endpoint. When true, set `expiresAt` to `now + 30 days` and cookie `maxAge` to 30 days. When false, omit `maxAge` from cookie (session cookie) and keep the existing 7-day DB TTL.

**Rationale**: The existing `sessionStore.ts` has a fixed `SESSION_TTL_MS = 7 days` and `getSessionCookieOptions()` sets `maxAge: 604800`. Extending this requires:
1. `createSession()` accepts an optional `ttlMs` parameter (default 7 days)
2. `getSessionCookieOptions()` accepts an optional `maxAge` override; when `rememberMe=false`, return `maxAge: undefined` (browser deletes cookie on close)
3. The login route passes `rememberMe` from the request body

**Alternatives considered**:
- Separate "remember me" token/cookie: Over-engineered for this use case; the existing session mechanism is sufficient.
- Sliding window (extend on activity): Spec explicitly says "MUST NOT extend beyond 30 days" (FR-020), so no sliding.

**Session cookie behavior**:
- `rememberMe=true`: `maxAge: 2592000` (30 days), DB `expiresAt = now + 30d`
- `rememberMe=false`: `maxAge: undefined` (session cookie), DB `expiresAt = now + 7d` (server-side safety net)

---

## R-04: IANA Timezone Bundling

**Decision**: Use the `Intl.supportedValuesOf('timeZone')` API available in Node.js 18+ and modern browsers. No third-party package needed.

**Rationale**: Node.js ships with ICU data that includes all IANA timezone identifiers. `Intl.supportedValuesOf('timeZone')` returns the full list (~450 entries). This satisfies NFR-003 (no internet required) without bundling a static file. The frontend can also use this API to populate the dropdown.

**Alternatives considered**:
- `moment-timezone` data: Large dependency; moment is deprecated.
- Static JSON file checked into repo: Works but goes stale; `Intl` is always current with the Node.js/browser version.
- `luxon` / `date-fns-tz`: Unnecessary dependency; `Intl` covers the timezone list need.

**Timezone application**:
- Stored in `app_shell_settings` as `homeTimezone` (already exists in schema).
- Backend scheduled jobs use `Intl.DateTimeFormat` with the configured timezone to resolve "7:00 AM local" to UTC.
- Frontend clock widget and calendar display already respect `homeTimezone` from shell settings.

---

## R-05: Cron Scheduling in Node.js

**Decision**: Use `croner` (formerly `cron`) — a lightweight, zero-dependency cron parser and scheduler for Node.js.

**Rationale**: The scheduled jobs system needs to parse cron expressions (FR-023) and trigger callbacks. `croner` is:
- Zero dependencies, ~15 KB
- Supports standard 5-field cron + seconds
- Has timezone support (pass IANA timezone to `Cron` constructor)
- Works offline (NFR-003)
- Well-maintained, MIT licensed

**Alternatives considered**:
- `node-cron`: Popular but has known timezone issues and less active maintenance.
- `node-schedule`: Heavier, more features than needed.
- Custom `setInterval` polling: Current approach for calendar sync; doesn't support cron expressions and requires constant polling.
- `bree`: Worker-thread based; overkill for this use case.

**Simple time-based scheduling**: For "Daily at 7:00 AM" or "Weekdays at 8:30 AM," the frontend generates the equivalent cron expression (e.g., `0 7 * * *` or `30 8 * * 1-5`). The backend always stores and evaluates cron expressions; the "simple mode" is a frontend convenience.

---

## R-06: Existing Export/Import Reuse

**Decision**: The existing `dashboardService.exportDashboard()` / `importDashboard()` remain for single-dashboard operations. The new `backupService` handles full-system backup at a higher level, reading directly from all tables rather than reusing per-dashboard export.

**Rationale**: The existing dashboard export is version-aware (v1/v2) and handles dashboard-specific logic (image background downgrade, link migration). Full backup needs raw table data without these transformations. Reusing the dashboard export would add unnecessary complexity and version-coupling.

---

## R-07: Calendar Sync Migration

**Decision**: Convert `calendar-sync-service.ts` from `setInterval(runScheduledSync, 60_000)` to a system-defined scheduled job in the new `scheduled_jobs` table with a `system` flag.

**Rationale**: The spec requires consolidating all recurring tasks (FR-021). Calendar sync becomes a system job with cron `* * * * *` (every minute). Users can see it in the jobs list, adjust its schedule, and enable/disable it — but cannot delete system jobs.

**Migration path**:
1. Add `scheduled_jobs` table via Drizzle migration
2. On first startup after migration, seed a "Calendar Sync" system job if not present
3. `scheduledJobService.ts` starts a single master scheduler that evaluates all enabled jobs
4. Remove `setInterval` from `calendar-sync-service.ts`; the sync function itself remains

---

## R-08: Concurrent Restore Prevention

**Decision**: Use an in-memory `restoreInProgress` flag in `backupService`. The flag is set before the transaction begins and cleared in a `finally` block.

**Rationale**: HomeDash is single-process; an in-memory flag is sufficient (FR-010). No need for database-level locks or file locks. The flag prevents a second admin from starting a restore while one is running.

**Alternatives considered**:
- Database advisory lock: SQLite doesn't support advisory locks; the write lock during the transaction would cause the second request to fail anyway, but the error message would be unclear.
- File lock: Unnecessary complexity for a single-process app.
