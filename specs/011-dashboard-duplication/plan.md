# Implementation Plan: Dashboard Duplication

**Branch**: `011-dashboard-duplication` | **Date**: 2025-07-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-dashboard-duplication/spec.md`

## Summary

Allow admins to duplicate an existing dashboard — creating a deep, independent copy of all widgets, links, placeholders, layout positions, and background settings — via a single action in the dashboard management UI. The technical approach leverages the existing `exportDashboard()` / `importDashboard()` pipeline in `dashboardService.ts`, wrapping both into a single atomic `duplicateDashboard()` service method behind a new `POST /api/admin/dashboards/:dashboardId/duplicate` endpoint. The frontend adds a "Duplicate" button to each dashboard card with toast feedback, following existing mutation patterns.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) — pnpm monorepo
**Primary Dependencies**: Fastify 4.28, Drizzle ORM 0.45.2, better-sqlite3 11.3, Zod 3.23, React 18, Vite, TanStack Query, shadcn/ui, Tailwind CSS, react-grid-layout
**Storage**: SQLite (WAL mode) via better-sqlite3 + Drizzle ORM; data at `HOMEDASH_DATA_DIR/db/homedash.sqlite`
**Testing**: Vitest (unit + integration + contract), Playwright (E2E), supertest (HTTP)
**Target Platform**: Docker container on Synology NAS (host networking), LAN-only
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Performance Goals**: Duplication of dashboard with up to 50 widgets completes within 3 seconds (NFR-006)
**Constraints**: LAN-only (no internet), single SQLite DB, atomic operations required (FR-007)
**Scale/Scope**: Single admin user per session; dashboards with 0–50 placeholders, each with 0–N widgets and links

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: Endpoint requires `requireAdmin()` + `assertCsrf()` (same as existing dashboard mutations). No new secrets introduced. No new headers needed (existing CSP/security headers apply).
- [x] **LAN-only boundary**: No new ports, bindings, or external calls. Operates entirely within existing Fastify server on the same LAN-bound socket.
- [x] **Mobile-first UI**: Duplicate button uses existing `Button variant="ghost" size="icon"` pattern (touch-friendly, 36×36px target). Action is visible in dashboard card row. `aria-label` provided for screen readers.
- [x] **Operability**: Structured logging via Fastify `request.log.info/error`. Duplicate failures logged with source dashboard ID and error details. No new health endpoints needed.
- [x] **Testing & change safety**: Backend unit + integration tests for `duplicateDashboard()`. Contract test for new endpoint. E2E test for full duplicate flow. No schema migration (no DB changes). No breaking API changes (additive endpoint only).

**Post-Phase 1 Re-check**: ✅ All gates remain satisfied. No schema migrations, no new external dependencies, no new auth surfaces. Additive-only changes.

## Project Structure

### Documentation (this feature)

```text
specs/011-dashboard-duplication/
├── plan.md              # This file
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: entity model for duplication
├── quickstart.md        # Phase 1: developer quickstart
├── contracts/           # Phase 1: API contract
│   └── duplicate-dashboard.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── adminDashboards.ts          # + POST /:dashboardId/duplicate route
│   ├── services/
│   │   └── dashboardService.ts         # + duplicateDashboard() method
│   └── lib/
│       └── validation.ts               # + DuplicateDashboardSchema (if needed)
└── tests/
    ├── unit/
    │   └── dashboardDuplication.test.ts # Unit tests for name generation + service
    ├── integration/
    │   └── dashboardDuplication.test.ts # Integration test with real DB
    └── contract/
        └── dashboardDuplication.test.ts # Contract test for endpoint shape

frontend/
├── src/
│   ├── pages/
│   │   └── DashboardManagementPage.tsx  # + Duplicate button in card actions
│   └── state/
│       └── adminDashboards.ts           # + useDuplicateDashboard() hook
└── tests/
    └── e2e/
        └── dashboardDuplication.spec.ts # E2E test for duplicate flow
```

**Structure Decision**: Existing web application monorepo structure (`backend/` + `frontend/`). No new directories needed — all changes are additions to existing files plus new test files.

## Complexity Tracking

> No constitution violations. All changes are additive and follow existing patterns.
