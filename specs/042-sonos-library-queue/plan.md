# Implementation Plan: Sonos Library Queue Actions & Sub-Navigation

**Branch**: `042-sonos-library-queue` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/042-sonos-library-queue/spec.md`

## Summary

Add container-level queue actions ("Add to Queue" and "Replace Queue") to the Sonos music library browser and ensure all library sub-tabs (folders, artists, albums, tracks, playlists, genres) are fully functional with drill-down navigation. The existing backend APIs already support single-URI queue operations (`addToQueue`, `clearQueue`, `playFromQueue`) and library browsing (`browseLibrary`, `browseContainer`). The primary work is:

1. **Backend**: Add a new endpoint to resolve all tracks within a container (recursively browse to leaf tracks), then batch-enqueue them. Add a composite "replace queue and play" endpoint that atomically clears → adds → plays.
2. **Frontend**: Wire the existing `PlayActionMenu` on container items (not just tracks) in the Library tab, add a "genres" sub-tab, add debounce/loading state for queue actions, and provide toast feedback for success/error.

## Technical Context

**Language/Version**: TypeScript (ES2022 target, Node.js backend, browser frontend)
**Primary Dependencies**: Fastify (backend API), React 18 + Vite (frontend), TanStack Query (data fetching), node-sonos (Sonos device control), Drizzle ORM + better-sqlite3 (storage)
**Storage**: SQLite via Drizzle — queue/library data is runtime-only from Sonos devices, no DB persistence needed
**Testing**: Vitest (unit, both workspaces), Playwright (E2E, frontend), Supertest (integration, backend)
**Target Platform**: LAN-hosted Docker container (Synology NAS), browser clients (mobile-first, 360px+)
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Performance Goals**: Queue action feedback visible within 3 seconds (SC-004); large containers (100+ tracks) must not timeout (SC-006)
**Constraints**: Local-mode only (queue/library APIs require node-sonos on LAN); must not interrupt current playback on "Add to Queue"
**Scale/Scope**: Single-user dashboard; music libraries of ~1,000–50,000 tracks; queue operations up to ~500 tracks per batch

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Applies? | Status | Notes |
|---|-----------|----------|--------|-------|
| I | Secure-by-Default | ✅ Yes | ✅ PASS | All new endpoints require auth (`requireAuth`) + CSRF (`assertCsrf`) for mutations. No new secrets, no public endpoints. |
| II | Mobile-First, Fluid, Accessible UI | ✅ Yes | ✅ PASS | Queue action buttons on containers use existing `PlayActionMenu` pattern with touch-friendly targets. Genres sub-tab follows existing pill-button pattern. |
| III | LAN-Only Deployment | ✅ Yes | ✅ PASS | No new external network calls. Library/queue APIs are local-mode only via node-sonos on LAN. |
| IV | Operational Readiness | ✅ Yes | ✅ PASS | New endpoints use existing structured logging (`sonosError`, `sonosWarn`). Errors return consistent JSON. Timeout handling for large container resolution. |
| V | Testing & Change Safety | ✅ Yes | ✅ PASS | Backend: unit tests for container track resolution, integration tests for new endpoints. Frontend: unit tests for hook logic, E2E for queue action flows. Logs directory created per constitution. |

**Pre-design gate: PASSED** — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/042-sonos-library-queue/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md # New/modified Sonos API endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── sonos.ts                    # Add new queue endpoints (container-add, replace-and-play)
│   ├── services/
│   │   ├── sonos-local-service.ts      # Add resolveContainerTracks(), addContainerToQueue(), replaceQueueAndPlay()
│   │   └── sonos-adapter.ts            # Expose new service methods through adapter
│   └── ...
└── tests/
    ├── unit/
    │   └── sonosContainerQueue.test.ts  # NEW: unit tests for container resolution logic
    └── integration/
        └── sonosQueueApi.test.ts        # NEW: integration tests for new queue endpoints

frontend/
├── src/
│   ├── components/sonos/
│   │   ├── BrowsePanel.tsx             # Wire PlayActionMenu on containers; add genres sub-tab
│   │   └── PlayActionMenu.tsx          # Add loading/disabled state prop
│   ├── hooks/
│   │   └── useSonos.ts                 # Add useAddContainerToQueue(), useReplaceQueueAndPlay() hooks
│   └── ...
└── tests/
    ├── unit/
    │   └── sonosQueueHooks.test.ts     # NEW: unit tests for container queue hooks
    └── e2e/
        └── sonosLibraryQueue.spec.ts   # NEW: E2E tests for queue action flows
```

**Structure Decision**: Existing web application monorepo (`backend/` + `frontend/`). All changes are within the established Sonos service layer and component structure. No new packages or workspaces needed.

## Complexity Tracking

No constitution violations — this section is intentionally empty.
