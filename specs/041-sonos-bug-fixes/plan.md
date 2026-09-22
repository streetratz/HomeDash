# Implementation Plan: Sonos Widget Bug Fixes

**Branch**: `041-sonos-bug-fixes` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/041-sonos-bug-fixes/spec.md`

## Summary

Fix three Sonos widget bugs: (1) stereo-paired speakers appearing as phantom rooms in the dashboard by filtering invisible zone group members from `getGroups()`, (2) volume slider overwriting all member volumes instead of sending commands to the coordinator only, and (3) now-playing text animation improvements — only animating when text overflows, pausing when playback stops, and adding marquee to the fullscreen view.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022 target)  
**Primary Dependencies**: Fastify (backend), React 18 + TanStack Query (frontend), node-sonos (UPnP control), Tailwind CSS  
**Storage**: N/A (no data persistence changes — Sonos state is real-time from UPnP)  
**Testing**: Vitest (unit/integration), Playwright (E2E)  
**Target Platform**: Docker on Synology NAS (LAN-only), browser clients (mobile-first)  
**Project Type**: Web application (monorepo: backend + frontend)  
**Performance Goals**: Volume changes < 200ms perceived latency; marquee animation at 60fps  
**Constraints**: LAN-only, low-power device friendly, no external network calls for core functionality  
**Scale/Scope**: Single household, 1-20 Sonos speakers, 1-10 zone groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|-------------|--------|-------|
| I. Secure-by-Default | ✅ Yes | ✅ PASS | No new endpoints; existing auth on Sonos routes unchanged |
| II. Mobile-First, Fluid, Accessible UI | ✅ Yes | ✅ PASS | Marquee fix improves readability; no new UI surfaces |
| III. LAN-Only Deployment Boundary | ✅ Yes | ✅ PASS | All fixes remain local UPnP — no external calls |
| IV. Operational Readiness | ✅ Yes | ✅ PASS | No new failure modes; existing error handling remains |
| V. Testing & Change Safety | ✅ Yes | ⏳ REQUIRED | Must add unit tests for stereo pair filtering and volume coordinator logic |
| Security & Privacy | ✅ Yes | ✅ PASS | No credential or data handling changes |
| Dev Workflow | ✅ Yes | ⏳ REQUIRED | Must create logs/ structure per constitution |

**Gate Result**: ✅ PASS — No violations. Testing obligations will be met during implementation.

## Project Structure

### Documentation (this feature)

```text
specs/041-sonos-bug-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── services/
│   │   ├── sonos-local-service.ts   # Bug 1: filter invisible members from getGroups()
│   │   │                            # Bug 2: setGroupVolume() → coordinator only
│   │   └── sonos-adapter.ts         # Passes through to local service
│   └── api/
│       └── sonos.ts                 # REST routes (no changes expected)
└── tests/
    └── unit/
        └── sonosDiscovery.test.ts   # Add stereo pair filtering tests

frontend/
├── src/
│   ├── components/
│   │   ├── widgets/
│   │   │   └── SonosWidget.tsx      # Bug 3: conditional marquee based on overflow
│   │   └── sonos/
│   │       └── FullScreenSonos.tsx   # Bug 3: add marquee to fullscreen track title
│   ├── hooks/
│   │   └── useSonos.ts              # No changes expected
│   └── tailwind.config.ts           # Existing marquee keyframes (reuse)
└── tests/
    └── (vitest unit tests for overflow detection hook)
```

**Structure Decision**: Existing monorepo web application structure (backend/ + frontend/ pnpm workspaces). No structural changes — all fixes are within existing files.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
