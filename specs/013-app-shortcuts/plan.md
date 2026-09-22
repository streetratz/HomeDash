# Implementation Plan: App Shortcuts Widget

**Branch**: `013-app-shortcuts` | **Date**: 2025-07-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-app-shortcuts/spec.md`

## Summary

A dedicated App Shortcuts widget that displays application icons with names, links, and optional health/status indicators in a configurable grid layout. Shortcuts support auto-favicon fetching, custom icon uploads, grouping/categorisation, drag-and-drop reordering, and periodic server-side health pings. The widget integrates into the existing widget registry system — config is stored in `configJson` for layout metadata (columns, groups) while shortcut data lives in dedicated DB tables for efficient CRUD and icon management.

## Technical Context

**Language/Version**: TypeScript 5+ (Node.js backend, React 18 frontend)
**Primary Dependencies**: Fastify + Drizzle ORM + better-sqlite3 + Zod (backend); React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + react-grid-layout (frontend)
**Storage**: SQLite via Drizzle ORM; file uploads in `$HOMEDASH_DATA_DIR/uploads/`
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: LAN-hosted Docker (Synology NAS), browser clients 320px–2560px
**Project Type**: pnpm monorepo (web application — `backend/` + `frontend/`)
**Performance Goals**: Widget renders ≤50 shortcuts in <1s; status pings complete within 30s per widget instance
**Constraints**: LAN-only (no internet dependency for core features); offline-first; <5s favicon fetch timeout
**Scale/Scope**: Single-user to small household; up to ~50 shortcuts per widget instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: All shortcut CRUD routes are admin-authenticated + CSRF-protected. Status pings run server-side only (NFR-001). Icon uploads validated via magic-byte MIME detection (existing pattern). No secrets in shortcut data. File uploads size-capped at 512 KB.
- [x] **LAN-only boundary**: Favicon fetching targets LAN URLs; external is best-effort. No outbound callbacks. Status pings hit user-provided LAN URLs only. CORS unchanged (existing config). No new listening ports.
- [x] **Mobile-first UI**: Grid columns adapt responsively (FR-010). Touch targets ≥44×44px (NFR-004). Semantic HTML + ARIA labels on shortcut items and drag handles. Keyboard-navigable shortcut grid.
- [x] **Operability**: Failed favicon fetches and status pings logged with URL + error (NFR-005). Structured logging via existing Fastify logger. Error responses use existing `Errors` utility (consistent format).
- [x] **Testing & change safety**: Backend service + route tests (Vitest). Frontend widget component + config form tests (Vitest + RTL). E2E for add/edit/delete/launch flows (Playwright). New DB tables require Drizzle migration. Schema documented in data-model.md.

## Project Structure

### Documentation (this feature)

```text
specs/013-app-shortcuts/
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity schemas
├── quickstart.md        # Phase 1: dev setup & verification
├── contracts/           # Phase 1: API contracts (OpenAPI)
│   └── app-shortcuts-api.yaml
└── tasks.md             # Phase 2: implementation tasks (generated separately)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/schema/index.ts              # + appShortcuts, shortcutGroups tables
│   ├── services/
│   │   ├── appShortcutService.ts       # NEW — shortcut + group CRUD
│   │   ├── faviconFetchService.ts      # NEW — server-side favicon extraction
│   │   ├── shortcutPingService.ts      # NEW — periodic health checks (extends statusCheckService pattern)
│   │   └── statusCheckService.ts       # EXISTING — reusable executeChecks()
│   └── api/
│       └── admin-app-shortcuts.ts      # NEW — all shortcut/group/ping routes
└── tests/
    └── services/
        ├── appShortcutService.test.ts
        ├── faviconFetchService.test.ts
        └── shortcutPingService.test.ts

frontend/
├── src/
│   ├── components/widgets/
│   │   ├── AppShortcutsWidget.tsx       # NEW — display component
│   │   ├── AppShortcutsConfigForm.tsx   # NEW — config form (columns, groups, shortcuts)
│   │   └── registry.tsx                 # MODIFIED — register 'app_shortcuts' type
│   └── state/
│       ├── dashboards.ts               # MODIFIED — + AppShortcutsConfig interface
│       └── appShortcutHooks.ts          # NEW — TanStack Query hooks for shortcuts/pings
└── tests/
    └── components/
        ├── AppShortcutsWidget.test.tsx
        └── AppShortcutsConfigForm.test.tsx
```

**Structure Decision**: Web application monorepo (existing). New files follow established conventions: service in `backend/src/services/`, routes in `backend/src/api/`, widget components in `frontend/src/components/widgets/`, hooks in `frontend/src/state/`. Shortcut data stored in dedicated DB tables (not purely in `configJson`) to support efficient CRUD, icon asset FK references, and future cross-widget shortcut sharing.

## Complexity Tracking

> No constitution violations identified. All gates pass.
