# Quickstart: Shortcuts Widget Improvements & Single-Link Widget

**Feature**: 030-shortcuts-single-link
**Branch**: `030-shortcuts-single-link`

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for full-stack testing)

## Setup

```bash
# Clone and switch to feature branch
git checkout 030-shortcuts-single-link

# Install dependencies
pnpm install

# Start dev server
cd frontend && pnpm dev
```

## Development Workflow

### 1. Shortcuts Widget Changes (User Stories 1 & 2)

Primary file: `frontend/src/components/widgets/AppShortcutsWidget.tsx`

```bash
# Run the frontend dev server with HMR
cd frontend && pnpm dev

# Run unit tests in watch mode
cd frontend && pnpm vitest --watch
```

Key changes:
- Replace CSS Grid (`gridTemplateColumns`) with Flexbox (`flex-wrap`)
- Add container height measurement for overflow mode detection
- Add hover/active state classes to shortcut icon cells
- Change label truncation from `line-clamp-2` to `truncate` (ellipsis)

### 2. Single-Link Widget (User Story 3)

Create these files:
1. `frontend/src/components/widgets/SingleLinkWidget.tsx`
2. `frontend/src/components/widgets/SingleLinkConfigForm.tsx`
3. Register in `frontend/src/components/widgets/registry.tsx`
4. Add `SingleLinkConfig` to `frontend/src/state/dashboards.ts`

### 3. Testing

```bash
# Unit tests
cd frontend && pnpm vitest run

# E2E tests
cd frontend && pnpm playwright test

# Type checking
pnpm tsc --noEmit
```

## Architecture Reference

```
User adds widget → PlaceholderConfigDialog → widgetRegistry.get(type)
  → WidgetRenderer → SingleLinkWidget / AppShortcutsWidget
  → Config stored as JSON in widget_instances.config column
```

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/widgets/AppShortcutsWidget.tsx` | Shortcut grid display (modify) |
| `frontend/src/components/widgets/SingleLinkWidget.tsx` | Single-Link display (create) |
| `frontend/src/components/widgets/SingleLinkConfigForm.tsx` | Single-Link config (create) |
| `frontend/src/components/widgets/registry.tsx` | Widget type registry (modify) |
| `frontend/src/state/dashboards.ts` | TypeScript interfaces (modify) |
| `frontend/src/components/ui/color-picker.tsx` | Reusable colour picker (reference) |

## Spec & Plan

- Spec: `specs/030-shortcuts-single-link/spec.md`
- Plan: `specs/030-shortcuts-single-link/plan.md`
- Research: `specs/030-shortcuts-single-link/research.md`
- Data Model: `specs/030-shortcuts-single-link/data-model.md`
