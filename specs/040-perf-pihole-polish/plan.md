# Implementation Plan: Performance Optimizations & Pi-hole Widget Polish

**Branch**: `040-perf-and-polish` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/040-perf-pihole-polish/spec.md`

## Summary

Bundle a set of frontend-only performance and UI polish improvements: (1) reduce polling frequency for Pi-hole and UniFi widgets to 60s with stale-while-revalidate, (2) implement adaptive/visibility-aware polling for the Spotify widget, (3) introduce route-level code splitting via React.lazy to shrink the initial bundle, and (4) fix Pi-hole widget overflow at 180px grid cells.

## Technical Context

**Language/Version**: TypeScript 5.x, Node ≥22.13 (tooling), ES2022 target  
**Primary Dependencies**: React 18+, React Router v6, TanStack Query, Vite 5+, Tailwind CSS  
**Storage**: N/A (frontend-only changes; backend unchanged)  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Web application (pnpm monorepo: `frontend/` + `backend/`)  
**Performance Goals**: Initial route chunk < 500KB; ≤ 1 req/60s for Pi-hole/UniFi; 0 req when Spotify tab hidden  
**Constraints**: No server-side changes; must preserve existing user-configured polling intervals  
**Scale/Scope**: 4 pages (routes), ~3 widget families affected, single-user LAN dashboard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Relevant? | Status | Notes |
|---|-----------|-----------|--------|-------|
| I | Secure-by-Default | No | ✅ PASS | No auth/network/endpoint changes |
| II | Mobile-First, Fluid, Accessible UI | Yes | ✅ PASS | Pi-hole compact layout improves mobile; code splitting reduces bundle; no accessibility regressions |
| III | LAN-Only Deployment Boundary | No | ✅ PASS | No deployment/network binding changes |
| IV | Operational Readiness | Minor | ✅ PASS | Error boundary for chunk failures provides user-facing recovery |
| V | Testing & Change Safety | Yes | ✅ PASS | Must add unit tests for polling logic, E2E for code-split navigation |

**Gate result**: All principles satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/040-perf-pihole-polish/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A — no new external interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/
│   │   └── router.tsx              # Code-split route definitions (React.lazy)
│   ├── components/
│   │   ├── widgets/
│   │   │   ├── PiholeWidget.tsx    # Compact layout at small grid sizes
│   │   │   └── SpotifyWidget.tsx   # Visibility-aware polling integration
│   │   └── ErrorBoundary.tsx       # Chunk-load error boundary (new)
│   ├── hooks/
│   │   ├── useSpotify.ts           # Adaptive polling intervals
│   │   ├── useVisibility.ts        # Tab/viewport visibility hook (new)
│   │   └── useSpotifyPlayer.ts
│   ├── pages/
│   │   ├── DashboardPage.tsx       # Lazy-loaded
│   │   ├── SettingsPage.tsx        # Lazy-loaded
│   │   ├── FirstRunPage.tsx        # Lazy-loaded
│   │   └── LoginPage.tsx           # Lazy-loaded
│   └── state/
│       ├── piholeHooks.ts          # 60s default, stale-while-revalidate
│       └── unifiHooks.ts           # 60s default, stale-while-revalidate
└── tests/
    ├── unit/
    │   ├── useVisibility.test.ts   # Visibility hook tests
    │   └── polling.test.ts         # Adaptive polling logic tests
    └── e2e/
        └── code-splitting.spec.ts  # Navigation + chunk loading E2E
```

**Structure Decision**: Existing web application monorepo structure (`frontend/` + `backend/`). All changes are in `frontend/`. No new packages or workspaces required.

## Complexity Tracking

> No violations. Section intentionally left empty.
