# Implementation Plan: Aurora Australis CSS Theme

**Branch**: `033-aurora-australis-theme` | **Date**: 2025-07-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/033-aurora-australis-theme/spec.md`

## Summary

Add a new "Aurora Australis" named theme to HomeDash's existing light/dark theme system. The theme uses a southern-lights colour palette (deep navy backgrounds, green/teal/purple accents with subtle gradient effects). Implementation extends the current CSS custom property system with a new `.aurora` class selector, upgrades the `themeMode` enum from `light|dark` to `light|dark|aurora`, and converts the binary toggle UI into a multi-option theme picker. All colour pairings must pass WCAG AA contrast. Gradient animations respect `prefers-reduced-motion`.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend)  
**Primary Dependencies**: React 18, Tailwind CSS (with `tailwindcss-animate`, `@tailwindcss/typography`), shadcn/ui components, Fastify, Drizzle ORM  
**Storage**: SQLite via `better-sqlite3` + Drizzle ORM  
**Testing**: Vitest (unit — frontend + backend), Playwright (E2E — frontend)  
**Target Platform**: LAN-hosted Docker (Synology NAS), modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions)  
**Project Type**: Web application (monorepo: `frontend/` + `backend/`)  
**Performance Goals**: Theme switch in <2s with no page reload (FR-010, SC-001)  
**Constraints**: WCAG AA contrast (4.5:1 normal, 3:1 large text); `prefers-reduced-motion` compliance; dark-mode variant only  
**Scale/Scope**: ~30 CSS custom properties to define; 1 DB schema migration; UI picker upgrade; E2E coverage for theme switching

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Relevant? | Compliance Strategy |
|-----------|-----------|-------------------|
| I. Secure-by-Default | ✅ Low impact | Theme preference is non-sensitive user data. No new endpoints — extends existing `PUT /api/user/preferences`. No secrets exposed. |
| II. Mobile-First, Fluid, Accessible UI | ✅ Critical | All colour pairings validated for WCAG AA. Touch-friendly picker. `prefers-reduced-motion` respected. Semantic markup preserved. |
| III. LAN-Only Deployment | ✅ No impact | Pure CSS/UI change. No external network calls. No new ports or bindings. |
| IV. Operational Readiness | ✅ Low impact | No new services. Schema migration uses Drizzle — standard, reversible. |
| V. Testing & Change Safety | ✅ Required | Unit tests for colour contrast validation. E2E tests for theme switching flow. DB migration tested. Logs structure followed. |

**Gate result: ✅ PASS** — No violations. Primarily a UI/CSS feature with a minor schema migration.

## Project Structure

### Documentation (this feature)

```text
specs/033-aurora-australis-theme/
├── plan.md              # This file
├── research.md          # Phase 0 output — colour research & decisions
├── data-model.md        # Phase 1 output — schema changes
├── quickstart.md        # Phase 1 output — developer guide
├── contracts/           # Phase 1 output — API contract changes
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/schema/index.ts          # Extend themeMode enum: 'light' | 'dark' | 'aurora'
│   ├── db/migrations/              # New migration for enum expansion
│   ├── services/userPreferencesService.ts  # Validate new theme value
│   └── api/user.ts                 # No route changes, enum validated by Zod
└── tests/

frontend/
├── src/
│   ├── index.css                   # Add .aurora {} token block (parallel to .dark {})
│   ├── state/settings.ts           # Extend type, applyTheme(), getStoredTheme()
│   ├── components/ThemeToggle.tsx   # Replace binary toggle with multi-option picker
│   ├── components/ThemePicker.tsx   # New: dropdown/segmented control for theme selection
│   ├── components/settings/GeneralTab.tsx  # Wire new picker
│   └── components/ShellLayout.tsx   # Wire new picker in header
└── tests/
    ├── unit/                       # Contrast ratio validation tests
    └── e2e/                        # Theme switching E2E tests
```

**Structure Decision**: Existing monorepo structure (`frontend/` + `backend/`) unchanged. Feature touches existing files plus one new component (`ThemePicker.tsx`) and one new CSS theme block.

## Complexity Tracking

> No violations — no entries required.
