# Data Model — Full Backup & Restore + Settings Enhancements

## Table of Contents
- [New Entities](#new-entities)
- [Modified Entities](#modified-entities)
- [Backup File Schema](#backup-file-schema)

---

## New Entities

### scheduled_jobs

Stores all recurring task definitions — both system-defined (e.g., calendar sync) and user-created (e.g., Sonos playback).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID, server-generated |
| `name` | TEXT | NOT NULL | Human-readable job name |
| `action_type` | TEXT | NOT NULL | Enum: `calendar_sync`, `sonos_playback` |
| `action_params` | TEXT | NOT NULL, default `'{}'` | JSON blob of action-specific parameters |
| `cron_expression` | TEXT | NOT NULL | Standard 5-field cron expression |
| `enabled` | INTEGER | NOT NULL, default `1` | 0 = disabled, 1 = enabled |
| `is_system` | INTEGER | NOT NULL, default `0` | 1 = system-defined (cannot be deleted by users) |
| `last_run_at` | TEXT | nullable | ISO8601 timestamp of last execution |
| `last_run_status` | TEXT | nullable | Enum: `success`, `failure` |
| `last_run_error` | TEXT | nullable | Error message if last run failed |
| `disabled_reason` | TEXT | nullable | Why job was auto-disabled (e.g., missing integration) |
| `created_at` | TEXT | NOT NULL | ISO8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO8601 timestamp |

**Indexes**: None beyond PK (low row count expected).

**Relationships**: None (action params reference integrations by config, not FK).

**Validation rules** (Zod):
- `name`: 1–100 characters
- `action_type`: one of defined enum values
- `action_params`: valid JSON; schema depends on `action_type`
- `cron_expression`: valid 5-field cron (validated by `croner` parser)

**Action param schemas by type**:

```typescript
// calendar_sync — no additional params (uses existing calendar sources)
type CalendarSyncParams = Record<string, never>;

// sonos_playback
interface SonosPlaybackParams {
  userId: string;          // which user's Sonos account to use
  householdId: string;     // Sonos household
  groupId: string;         // Sonos group (speaker set)
  favoriteId: string;      // Sonos favorite/playlist ID
  volume?: number;         // 0-100, optional
  playOnCompletion?: boolean; // default true
}
```

**State transitions**:
```
[created] → enabled=true → runs on schedule → last_run_status updated
                         → user disables → enabled=false
                         → user re-enables → enabled=true
[restored from backup with missing integration] → enabled=false, disabled_reason set
[system job] → cannot be deleted, can be disabled/enabled
```

---

## Modified Entities

### sessions (existing)

No schema change. Behavioral change only:

- `createSession()` accepts optional `ttlMs` parameter
- When `rememberMe=true`: `expiresAt = now + 30 days`
- When `rememberMe=false`: `expiresAt = now + 7 days` (existing behavior)

The `maxAge` on the cookie changes correspondingly:
- `rememberMe=true`: `maxAge = 2592000` (30 days in seconds)
- `rememberMe=false`: `maxAge = undefined` (session cookie, cleared on browser close)

### app_shell_settings (existing)

No schema change. The `homeTimezone` column already exists. The feature adds:
- A dedicated timezone selection UI in Settings → General
- Backend validation that the value is a valid IANA timezone identifier
- Frontend propagation to clock, calendar, and scheduled jobs

---

## Backup File Schema

### Envelope

```typescript
interface BackupFile {
  format: 'homedash-backup';
  version: 1;
  appVersion: string;            // e.g., "1.5.0"
  exportedAt: string;            // ISO8601
  summary: BackupSummary;
  data: BackupData;
}

interface BackupSummary {
  users: number;
  dashboards: number;
  widgets: number;
  groups: number;
  scheduledJobs: number;
  calendarSources: number;
  todoLists: number;
  integrations: number;
  photoSources: number;
}
```

### Data Section

Each key maps to a table name and contains an array of row objects. Sensitive fields are stripped during export.

```typescript
interface BackupData {
  users: BackupUser[];                          // excludes passwordHash
  userPreferences: UserPreference[];
  appShellSettings: AppShellSettings[];         // typically 1 row
  dashboards: Dashboard[];
  placeholderWidgets: PlaceholderWidget[];
  placeholderBreakpointLayouts: BreakpointLayout[];
  appWidgetInstances: WidgetInstance[];
  linksListItems: LinkItem[];
  calendarSources: BackupCalendarSource[];      // excludes OAuth tokens
  todoLists: TodoList[];
  todoItems: TodoItem[];
  groups: Group[];
  groupPermissions: GroupPermission[];
  userGroupMemberships: Membership[];
  dashboardAccessRules: AccessRule[];
  shortcutGroups: ShortcutGroup[];
  appShortcuts: Shortcut[];
  piholeInstances: PiholeInstance[];
  unifiInstances: UnifiInstance[];
  dockerConnections: DockerConnection[];
  widgetConnections: WidgetConnection[];
  integrationConfigs: IntegrationConfig[];
  photoSources: PhotoSource[];
  scheduledJobs: ScheduledJob[];
  caldavAccounts: BackupCaldavAccount[];        // excludes password
  oauthAccounts: BackupOAuthAccount[];          // excludes tokens
}
```

### Excluded from backup
| Table | Reason |
|-------|--------|
| `sessions` | Transient auth state; invalidated on restore |
| `calendar_events` | Derived data; re-synced from sources |
| `shortcut_ping_results` | Transient runtime data |
| `icon_cache_entries` | Cache; rebuilt on demand |
| `uploaded_assets` | Binary files; out of scope per spec |

### Sensitive field exclusions
| Table | Excluded Fields |
|-------|----------------|
| `users` | `passwordHash` |
| `oauth_accounts` | `accessToken`, `refreshToken`, `tokenExpiresAt` |
| `caldav_accounts` | `password` |
