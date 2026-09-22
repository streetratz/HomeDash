# Implementation Plan: Widget Management & Widget Types

**Branch**: `002-widget-management` | **Date**: 2025-07-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-widget-management/spec.md`

## Summary

Build the frontend UI for managing widgets inside dashboard placeholders, then expand
the widget catalog with five new widget types (Clock/Date, Markdown/Notes, Iframe Embed,
Weather, System Status). The existing codebase already has the `app_widget_instances`
table, backend CRUD + batch-layout-save endpoints, a WidgetRenderer discriminator, and a
working `links_list` widget type. This feature extends that foundation with a widget type
registry, per-type configuration forms, a widget picker dialog, and in-placeholder widget
reorder/delete — all following the existing edit-mode pattern (local draft → batch Save).

New backend work is limited to two proxy endpoints (system-status health checks and
Open-Meteo weather/geocoding) and per-type config validation schemas. No new database
tables are required — all widget config is stored in the existing `configJson` column.

## Technical Context

**Language/Version**: TypeScript 5.5+ on Node.js ≥ 20 (pnpm 8+ monorepo)
**Primary Dependencies**:
- Backend: Fastify, Drizzle ORM, better-sqlite3, Zod
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, react-grid-layout, Lucide icons
- New: `react-markdown` + `remark-gfm` (markdown widget), `@hello-pangea/dnd` (widget reorder DnD)
**Storage**: SQLite via better-sqlite3 / Drizzle ORM — no new tables; all config in `app_widget_instances.configJson`
**Testing**: Vitest (backend integration), Playwright (frontend E2E)
**Target Platform**: Docker container on Synology NAS, LAN-only, host networking
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Performance Goals**: Dashboard with 10+ widgets loads < 2s; Clock ticks every second without jank (NFR-006)
**Constraints**: LAN-only for all core widgets; Weather API mode is the sole exception (NFR-002); XSS sanitization on all rendered user content (NFR-007)
**Scale/Scope**: Single-user/small-household dashboard; typically 1–5 widgets per placeholder, 3–8 placeholders per dashboard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: All widget management mutations require `requireAdmin` + CSRF.
  New proxy endpoints (`/api/admin/status-check`, `/api/admin/weather/*`) are admin-only.
  Markdown widget HTML is sanitized via react-markdown's AST (no `dangerouslySetInnerHTML`).
  Iframe widget uses `sandbox` attribute to prevent parent navigation/DOM access.
  No new secrets introduced (Open-Meteo API requires no key).
- [x] **LAN-only boundary**: Clock, Markdown, Iframe, System Status work fully offline.
  Weather API mode is the only external call and degrades gracefully when offline (stale
  indicator or "no data" message). System Status checks are backend-side HTTP to avoid
  browser CORS. Weather proxied through backend to keep browser LAN-only.
  No new ports or binding changes.
- [x] **Mobile-first UI**: Widget picker dialog is responsive (grid → single-column on mobile).
  Config forms use shadcn/ui responsive primitives. Touch-friendly drag handles for
  reorder. All dialogs are scrollable on small viewports (≥ 320px per NFR-004).
- [x] **Operability**: Widget render errors caught by React error boundaries with logged context
  (NFR-005). Status-check failures logged with service URL, timeout, and error type.
  Weather proxy failures logged. All new endpoints return structured error responses
  consistent with existing `Errors.*` pattern.
- [x] **Testing & change safety**: Backend integration tests for new proxy endpoints and
  config validation. Frontend E2E tests for widget picker → add → configure → save flow.
  No schema migrations needed (existing `configJson` column). New Zod schemas per widget
  type for config validation. `logs/` audit structure per constitution.

## Project Structure

### Documentation (this feature)

```text
specs/002-widget-management/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions
├── data-model.md        # Phase 1: entity shapes & config schemas
├── quickstart.md        # Phase 1: development setup guide
├── contracts/           # Phase 1: new API endpoint specs
│   ├── status-check.md
│   └── weather-proxy.md
├── checklists/          # Pre-existing checklist artifacts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── adminDashboards.ts      # Extend: add status-check & weather proxy endpoints
│   ├── services/
│   │   ├── dashboardService.ts     # Existing: widget CRUD + layout batch save
│   │   ├── statusCheckService.ts   # NEW: HTTP health-check executor
│   │   └── weatherProxyService.ts  # NEW: Open-Meteo API proxy + cache
│   ├── lib/
│   │   └── validation.ts           # Extend: per-widget-type config Zod schemas
│   ├── db/schema/index.ts          # No changes (configJson is sufficient)
│   ├── auth/                       # No changes
│   └── config/env.ts               # No changes
└── tests/
    └── integration/
        ├── statusCheck.test.ts     # NEW: status-check endpoint tests
        ├── weatherProxy.test.ts    # NEW: weather proxy endpoint tests
        └── dashboards.test.ts      # Extend: widget config validation tests

frontend/
├── src/
│   ├── components/
│   │   ├── WidgetRenderer.tsx       # Extend: registry lookup replaces switch
│   │   ├── LinksListWidget.tsx      # No changes
│   │   ├── PlaceholderWidget.tsx    # Extend: edit-mode widget actions overlay
│   │   ├── PlaceholderConfigDialog.tsx  # Extend: "Manage Widgets" tab/section
│   │   ├── widgets/                 # NEW: widget type modules
│   │   │   ├── registry.ts         # Widget type registry (type → components map)
│   │   │   ├── WidgetPicker.tsx     # Widget picker dialog
│   │   │   ├── WidgetListEditor.tsx # Widget reorder/delete list (edit mode)
│   │   │   ├── ClockWidget.tsx      # Clock display component
│   │   │   ├── ClockConfigForm.tsx  # Clock config form
│   │   │   ├── MarkdownWidget.tsx   # Markdown display component
│   │   │   ├── MarkdownConfigForm.tsx
│   │   │   ├── IframeWidget.tsx     # Iframe display component
│   │   │   ├── IframeConfigForm.tsx
│   │   │   ├── WeatherWidget.tsx    # Weather display component
│   │   │   ├── WeatherConfigForm.tsx
│   │   │   ├── SystemStatusWidget.tsx    # Status display component
│   │   │   └── SystemStatusConfigForm.tsx
│   │   └── ui/                      # Existing shadcn/ui primitives
│   ├── state/
│   │   ├── dashboards.ts           # Extend: per-type config interfaces
│   │   └── useEditMode.ts          # Extend: widget draft state (add/remove/reorder/configure)
│   ├── hooks/
│   │   ├── useStatusCheck.ts       # NEW: TanStack Query hook for status polling
│   │   └── useWeather.ts           # NEW: TanStack Query hook for weather data
│   ├── lib/apiClient.ts            # No changes
│   └── pages/DashboardPage.tsx     # Minor: edit-mode interactions
└── tests/
    └── e2e/
        ├── widgetManagement.spec.ts # NEW: widget picker + config + save E2E
        └── widgetTypes.spec.ts      # NEW: each widget type renders correctly
```

**Structure Decision**: Existing pnpm monorepo (`backend/` + `frontend/`) is preserved.
All new widget components live under `frontend/src/components/widgets/` as a cohesive
module. New backend services are added alongside existing ones. No new workspaces or
packages needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Weather widget makes external HTTP call | Open-Meteo API provides real weather data; manual-only mode exists as offline fallback | Manual-only weather provides minimal value for users with internet access; spec explicitly allows this exception (NFR-002) |
