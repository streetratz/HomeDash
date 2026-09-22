# Implementation Plan: Settings & Config Fixes

**Branch**: `039-settings-config-fixes` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/039-settings-config-fixes/spec.md`

## Summary

Fix seven disconnected settings that save successfully but never apply to the public dashboard. The primary issues are: (1) `titleFont`/`titleFontSizePx` fields exist in DB and admin API but are missing from the public bootstrap response and frontend rendering; (2) logo upload doesn't invalidate the public bootstrap cache; (3) clock display config is derived from the home clock entry (lost when no home clock exists); (4) `repoUrl` is exposed but never rendered in footer; (5) `headerStyleTarget` is exposed publicly but unused; (6) UTC timezone validation already fixed but untested; (7) screensaver uses a divergent mutation path.

All fixes are small wiring/plumbing changes (1–5 lines each) with no new endpoints or migrations.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js backend, Vite+React frontend)  
**Primary Dependencies**: Fastify, Drizzle ORM, better-sqlite3, React 18, TanStack Query v5, shadcn/ui, Tailwind CSS  
**Storage**: SQLite via better-sqlite3 (Drizzle ORM schema)  
**Testing**: Vitest (backend unit/integration), Playwright (frontend E2E)  
**Target Platform**: Linux Docker container (Synology NAS, host networking)  
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)  
**Performance Goals**: Sub-2s settings propagation to public dashboard  
**Constraints**: LAN-only, no internet dependency, single SQLite DB  
**Scale/Scope**: Single-user/small-household dashboard; ~50 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|:-----------:|:------:|-------|
| I. Secure-by-Default | ✅ | PASS | Public bootstrap already GET-only, read-only. Adding `titleFont`/`titleFontSizePx` is safe public data (admin-selected appearance). Removing `headerStyleTarget` reduces public surface. `repoUrl` rendering uses URL validation (http/https only). |
| II. Mobile-First, Fluid, Accessible | ✅ | PASS | Font/size changes apply via inline styles — responsive by default. Footer link uses semantic `<a>` with target="_blank". |
| III. LAN-Only Deployment | ⬜ | N/A | No networking changes. |
| IV. Operational Readiness | ⬜ | N/A | No new health/logging concerns. |
| V. Testing & Change Safety | ✅ | PASS | UTC fix needs regression test. All changes require test coverage per constitution. No schema migrations needed (columns already exist). |
| Security & Privacy | ✅ | PASS | No new secrets, no auth changes. `repoUrl` validated for scheme before rendering. |
| Dev Workflow & Quality | ✅ | PASS | Plan produced from `.specify` template. Logs structure required per phase. |

**Gate Result**: ✅ PASS — no violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/039-settings-config-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── public.ts              # Add titleFont, titleFontSizePx; remove headerStyleTarget
│   ├── services/
│   │   └── shellSettingsService.ts # Already has UTC fix; needs test
│   └── db/
│       └── schema/index.ts         # titleFont, titleFontSizePx columns exist
└── tests/
    └── unit/                       # New: isValidTimezone test

frontend/
├── src/
│   ├── state/
│   │   └── bootstrap.ts           # Add titleFont, titleFontSizePx to ShellSettings type
│   ├── components/
│   │   ├── ShellLayout.tsx         # Apply font styles to title; render repoUrl in footer
│   │   ├── ClockStrip.tsx          # Fix globalCfg derivation
│   │   └── settings/
│   │       └── AppearanceTab.tsx   # Fix logo invalidation; screensaver mutation
│   └── lib/
└── tests/
```

**Structure Decision**: Existing web application monorepo (backend/ + frontend/). No new directories required — all changes modify existing files.

## Complexity Tracking

> No constitution violations — section intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
