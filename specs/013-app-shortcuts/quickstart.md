# Quickstart — App Shortcuts Widget

**Feature**: 013-app-shortcuts | **Date**: 2025-07-14

## Prerequisites

- Node.js 20+
- pnpm 9+
- Git (on branch `013-app-shortcuts`)

## Setup

```bash
# Clone and switch to feature branch
git checkout 013-app-shortcuts

# Install dependencies
pnpm install

# Run Drizzle migration (after schema changes are in place)
cd backend && pnpm drizzle-kit generate && pnpm drizzle-kit push && cd ..
```

## Development

```bash
# Start backend (port 3001)
cd backend && pnpm dev

# Start frontend (port 5173, separate terminal)
cd frontend && pnpm dev
```

## Verification Checklist

### Phase 1: Schema & Service Layer

- [ ] `pnpm -C backend tsc --noEmit` passes with new schema tables
- [ ] Drizzle migration generates cleanly (`pnpm -C backend drizzle-kit generate`)
- [ ] `pnpm -C backend vitest run` — all service tests pass

### Phase 2: API Routes

- [ ] `POST /api/admin/app-shortcuts/:widgetId/shortcuts` creates a shortcut
- [ ] `GET /api/admin/app-shortcuts/:widgetId/shortcuts` returns shortcuts with groups
- [ ] `PUT /api/admin/app-shortcuts/:widgetId/shortcuts/:id` updates a shortcut
- [ ] `DELETE /api/admin/app-shortcuts/:widgetId/shortcuts/:id` deletes a shortcut
- [ ] `POST /api/admin/app-shortcuts/:widgetId/shortcuts/:id/icon` uploads icon (≤512 KB, validated format)
- [ ] `POST /api/admin/app-shortcuts/:widgetId/groups` creates a group
- [ ] All routes require admin auth + CSRF

### Phase 3: Favicon Fetching

- [ ] Creating a shortcut with a valid LAN URL auto-fetches the favicon
- [ ] Favicon fetch timeout (5s) does not block shortcut creation
- [ ] Failed fetch results in placeholder icon, shortcut still usable

### Phase 4: Frontend Widget

- [ ] `'app_shortcuts'` appears in widget picker
- [ ] Adding widget shows empty state with "Add shortcut" prompt
- [ ] Shortcut grid renders with configured column count
- [ ] Clicking shortcut opens URL in new tab (`target="_blank"`)
- [ ] Config form allows column count adjustment (2–8)

### Phase 5: Groups & Ordering

- [ ] Groups render as section headers
- [ ] Shortcuts without group appear in "Ungrouped" section
- [ ] Drag-and-drop reorders shortcuts within and across groups
- [ ] Group create/rename/delete works from config form

### Phase 6: Status Ping

- [ ] Enabling ping shows "unknown" indicator immediately
- [ ] After first check cycle (~60s), indicator shows green/red
- [ ] Ping results update without page refresh
- [ ] Multiple shortcuts with ping enabled check in parallel

## Testing

```bash
# Backend unit + integration tests
pnpm -C backend vitest run

# Frontend component tests
pnpm -C frontend vitest run

# E2E tests (requires both servers running)
pnpm -C frontend playwright test

# Type checking
pnpm -C backend tsc --noEmit
pnpm -C frontend tsc --noEmit

# Linting
pnpm eslint .
```

## Key Files

| Purpose                    | Path                                                   |
|----------------------------|--------------------------------------------------------|
| DB schema (new tables)     | `backend/src/db/schema/index.ts`                       |
| Shortcut service           | `backend/src/services/appShortcutService.ts`           |
| Favicon fetch service      | `backend/src/services/faviconFetchService.ts`          |
| Ping service               | `backend/src/services/shortcutPingService.ts`          |
| API routes                 | `backend/src/api/admin-app-shortcuts.ts`               |
| Widget display component   | `frontend/src/components/widgets/AppShortcutsWidget.tsx` |
| Widget config form         | `frontend/src/components/widgets/AppShortcutsConfigForm.tsx` |
| Widget registry entry      | `frontend/src/components/widgets/registry.tsx`         |
| Config type interface      | `frontend/src/state/dashboards.ts`                     |
| TanStack Query hooks       | `frontend/src/state/appShortcutHooks.ts`               |
| API contract               | `specs/013-app-shortcuts/contracts/app-shortcuts-api.yaml` |
| Data model                 | `specs/013-app-shortcuts/data-model.md`                |

## Environment Variables

No new environment variables required. The feature uses the existing `HOMEDASH_DATA_DIR` for icon storage.

## Threat Model Note

- **Shortcut URLs**: User-provided, stored as-is. Server-side favicon fetch and ping make HTTP requests to these URLs. Risk: SSRF if an attacker controls the dashboard. Mitigation: admin-only access; URLs are user-intentional targets.
- **Icon uploads**: Validated via magic-byte MIME detection (existing pattern). Max 512 KB. Stored on local filesystem, served via static file handler.
- **Ping results**: Cached server-side. No sensitive data in responses (status, timing only). No URL content is returned to the client.
