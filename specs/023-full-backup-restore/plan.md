# Implementation Plan: Full Backup & Restore + Settings Enhancements

**Branch**: `023-full-backup-restore` | **Date**: 2025-07-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/023-full-backup-restore/spec.md`

## Summary

Add full system backup/restore (all 29 tables minus secrets), an application-wide IANA timezone setting, login "Remember Me" with configurable session TTL, and a unified scheduled-jobs system replacing scattered `setInterval` patterns. The implementation extends the existing Fastify + Drizzle + React + shadcn/ui stack with new backend services, Drizzle migrations for the `scheduled_jobs` table, and new Settings UI tabs/sections.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js backend, Vite/React frontend)
**Primary Dependencies**: Fastify, Drizzle ORM, better-sqlite3, Zod (backend); React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query (frontend)
**Storage**: SQLite via Drizzle ORM (`backend/src/db/schema/index.ts`, 29 tables)
**Testing**: Vitest (backend unit/integration), Playwright (frontend E2E)
**Target Platform**: Docker container on Synology NAS (LAN-only, host networking)
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: Backup generation ≤ 10s for ≤ 20 dashboards / ≤ 100 widgets (NFR-008); scheduled jobs execute within 60s of target time (SC-008)
**Constraints**: LAN-only (no internet for core features, NFR-003); timezone list must be bundled; backup files ≤ ~10 MB typical
**Scale/Scope**: Single-household deployment; ≤ 5 concurrent users; ≤ 20 dashboards, ≤ 100 widgets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: Backup/restore endpoints gated by `requireAdmin` middleware. Password hashes and OAuth tokens excluded from backup (FR-005). "Remember Me" sessions use existing HttpOnly + SameSite=Lax cookies with CSRF protection. No new secrets introduced.
- [x] **LAN-only boundary**: No new network listeners or external callbacks. IANA timezone list bundled as static data (NFR-003). No telemetry/analytics (NFR-004). Existing CORS/binding unchanged.
- [x] **Mobile-first UI**: New Settings sections (timezone dropdown, scheduled jobs tab) use existing shadcn/ui responsive patterns. Login "Remember Me" checkbox is a standard form element. All new UI passes NFR-005 mobile/desktop requirement.
- [x] **Operability**: Backup/restore/job operations emit structured logs (NFR-006). Restore uses single-transaction atomics with full rollback (FR-004). Job failures logged with reason (FR-025). Existing health endpoints unchanged.
- [x] **Testing & change safety**: New `scheduled_jobs` table requires Drizzle migration. Backup format versioned (FR-003/FR-009). Backend services get Vitest unit tests; auth changes get positive/negative test coverage. E2E tests for backup/restore and login flows.

**Threat Model Notes**:
- Backup files contain user data (usernames, display names, dashboard configs) but NO password hashes or OAuth tokens. Files are downloaded over the existing session-authenticated, CSRF-protected channel.
- Restore is destructive (replaces all data) and is double-gated: admin-only + explicit confirmation word (FR-007). Concurrent restore is prevented (FR-010).
- "Remember Me" extends session from 7 days to 30 days maximum. Session cookie remains HttpOnly/SameSite=Lax. Explicit logout immediately destroys the session regardless of TTL (FR-019).

## Project Structure

### Documentation (this feature)

```text
specs/023-full-backup-restore/
├── plan.md              # This file
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: developer onboarding
├── contracts/           # Phase 1: API contracts
│   └── backup-restore-api.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/schema/index.ts          # Add scheduled_jobs table
│   ├── services/
│   │   ├── backupService.ts        # NEW: full backup export/import logic
│   │   ├── scheduledJobService.ts   # NEW: unified job scheduler
│   │   ├── shellSettingsService.ts  # MODIFY: timezone helpers
│   │   └── calendar-sync-service.ts # MODIFY: convert to use scheduledJobService
│   ├── auth/
│   │   └── sessionStore.ts          # MODIFY: variable TTL for "Remember Me"
│   └── api/
│       ├── admin-backup.ts          # NEW: backup/restore endpoints
│       └── admin-scheduled-jobs.ts  # NEW: job CRUD endpoints
├── drizzle/                         # NEW migration files
└── tests/
    ├── backupService.test.ts        # NEW
    ├── scheduledJobService.test.ts   # NEW
    └── sessionStore.test.ts          # MODIFY: remember-me TTL tests

frontend/
├── src/
│   ├── components/settings/
│   │   ├── GeneralTab.tsx           # MODIFY: add timezone dropdown
│   │   ├── BackupRestoreSection.tsx  # NEW: backup/restore UI
│   │   └── ScheduledJobsTab.tsx      # NEW: jobs management tab
│   ├── pages/
│   │   ├── LoginPage.tsx            # MODIFY: add "Remember Me" checkbox
│   │   └── SettingsPage.tsx         # MODIFY: add new tab for scheduled jobs
│   └── state/
│       ├── backupHooks.ts           # NEW: TanStack Query hooks
│       └── scheduledJobHooks.ts     # NEW: TanStack Query hooks
└── tests/
    └── e2e/                         # E2E tests for backup, login, jobs
```

**Structure Decision**: Follows the existing web-application monorepo layout with `backend/` and `frontend/` workspaces. New backend services follow the existing flat-service pattern in `backend/src/services/`. New API routes follow the existing `register*Routes()` pattern. Frontend follows existing shadcn/ui component patterns with TanStack Query hooks in `frontend/src/state/`.

## Complexity Tracking

No constitution violations identified. All features conform to existing patterns.
