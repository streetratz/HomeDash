# Implementation Plan: RBAC — User Groups and Granular Permissions

**Branch**: `012-rbac-permissions` | **Date**: 2025-07-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-rbac-permissions/spec.md`

## Summary

Replace HomeDash's binary admin/user role system with a group-based RBAC model. Users are assigned to groups, each group has permissions from 5 categories (dashboards, widgets, settings, users, integrations) at view/manage levels, and a user's effective permissions are the additive union of all their groups. The migration is automatic, idempotent, and preserves the legacy `role` column for rollback safety. Per-dashboard access control (P2) and permission-aware UI (P2) build on the core group model.

**Technical approach**: Four new SQLite tables via Drizzle migration; permission loading in the existing auth middleware; new Fastify route module for group/membership CRUD; React permission context for frontend gating.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js backend, React 18 frontend)
**Primary Dependencies**: Fastify (HTTP), Drizzle ORM (DB), better-sqlite3 (SQLite), Zod (validation), React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query
**Storage**: SQLite via better-sqlite3 + Drizzle ORM; migrations in `backend/drizzle/`
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: LAN-hosted Docker container (Synology NAS, host networking)
**Project Type**: pnpm monorepo (backend + frontend workspaces)
**Performance Goals**: Permission checks must add <1ms latency per request (NFR-006); synchronous better-sqlite3 queries make this achievable
**Constraints**: LAN-only (no internet dependency); SQLite single-writer; must not break existing auth flow
**Scale/Scope**: Small user base (household/small team); 5 permission categories × 2 levels = 10 permission values; 3 built-in groups + custom groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: Server-side permission checks on all protected endpoints (NFR-001); client-side hiding is cosmetic only; CSRF protection via existing `x-csrf-token` header on all state-changing endpoints; no new secrets introduced; existing session cookie auth unchanged; admin lockout prevention (FR-013)
- [x] **LAN-only boundary**: No new ports, external callbacks, or internet dependencies (NFR-002); CORS unchanged; all RBAC data stored locally in SQLite
- [x] **Mobile-first UI**: Group management UI uses shadcn/ui components with responsive layouts (NFR-004); permission toggles are touch-friendly; forms follow existing accessibility patterns (semantic HTML, focus states)
- [x] **Operability**: Permission-denied events and group-membership changes logged with structured detail (NFR-005); existing health/readiness endpoints unchanged; consistent error responses via `AppError` + `ErrorCode` pattern
- [x] **Testing & change safety**: Schema migration includes upgrade/rollback notes; Vitest unit tests for permission logic and service layer; Vitest integration tests for API routes; Playwright E2E for admin group management flows; legacy `role` column preserved for rollback (FR-021)

### Threat Model Note (required for auth changes)

**What's exposed**: New RBAC API endpoints for group/membership management and dashboard access control.
**Who can access**: Only authenticated users with appropriate permissions (`users:manage` for writes, `users:view` for reads). The Administrators group always has full irrevocable access.
**Mitigations**: (1) Server-side permission checks on every endpoint — no security-by-obscurity. (2) CSRF protection on all mutations. (3) Admin lockout prevention — cannot remove last Administrators member. (4) Permission escalation prevented — only `users:manage` holders can modify groups. (5) Legacy role column preserved for emergency rollback.

## Project Structure

### Documentation (this feature)

```text
specs/012-rbac-permissions/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: deployment/upgrade guide
├── contracts/
│   └── rbac-api.yaml    # Phase 1: OpenAPI contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── drizzle/
│   └── NNNN_rbac_groups.sql              # Migration: new tables + seed data
├── src/
│   ├── auth/
│   │   ├── authMiddleware.ts             # MODIFIED: extend AuthUser with permissions/groups
│   │   ├── requireRole.ts                # MODIFIED: add requirePermission() helper
│   │   └── sessionStore.ts               # MODIFIED: join groups/permissions in getSession()
│   ├── db/
│   │   └── schema/
│   │       └── index.ts                  # MODIFIED: add groups, group_permissions,
│   │                                     #   user_group_memberships, dashboard_access_rules
│   ├── api/
│   │   ├── admin-groups.ts               # NEW: group CRUD routes
│   │   ├── admin-group-members.ts        # NEW: membership routes
│   │   ├── admin-dashboard-access.ts     # NEW: per-dashboard ACL routes (P2)
│   │   └── index.ts                      # MODIFIED: register new route modules
│   ├── services/
│   │   ├── groupService.ts               # NEW: group business logic
│   │   ├── membershipService.ts          # NEW: user-group assignment logic
│   │   └── dashboardAccessService.ts     # NEW: dashboard ACL logic (P2)
│   └── lib/
│       └── permissions.ts                # NEW: permission constants, helpers, types
└── tests/
    ├── unit/
    │   ├── permissions.test.ts           # Permission union/resolution tests
    │   ├── groupService.test.ts          # Group CRUD logic tests
    │   └── membershipService.test.ts     # Membership logic + lockout tests
    └── integration/
        ├── admin-groups.test.ts          # Group API route tests
        └── admin-members.test.ts         # Membership API route tests

frontend/
├── src/
│   ├── hooks/
│   │   └── usePermissions.ts             # NEW: permission context + helpers
│   ├── components/
│   │   ├── PermissionGate.tsx            # NEW: conditional render wrapper
│   │   └── rbac/
│   │       ├── GroupList.tsx             # NEW: group listing table
│   │       ├── GroupForm.tsx             # NEW: create/edit group form
│   │       ├── GroupMembers.tsx          # NEW: member management
│   │       ├── PermissionGrid.tsx        # NEW: permission category toggle grid
│   │       └── DashboardAccessForm.tsx   # NEW: per-dashboard ACL editor (P2)
│   ├── pages/
│   │   ├── GroupManagementPage.tsx       # NEW: admin groups page
│   │   └── AccessDeniedPage.tsx          # NEW: permission-denied landing
│   └── lib/
│       └── apiClient.ts                  # MODIFIED: add RBAC API methods
└── tests/
    └── e2e/
        └── rbac.spec.ts                  # E2E: group management flows
```

**Structure Decision**: Follows the existing pnpm monorepo layout (backend/ + frontend/). New RBAC code is organized into dedicated route modules, service files, and frontend components following the established patterns (e.g., `admin.ts` → `admin-groups.ts`, service layer separation, shadcn/ui components).

## Complexity Tracking

> No constitution violations. All gates pass.
