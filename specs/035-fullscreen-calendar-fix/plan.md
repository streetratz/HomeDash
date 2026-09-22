# Implementation Plan: Fix FullScreen Calendar Filtered Events

**Branch**: `035-fullscreen-calendar-fix` | **Date**: 2025-01-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/035-fullscreen-calendar-fix/spec.md`

## Summary

The FullScreenCalendar component currently receives pre-filtered events as props from
CalendarWidget, meaning users only see the widget's filtered subset (limited sources,
limited days, capped event count) in the expanded view. The fix decouples the full-screen
view by having it fetch its own events independently for the entire visible month range
using all available calendar sources. No backend changes required — the existing
`/api/public/calendar/events` endpoint already supports arbitrary date ranges and sourceIds.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18+ frontend)  
**Primary Dependencies**: React, TanStack Query (useQuery), Lucide icons, Tailwind CSS  
**Storage**: N/A (reads from existing backend API)  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Web (responsive, mobile-first per constitution)  
**Project Type**: Web application (monorepo: frontend + backend)  
**Performance Goals**: Events load within 2 seconds of opening or month navigation (SC-005)  
**Constraints**: Must not break existing widget filtering; LAN-only deployment  
**Scale/Scope**: Typical home dashboard usage — modest event counts per month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|-------------|--------|-------|
| I. Secure-by-Default | ✅ Yes | ✅ PASS | Uses existing public calendar endpoint (GET-only, read-only, no auth bypass). No new endpoints introduced. |
| II. Mobile-First, Fluid, Accessible UI | ✅ Yes | ✅ PASS | FullScreenCalendar already has responsive layout (sm: breakpoints). No UI regression. |
| III. LAN-Only Deployment | ✅ Yes | ✅ PASS | No external network calls added. Uses same internal API endpoint. |
| IV. Operational Readiness | ⚠️ Minor | ✅ PASS | Loading state shown during fetch (FR-007). Failed sources don't block others (existing hook behavior). |
| V. Testing & Change Safety | ✅ Yes | ✅ PASS | Frontend-only change. No contract changes (API unchanged). Props interface change is internal. |

**Post-Phase 1 Re-check**: ✅ All gates still pass. The design adds no new security surface,
no new endpoints, and maintains existing responsive/accessible patterns.

## Project Structure

### Documentation (this feature)

```text
specs/035-fullscreen-calendar-fix/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── calendar/
│   │   │   └── FullScreenCalendar.tsx   # PRIMARY CHANGE: independent data fetching
│   │   └── widgets/
│   │       └── CalendarWidget.tsx        # SECONDARY CHANGE: updated props passed
│   └── state/
│       └── calendarHooks.ts             # UNCHANGED: useCalendarEvents already supports this
└── tests/
```

**Structure Decision**: Web application (frontend + backend monorepo). This feature
touches only the `frontend/` workspace — specifically two component files.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | — | — |
