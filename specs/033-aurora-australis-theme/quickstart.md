# Quickstart — Aurora Australis CSS Theme

## Overview

This feature adds an "Aurora Australis" theme to HomeDash — a southern-lights inspired colour scheme with deep navy backgrounds and green/teal/purple accents. It extends the existing light/dark theme system to support named themes.

## Prerequisites

- Node.js 18+ and pnpm installed
- HomeDash dev environment running (`pnpm dev` from root)
- Familiarity with: CSS custom properties, Tailwind CSS, React, shadcn/ui, Drizzle ORM

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/index.css` | CSS token definitions — add `.dark.aurora {}` block |
| `frontend/src/state/settings.ts` | Theme helpers — extend types and `applyTheme()` |
| `frontend/src/components/ThemePicker.tsx` | New component — multi-theme selector |
| `frontend/src/components/ThemeToggle.tsx` | Deprecated/replaced by ThemePicker |
| `backend/src/db/schema/index.ts` | Extend `themeMode` enum |
| `backend/src/services/userPreferencesService.ts` | Validate new enum value |

## Development Workflow

### 1. Backend Schema Update

```bash
# Update the enum in schema definition
# No physical migration needed (SQLite text column)
cd backend
pnpm run db:generate  # Generate Drizzle migration metadata
pnpm run db:push      # Apply if using push workflow
```

### 2. Frontend CSS Tokens

Add the `.dark.aurora` block in `frontend/src/index.css` after the `.dark` block. All tokens use HSL format matching shadcn/ui convention.

### 3. Theme Application Logic

Update `frontend/src/state/settings.ts`:
- Extend type from `'light' | 'dark'` to `'light' | 'dark' | 'aurora'`
- Update `applyTheme()` to handle `.aurora` class
- Update `getStoredTheme()` to recognize `'aurora'`

### 4. UI Component

Create `ThemePicker.tsx` using shadcn/ui `DropdownMenu`:
- Three options: Light (☀️), Dark (🌙), Aurora Australis (🌌)
- Replace `ThemeToggle` in header and settings

### 5. Testing

```bash
# Run contrast validation tests
cd frontend && pnpm test -- --grep "contrast"

# Run E2E theme switching tests
cd frontend && pnpm test:e2e -- --grep "theme"

# Run backend validation tests
cd backend && pnpm test -- --grep "preferences"
```

## WCAG AA Verification

All colour pairings must pass:
- **Normal text** (< 18px): 4.5:1 minimum contrast ratio
- **Large text** (≥ 18px or 14px bold): 3:1 minimum
- **UI components**: 3:1 minimum against adjacent colours

Tool: Use `wcag-contrast-ratio` npm package or browser DevTools contrast checker.

## Architecture Decision: Why `.dark.aurora`

The aurora theme uses **compound CSS classes** (`.dark.aurora`) rather than a standalone selector because:

1. Aurora is a dark-mode variant — it inherits dark-mode's Tailwind utility behaviour
2. CSS specificity: `.dark.aurora` naturally overrides `.dark` without `!important`
3. Switching to light mode only requires removing both classes
4. Existing Tailwind `dark:` prefix utilities still work correctly

## Gradient Effects

Aurora uses subtle gradient accents on decorative elements (card borders, nav accents). These are:
- **Static by default** — no CSS animations
- **Disabled under `prefers-reduced-motion: reduce`** — falls back to solid colour
- **Never placed under text** without a solid background beneath
