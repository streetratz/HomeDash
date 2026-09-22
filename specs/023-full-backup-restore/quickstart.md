# Quickstart — Full Backup & Restore + Settings Enhancements

## Prerequisites

- Node.js 18+ (for `Intl.supportedValuesOf` timezone API)
- pnpm (workspace manager)
- Existing HomeDash dev environment running

## Setup

```bash
# From repo root
pnpm install

# Generate the new scheduled_jobs migration
cd backend
npx drizzle-kit generate

# Run migrations
npx tsx src/db/migrate.ts

# Start dev servers
cd ..
pnpm dev
```

## New Dependencies

### Backend
- `croner` — Zero-dependency cron expression parser and scheduler. Used by `scheduledJobService.ts` to schedule recurring jobs with timezone support.

```bash
cd backend && pnpm add croner
```

### Frontend
No new dependencies. Timezone list uses native `Intl.supportedValuesOf('timeZone')`.

## Key Files

| Area | File | Purpose |
|------|------|---------|
| DB Schema | `backend/src/db/schema/index.ts` | New `scheduled_jobs` table definition |
| Backup Service | `backend/src/services/backupService.ts` | Full export/import logic |
| Job Scheduler | `backend/src/services/scheduledJobService.ts` | Unified cron-based job execution |
| Session Store | `backend/src/auth/sessionStore.ts` | Variable TTL for "Remember Me" |
| Backup Routes | `backend/src/api/admin-backup.ts` | `/api/admin/backup`, `/preview`, `/restore` |
| Job Routes | `backend/src/api/admin-scheduled-jobs.ts` | CRUD for scheduled jobs |
| Login Page | `frontend/src/pages/LoginPage.tsx` | "Remember Me" checkbox |
| General Tab | `frontend/src/components/settings/GeneralTab.tsx` | Timezone dropdown |
| Backup UI | `frontend/src/components/settings/BackupRestoreSection.tsx` | Download/upload/restore UI |
| Jobs Tab | `frontend/src/components/settings/ScheduledJobsTab.tsx` | Jobs management UI |

## API Contracts

See `contracts/backup-restore-api.yaml` for full OpenAPI specification.

### Quick Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/backup` | Admin | Download backup file |
| POST | `/api/admin/backup/preview` | Admin | Preview backup contents |
| POST | `/api/admin/backup/restore` | Admin | Restore from backup |
| GET | `/api/admin/backup/database` | Admin | Download full SQLite backup |
| POST | `/api/auth/login` | None | Login (now with `rememberMe` param) |
| GET | `/api/admin/timezones` | Auth | List IANA timezones |
| GET | `/api/admin/scheduled-jobs` | Admin | List all jobs |
| POST | `/api/admin/scheduled-jobs` | Admin | Create job |
| PUT | `/api/admin/scheduled-jobs/:id` | Admin | Update job |
| DELETE | `/api/admin/scheduled-jobs/:id` | Admin | Delete job (user-created only) |
| POST | `/api/admin/scheduled-jobs/:id/run` | Admin | Trigger job immediately |

## Environment Variables

No new environment variables required. All new features use existing configuration:
- Database path: `HOMEDASH_DATA_DIR` (existing)
- Cookie security: `COOKIE_SECURE` (existing)

## Testing

```bash
# Backend unit tests
cd backend && pnpm test

# Frontend E2E tests
cd frontend && pnpm test:e2e

# Specific test files
cd backend && pnpm vitest run tests/backupService.test.ts
cd backend && pnpm vitest run tests/scheduledJobService.test.ts
cd backend && pnpm vitest run tests/sessionStore.test.ts
```

## Notes

- **Backup format version**: v1. The `version` field in the backup file allows future format evolution with backward-compatible readers.
- **Restore is destructive**: Replaces ALL data atomically. Users must type "RESTORE" to confirm.
- **Timezone**: Uses the existing `homeTimezone` field in `app_shell_settings`. The new feature adds a dedicated UI for selecting it.
- **Calendar sync migration**: The existing `setInterval` in `calendar-sync-service.ts` will be replaced by a system-defined scheduled job. The sync logic itself remains unchanged.
- **Full database backup**: Uses better-sqlite3's `.backup()` API for hot, consistent SQLite copies. Two system jobs run daily at 2am: Database Backup (.db) and Portable Backup (.json). Both use a retention policy of 7 files by default. Configure via Settings → Scheduled Jobs.
- **RESTORE_README.md**: Auto-generated in the backups directory on every backup run with restore instructions for all scenarios.
