# Implementation Plan: Shortcuts Widget Improvements & Single-Link Widget

**Branch**: `030-shortcuts-single-link` | **Date**: 2025-07-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/030-shortcuts-single-link/spec.md`

## Summary

Three related improvements to HomeDash's shortcut/link widgets:

1. **Icon wrapping (P1)** — Shortcuts widget icons maintain fixed pixel sizes and reflow into rows rather than shrinking. Behaviour varies by widget size preset: S = 1 row + horizontal scroll, M = 2 rows + vertical scroll, L = all rows visible (auto-expand).
2. **Space management & styling (P2)** — Compact grid spacing, hover/active states on shortcut icons, visually distinct icon-size options, and label truncation with ellipsis.
3. **Single-Link widget (P3)** — New widget type: a large clickable tile displaying one prominent link with icon, label, optional subtitle, and configurable background colour/gradient.

**Technical approach**: All changes are frontend-only. The existing `AppShortcutsWidget.tsx` is refactored for CSS flexbox wrapping with overflow control keyed to the widget's grid-layout size (h value from react-grid-layout). The new `SingleLinkWidget` follows the established widget registry pattern (≤ 3 files). No backend or schema changes required — the Single-Link config is stored as JSON in the existing widget `config` column.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18, Vite)
**Primary Dependencies**: React 18, TanStack Query, react-grid-layout 1.4, Tailwind CSS, Lucide React, shadcn/ui components
**Storage**: Existing widget `config` JSON column (no schema changes)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web — responsive from 360px to 1920px+; Synology NAS Docker deployment
**Project Type**: Web application (monorepo: `frontend/` + `backend/`)
**Performance Goals**: Smooth 60fps icon reflow on resize; no unnecessary re-renders
**Constraints**: Min 44×44px touch targets (WCAG 2.5.5); mobile behaviour preserved (< 768px)
**Scale/Scope**: 3 user stories, ~6 files modified, ~3 files created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Secure-by-Default | ✅ PASS | No new endpoints. Single-Link URLs open in new tab with `rel="noopener noreferrer"`. No secrets exposed. No state mutation. |
| II | Mobile-First, Fluid, Accessible UI | ✅ PASS | FR-006 preserves mobile behaviour. Touch targets ≥ 44px (FR-007). Hover/active states use non-colour cues (scale/shadow) for WCAG compliance. Keyboard accessible via native `<a>` elements. |
| III | LAN-Only Deployment | ✅ PASS | No network changes. All frontend-only. No external callbacks. |
| IV | Operational Readiness | ✅ PASS | No new backend services. Existing health endpoints unaffected. |
| V | Testing & Change Safety | ✅ PASS | Unit tests for icon sizing logic, E2E tests for Single-Link widget lifecycle. Logs directory created at feature start. |
| — | Security/Privacy | ✅ PASS | No new auth surfaces. No credential storage. URLs stored in existing config JSON. |
| — | Dev Workflow | ✅ PASS | Spec + plan produced from templates. Constitution check completed. |

## Project Structure

### Documentation (this feature)

```text
specs/030-shortcuts-single-link/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (widget registry contract)
├── tasks.md             # Phase 2 output (/speckit.tasks)
└── logs/
    └── readme.md        # Canonical log index
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── widgets/
│   │       ├── AppShortcutsWidget.tsx      # MODIFY — flexbox wrapping, overflow presets, hover/active
│   │       ├── AppShortcutsConfigForm.tsx   # MODIFY — minor (if any config UI updates needed)
│   │       ├── SingleLinkWidget.tsx         # CREATE — new display component
│   │       ├── SingleLinkConfigForm.tsx     # CREATE — new config form
│   │       └── registry.tsx                # MODIFY — register single_link type
│   └── state/
│       └── dashboards.ts                   # MODIFY — add SingleLinkConfig interface
├── tests/
│   ├── unit/                               # Unit tests for icon sizing, config defaults
│   └── e2e/                                # E2E tests for Single-Link lifecycle
└── playwright.config.ts
```

**Structure Decision**: Existing web application monorepo structure (`frontend/` + `backend/`). All changes are in `frontend/`. The Single-Link widget follows the established ≤ 3-file pattern documented in `registry.tsx` (SC-008).

## Complexity Tracking

No constitution violations. No complexity justifications required.
