# Quickstart — Widget Management & Widget Types

**Feature**: 002-widget-management
**Date**: 2025-07-17

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 8
- Existing HomeDash codebase checked out with `pnpm install` completed

## Development Setup

```bash
# 1. Switch to the feature branch
git checkout 002-widget-management

# 2. Install new dependencies (from repo root)
pnpm install

# 3. Start dev servers (backend + frontend in parallel)
pnpm dev
```

Backend runs on `http://localhost:3000`, frontend on `http://localhost:5173` (Vite proxies
`/api` to backend).

## New Dependencies to Install

### Frontend (`frontend/`)

```bash
cd frontend

# Markdown rendering (Markdown/Notes widget)
pnpm add react-markdown@^10 remark-gfm@^4

# Tailwind typography plugin (prose styling for markdown)
pnpm add -D @tailwindcss/typography@^0.5

# Drag-and-drop for widget reorder
pnpm add @hello-pangea/dnd@^18
```

### Backend (`backend/`)

No new dependencies required. Node.js 20+ native `fetch()` is used for:
- System Status health checks
- Weather API proxy calls to Open-Meteo

## Key Files to Create

### Frontend

| File | Purpose |
|------|---------|
| `src/components/widgets/registry.ts` | Widget type registry (Map of type → definition) |
| `src/components/widgets/WidgetPicker.tsx` | Dialog for selecting widget type to add |
| `src/components/widgets/WidgetListEditor.tsx` | Reorder/delete widget list in edit mode |
| `src/components/widgets/ClockWidget.tsx` | Clock/Date display component |
| `src/components/widgets/ClockConfigForm.tsx` | Clock config form (timezone, format) |
| `src/components/widgets/MarkdownWidget.tsx` | Markdown display component |
| `src/components/widgets/MarkdownConfigForm.tsx` | Markdown config form (content editor) |
| `src/components/widgets/IframeWidget.tsx` | Iframe embed display component |
| `src/components/widgets/IframeConfigForm.tsx` | Iframe config form (URL, aspect ratio) |
| `src/components/widgets/WeatherWidget.tsx` | Weather display component |
| `src/components/widgets/WeatherConfigForm.tsx` | Weather config form (mode, location) |
| `src/components/widgets/SystemStatusWidget.tsx` | System Status display component |
| `src/components/widgets/SystemStatusConfigForm.tsx` | Status config form (services list) |
| `src/hooks/useStatusCheck.ts` | TanStack Query hook for status polling |
| `src/hooks/useWeather.ts` | TanStack Query hook for weather data |

### Backend

| File | Purpose |
|------|---------|
| `src/services/statusCheckService.ts` | HTTP health-check executor |
| `src/services/weatherProxyService.ts` | Open-Meteo API proxy + in-memory cache |

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/WidgetRenderer.tsx` | Replace switch/case with registry lookup |
| `frontend/src/state/useEditMode.ts` | Add widget draft operations (add/remove/reorder/configure) |
| `frontend/src/state/dashboards.ts` | Add per-type config interfaces |
| `frontend/src/components/PlaceholderWidget.tsx` | Add edit-mode widget action overlays |
| `frontend/src/components/PlaceholderConfigDialog.tsx` | Add "Manage Widgets" section |
| `backend/src/api/adminDashboards.ts` | Add status-check + weather proxy routes; add per-type config validation |
| `backend/src/lib/validation.ts` | Add per-type config Zod schemas |
| `frontend/tailwind.config.ts` | Add `@tailwindcss/typography` plugin |

## Testing

```bash
# Run all tests
pnpm test

# Backend integration tests only
pnpm test:integration

# Frontend E2E tests only
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### New Test Files

| File | Covers |
|------|--------|
| `backend/tests/integration/statusCheck.test.ts` | Status check endpoint: auth, validation, check execution |
| `backend/tests/integration/weatherProxy.test.ts` | Weather proxy: auth, validation, caching, error handling |
| `frontend/tests/e2e/widgetManagement.spec.ts` | Widget picker → add → configure → save → view cycle |
| `frontend/tests/e2e/widgetTypes.spec.ts` | Each widget type renders correctly with config |

## Architecture Notes

### Edit Mode Flow (Widget Management)

```
1. Admin enters edit mode → useEditMode clones placeholders + widgets into draft
2. Admin opens "Manage Widgets" on a placeholder
3. Widget Picker → select type → new widget draft added to placeholder
4. Configure widget → config form → updates widget draft's configJson
5. Reorder widgets → DnD/arrows → updates orderIndex in drafts
6. Delete widget → removes from draft array
7. Admin clicks Save → PUT /api/admin/dashboards/:id/layout (includes widgets)
8. Cancel → all widget changes discarded
```

### Widget Registry Flow (Adding a New Type)

To add a future widget type (e.g., `todo_list`), create 3 files:

1. `frontend/src/components/widgets/TodoListWidget.tsx` — display component
2. `frontend/src/components/widgets/TodoListConfigForm.tsx` — config form
3. Register in `frontend/src/components/widgets/registry.ts`:

```typescript
import { CheckSquare } from 'lucide-react';
import { TodoListWidget } from './TodoListWidget';
import { TodoListConfigForm } from './TodoListConfigForm';

registry.set('todo_list', {
  type: 'todo_list',
  displayName: 'Todo List',
  description: 'A simple checklist for tasks',
  icon: CheckSquare,
  defaultConfig: { items: [] },
  DisplayComponent: TodoListWidget,
  ConfigFormComponent: TodoListConfigForm,
});
```

That's it — the picker, renderer, and config system all pick it up automatically (SC-008).
