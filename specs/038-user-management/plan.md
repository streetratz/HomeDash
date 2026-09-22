# Implementation Plan: User Management

**Branch**: `038-user-management` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/038-user-management/spec.md`

## Summary

Self-service profile settings (display name update, password change) on the existing Settings → General tab, plus a full admin user management UI (list, create, edit, delete, password reset) as a new Settings → Users tab. Extends the existing Fastify + Drizzle backend with new API routes following the `admin-groups.ts` CRUD pattern, and extends the React + shadcn/ui frontend following the `GroupsTab.tsx` admin UI pattern.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js backend, React frontend)
**Primary Dependencies**: Fastify 4.28, Drizzle ORM 0.45.2, argon2 0.41, React, TanStack Query, shadcn/ui, Tailwind CSS
**Storage**: SQLite via better-sqlite3 + Drizzle ORM
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: LAN-hosted Docker container (Synology NAS), web browser (mobile-first)
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: All self-service operations < 30s wall-clock; admin CRUD < 1 minute; session invalidation < 5s
**Constraints**: LAN-only, no internet dependency, < 50 users (no pagination needed), argon2id hashing for all passwords
**Scale/Scope**: ~50 users max, 7 user stories, 2 new backend route files, 1 schema migration, 3-4 new frontend components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Secure-by-Default | ✅ PASS | All new endpoints require auth (`requireAuth`/`requirePermission`). Admin endpoints gated by `requirePermission('users', 'manage')`. CSRF enforced via `assertCsrf` on all mutations. Passwords hashed with argon2id (existing pattern). Input validation at every boundary with Zod schemas. No secrets in responses (passwordHash never returned). |
| II. Mobile-First, Fluid, Accessible UI | ✅ PASS | Extends existing responsive Settings page. Uses shadcn/ui components (touch-friendly targets). Forms use `Label` for screen-reader accessibility. Dialog-based create/edit follows existing GroupsTab pattern. |
| III. LAN-Only Deployment | ✅ PASS | No external network calls. No new listening ports. Follows existing CORS/cookie config. |
| IV. Operational Readiness | ✅ PASS | Structured logging via existing Fastify logger. Error handling follows existing patterns (explicit status codes, consistent error shapes). No new long-running operations. |
| V. Testing & Change Safety | ✅ PASS | Schema change (add `lastLoginAt`) requires Drizzle migration with upgrade notes. Backend routes will have unit/integration tests. Frontend E2E tests for critical paths (self-service profile, admin CRUD). Logs structure will be created per constitution requirements. |
| Security & Privacy | ✅ PASS | Passwords stored as argon2id hashes only. Current password required for self-service change. Session invalidation on password change. Admin cannot delete self or demote last admin. No sensitive data in logs. |
| Dev Workflow | ✅ PASS | Spec and plan produced from `.specify` templates. Constitution Check included. Threat model note below. |

**Threat Model Note** (required for auth/data-storage changes):
- *Exposure*: New API endpoints expose user CRUD and password operations.
- *Who can access*: Self-service endpoints → authenticated user (own data only). Admin endpoints → users with `requirePermission('users', 'manage')`.
- *Mitigations*: CSRF tokens on all mutations. Current password verification for self-service password change. argon2id hashing. Session invalidation on password change. Rate limiting already applied at auth layer. Admin self-deletion and last-admin-removal prevented server-side.

## Project Structure

### Documentation (this feature)

```text
specs/038-user-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md # REST API contracts for all new endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   └── schema/
│   │       └── index.ts           # Add lastLoginAt to users table
│   ├── api/
│   │   ├── user.ts                # Extend: PUT /api/user/profile, PUT /api/user/password
│   │   ├── admin-users.ts         # NEW: Full admin user CRUD routes
│   │   └── index.ts               # Register new admin-users routes
│   └── auth/
│       ├── password.ts            # Existing: hashPassword, verifyPassword
│       └── sessionStore.ts        # Existing: session CRUD (invalidation by userId)
├── drizzle/                       # Migration files for schema changes
└── tests/

frontend/
├── src/
│   ├── components/
│   │   └── settings/
│   │       ├── GeneralTab.tsx     # Extend: display name edit + password change form
│   │       └── UsersTab.tsx       # NEW: Admin user management tab
│   ├── pages/
│   │   └── SettingsPage.tsx       # Extend: add "Users" tab (admin-only)
│   └── state/
│       └── users.ts               # NEW: TanStack Query hooks for user management
└── tests/
```

**Structure Decision**: Existing monorepo web application layout (`backend/` + `frontend/`). New backend routes in `backend/src/api/admin-users.ts` following the `admin-groups.ts` pattern. Self-service endpoints extend the existing `backend/src/api/user.ts`. Frontend adds `UsersTab.tsx` alongside existing `GroupsTab.tsx` and extends `GeneralTab.tsx`.

## Complexity Tracking

> No constitution violations identified. All gates pass.
