# Implementation Plan: Settings Unified Navigation (Option A)

**Branch**: `066-settings-unified-nav` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/066-settings-unified-nav/spec.md`

## Summary

Replace the Settings page's three inconsistent navigation metaphors (horizontal
top tabs + per-tab left sidebars + nested mobile dropdowns) with a single
grouped navigation model: a labelled, non-collapsible rail on desktop and a
slide-in drawer on mobile. Flatten the Appearance and System sub-panels into
first-class leaves; keep Integrations as one leaf that retains an internal
service selector. Encode the active leaf in the existing `?tab=<leaf>` query
param plus an optional, leaf-interpreted `?panel=<sub>` (Integrations today,
reserved for Widgets in #20) so refresh and shared links restore the exact
panel. Frontend-only; no backend, API, data, or auth changes.

## Technical Context

**Language/Version**: TypeScript 5, React 18, Vite 5 (Node 24)
**Primary Dependencies**: react-router-dom (`useSearchParams`), Tailwind, lucide-react, shadcn-style `ui/` primitives
**Storage**: N/A (no persistence; state lives in the URL)
**Testing**: Vitest + Testing Library (`test:unit`), Playwright (`test:e2e`)
**Target Platform**: LAN web app, ~360px phone to large desktop
**Project Type**: Web application (frontend workspace only)
**Performance Goals**: No new network calls, no polling; nav is static config
**Constraints**: No horizontal overflow 360px→desktop; ≥44px touch targets; light/dark parity, no load flash; admin gating on UI and deep links
**Scale/Scope**: 6 nav groups, 14 leaves, 1 leaf (Integrations) with 8 sub-panels

## Constitution Check

*GATE: Must pass before and after design.*

| Gate | Assessment |
| --- | --- |
| Security (§I) | No endpoints, credentials, or authorization logic change. Admin-only leaves stay admin-only; a deep link to a forbidden leaf redirects to a permitted default without rendering restricted content (positive + negative tests). |
| LAN boundary | No new network surface; no public/unauth exposure change. |
| Mobile/accessibility | Drawer gives single-level drill-down (open → choose leaf), ≥44px targets, accessible names, visible focus, semantic nav/landmarks. |
| UI standards | One nav metaphor at every depth; light/dark parity, no flash; no horizontal overflow. |
| Resilience | Unknown/empty/retired `?tab=` or unknown `?panel=` falls back to the default leaf / first sub-panel without error. |
| Testing | Unit tests for leaf resolver, admin gating, and deep-link persistence; e2e for mobile drawer + desktop rail. No phase marked ✅ with failing tests. |
| Scope | Only the navigation container changes; all existing settings content and controls are preserved and merely re-homed. No drive-by refactors or dependency bumps. |
| Versioning/logging | Main Version bumped via `pnpm version:bump-main`; per-phase logs under `specs/066-.../logs/` indexed by `logs/readme.md`; `spec.md` edits logged in `changelog-spec.md`. |

**Result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/066-settings-unified-nav/
├── plan.md              # This file
├── spec.md              # Feature spec
├── changelog-spec.md    # CH-01, CH-02
├── tasks.md             # Phase 2 output (/speckit.tasks)
└── logs/                # Per-phase implementation logs + readme.md index
```

### Source Code (repository root)

```text
frontend/src/
├── pages/
│   └── SettingsPage.tsx                 # Refactor: own unified nav + URL (tab + panel), admin gating, leaf router
├── components/settings/
│   ├── settingsNav.ts                   # NEW: groups → leaves config (id, label, icon, adminOnly, optional panels)
│   ├── SettingsNav.tsx                  # NEW: desktop grouped rail + mobile slide-in drawer
│   ├── AppearanceTab.tsx                # Export PanelContent (branding/header-footer/clock-strip/screensaver) as standalone leaves; retire internal sidebar + MobileSectionSelect
│   ├── SystemTab.tsx                    # Retire wrapper; Timezone / Scheduled Jobs / Backup become 3 leaves (reuse existing TimezoneSelector, ScheduledJobsTab, BackupRestoreSection)
│   ├── IntegrationsTab.tsx              # Lift activeService to URL ?panel=; keep internal service list as sub-nav
│   ├── MobileSectionSelect.tsx          # Superseded by the drawer; remove once unused
│   ├── GeneralTab / DashboardsTab / WidgetsTab / UsersTab / GroupsTab / AboutTab  # Unchanged content, rendered as leaves
│   └── __tests__/                       # Nav resolver + gating + persistence unit tests
├── app/router.tsx                       # Verify redirects use surviving leaf ids (dashboards, groups)
├── components/ShellLayout.tsx / UserMenu.tsx / EmptyDashboard.tsx
├── components/widgets/DockerConnectionPicker.tsx / SonosWidget.tsx / SpotifyWidget.tsx
│                                        # Verify/sweep in-app ?tab= deep links to clean ids
frontend/tests/e2e/                      # NEW/updated: settings nav (desktop rail + mobile drawer + deep-link reload)
```

**Structure Decision**: Single `settingsNav` config is the source of truth for
both the rail and the drawer and for leaf→component rendering. Groups are
presentation-only and never appear in the URL. Leaves map 1:1 to existing
components; Appearance's `PanelContent` and System's three sections are promoted
to standalone leaves, and Integrations remains the one leaf with a `?panel=`
service selector (the generic, leaf-interpreted seam reserved for #20).

## Source Impact

- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/settings/settingsNav.ts` (new)
- `frontend/src/components/settings/SettingsNav.tsx` (new)
- `frontend/src/components/settings/AppearanceTab.tsx`
- `frontend/src/components/settings/SystemTab.tsx`
- `frontend/src/components/settings/IntegrationsTab.tsx`
- `frontend/src/components/settings/MobileSectionSelect.tsx` (remove when unused)
- in-app deep-link verification: `app/router.tsx`, `components/ShellLayout.tsx`,
  `components/UserMenu.tsx`, `components/EmptyDashboard.tsx`,
  `components/widgets/DockerConnectionPicker.tsx`, `SonosWidget.tsx`,
  `SpotifyWidget.tsx`, `components/settings/WidgetsTab.tsx`
- tests: settings nav unit tests + `EmptyDashboard.test.tsx` and e2e coverage

## Complexity Tracking

No constitution violations; no complexity exceptions required.
