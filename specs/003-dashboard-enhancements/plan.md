# Implementation Plan: Dashboard Enhancements

**Branch**: `003-dashboard-enhancements` | **Date**: 2026-04-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-dashboard-enhancements/spec.md`

## Summary

Deliver three dashboard improvements: (1) a visual Lucide icon picker replacing the text-based `iconKey` input on links, (2) a frontend UI for configuring dashboard backgrounds using the existing backend schema, and (3) JSON-based dashboard export/import for backup and restore.

The icon picker and background customization are frontend-only changes — the backend already stores `iconKey` on links and has full background schema support (`backgroundType`, `backgroundColor`, `backgroundAssetId`, `backgroundDisplayMode`). Import/export requires two new backend endpoints (GET export, POST import) plus frontend download/upload UI.

## Technical Context

**Language/Version**: TypeScript 5.5+ on Node.js ≥ 20 (pnpm 8+ monorepo)
**Primary Dependencies**:
- Backend: Fastify, Drizzle ORM, better-sqlite3, Zod
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, react-grid-layout, Lucide icons
**Storage**: SQLite via better-sqlite3 / Drizzle ORM — no new tables; background fields already exist on `dashboards` table
**Testing**: Vitest (backend integration), Playwright (frontend E2E)
**Target Platform**: Docker container on Synology NAS, LAN-only, host networking
**Project Type**: Web application (pnpm monorepo: `backend/` + `frontend/`)
**Constraints**: LAN-only; no external API calls in this feature

## Constitution Check

*GATE: Must pass before implementation.*

- [x] **Secure-by-default**: Icon picker is frontend-only (no backend changes). Background
  customization uses existing admin-only PUT endpoint with `requireAdmin` + CSRF. New
  export endpoint is admin-only GET. New import endpoint uses `requireAdmin` + `assertCsrf`.
  Import validates JSON schema strictly; uses database transaction for atomicity.
- [x] **LAN-only boundary**: All features operate fully within the LAN. No external API calls.
  Icon picker uses bundled Lucide icons. Background images are uploaded to local storage.
  Export/import is file-based (download/upload JSON).
- [x] **Mobile-first UI**: Icon picker grid is responsive (fewer columns on mobile). Background
  settings dialog is scrollable on small viewports. Import/export buttons are accessible
  on mobile.
- [x] **Operability**: Import validation errors are returned with descriptive messages. Export
  failures are logged. Slug conflicts during import produce user-friendly prompts.
- [x] **Testing & change safety**: Backend integration tests for import/export endpoints.
  Frontend E2E tests for icon picker flow, background settings, and import/export.
  No new database migrations — background schema already exists. Export format includes
  a version field for forward compatibility.

## Project Structure

### Documentation (this feature)

```text
specs/003-dashboard-enhancements/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Implementation tasks
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── adminDashboards.ts      # Extend: export + import endpoints
│   ├── services/
│   │   └── dashboardService.ts     # Extend: export + import service methods
│   ├── lib/
│   │   └── validation.ts           # Extend: import payload Zod schema
│   ├── db/schema/index.ts          # No changes (background schema exists)
│   └── auth/                       # No changes
└── tests/
    └── integration/
        ├── dashboardExport.test.ts # NEW: export endpoint tests
        └── dashboardImport.test.ts # NEW: import endpoint tests

frontend/
├── src/
│   ├── components/
│   │   ├── IconPicker.tsx           # NEW: visual Lucide icon picker dialog
│   │   ├── LinkEditForm.tsx         # Extend: integrate icon picker
│   │   ├── BackgroundSettings.tsx   # NEW: background config UI with preview
│   │   ├── DashboardSettingsDialog.tsx  # Extend: add background settings tab
│   │   ├── DashboardImportDialog.tsx    # NEW: import file upload + conflict UI
│   │   └── DashboardGrid.tsx        # No changes (already renders backgrounds)
│   ├── state/
│   │   └── adminDashboards.ts       # Extend: export/import mutation hooks
│   ├── hooks/
│   │   └── useDashboardExport.ts    # NEW: export download trigger hook
│   ├── lib/apiClient.ts             # No changes
│   └── pages/DashboardPage.tsx      # Minor: export/import button placement
└── tests/
    └── e2e/
        ├── iconPicker.spec.ts       # NEW: icon picker E2E tests
        ├── backgroundSettings.spec.ts   # NEW: background config E2E tests
        └── dashboardImportExport.spec.ts # NEW: import/export E2E tests
```

**Structure Decision**: Existing pnpm monorepo (`backend/` + `frontend/`) is preserved.
Icon picker is a reusable component in `frontend/src/components/`. Background settings
and import/export dialogs follow existing dialog patterns. No new workspaces or packages.

## Architecture Overview

### Phase 1: Icon Picker (Frontend Only)

Build a `<IconPicker>` dialog component that enumerates all Lucide icons via the `icons`
export from `lucide-react`, displays them in a searchable/filterable grid, and calls back
with the selected icon name. Integrate into the link edit form, replacing the text input
for `iconKey` with a button that opens the picker. No backend changes — `iconKey` is
already a string field on links.

### Phase 2: Background Customization UI (Frontend, Existing Backend)

Build a `<BackgroundSettings>` component that provides UI for the existing background
schema fields. For solid color: a color picker input producing hex values. For image:
a file upload that POSTs to the existing `POST /api/admin/assets` endpoint, then sets
`backgroundAssetId`. Display mode selector (fill/stretch). Live preview using CSS.
Save via existing `PUT /api/admin/dashboards/:id`. No backend changes needed.

### Phase 3: Export Endpoint + Frontend Download

Add `GET /api/admin/dashboards/:id/export` that fetches the full dashboard tree
(dashboard → placeholders → widgets → links) and returns it as a JSON document. The
frontend triggers a browser download using a Blob URL. Admin auth required, no CSRF
needed for GET.

### Phase 4: Import Endpoint + Frontend Upload UI

Add `POST /api/admin/dashboards/import` that accepts the export JSON, validates schema
via Zod, checks for slug conflicts (returns 409 with existing dashboard info), and
creates the entire dashboard tree in a single SQLite transaction. Frontend provides
a file upload dialog with JSON validation, error display, and a conflict resolution
dialog that lets the admin rename.

### Phase 5: Integration Tests for Import/Export

Backend integration tests (Vitest) for both endpoints covering auth, validation,
happy path, slug conflicts, malformed JSON, and transaction rollback on failure.

### Phase 6: E2E Tests + Polish

Playwright E2E tests for the icon picker flow, background settings flow, and
export/import round-trip. Performance verification for icon picker search.

## Phase Dependencies

```
Phase 1: Icon Picker ─────────────────────────────────────────────┐
Phase 2: Background Customization ────────────────────────────────┤
Phase 3: Export ──────► Phase 4: Import ──► Phase 5: Integration  ├──► Phase 6: E2E + Polish
                                             Tests                │
```

- **Phase 1** (Icon Picker): No dependencies — can start immediately
- **Phase 2** (Background): No dependencies — can parallel with Phase 1
- **Phase 3** (Export): No dependencies — can parallel with Phases 1–2
- **Phase 4** (Import): Depends on Phase 3 (export defines the JSON format)
- **Phase 5** (Integration Tests): Depends on Phases 3–4
- **Phase 6** (E2E + Polish): Depends on all prior phases

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

*No complexity violations — all features use existing patterns and infrastructure.*
