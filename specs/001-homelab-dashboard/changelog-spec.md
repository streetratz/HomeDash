# Spec Changelog — Customizable Home Lab Dashboard

**Feature Branch**: `001-homelab-dashboard`  
**File**: `spec.md`

All changes to `spec.md` are recorded here. Each entry follows the format:

> `CH-NN : <ShortDescription> : YYYY-Mmm-DD HHMM UTC`

---

## Table of Contents

- [CH-01 : Initial Specification](#ch-01--initial-specification)
- [CH-02 : Phase Log Review — 18 additions/revisions](#ch-02--phase-log-review--18-additionsrevisions)
- [CH-03 : UX Polish & Bug Fix — 8 additions/revisions](#ch-03--ux-polish--bug-fix--8-additionsrevisions)
- [CH-04 : Modern UI Redesign — 25 additions/revisions](#ch-04--modern-ui-redesign--25-additionsrevisions)

---

## CH-01 : Initial Specification : 2026-Feb-21 0000 UTC

**Type**: New document  
**Author**: Project owner  

**Summary**: First draft of the feature specification created from user description and session clarifications. Establishes all user stories, acceptance scenarios, edge cases, FRs, NFRs, key entities, success criteria, and Q&A clarifications.

**Items introduced**:

| ID | Description |
|----|-------------|
| User Stories 1–3 | First Run, Shell Customization, Dashboard Editing |
| FR-001 – FR-033 | All initial functional requirements |
| NFR-001 – NFR-008a | All initial non-functional requirements |
| SC-001 – SC-007 | All initial success criteria |
| Key Entities (10) | User, Session, App Shell Settings, User Preferences, Dashboard, Dashboard Preference, Dashboard Background, Placeholder Widget, App Widget, Link Item, Uploaded Asset |
| Clarifications | Session 2026-02-21 (6 Q&A items) |

---

## CH-02 : Phase Log Review — 18 additions/revisions : 2026-Feb-22 1400 UTC

**Type**: Spec revision  
**Trigger**: Review of Phase 01–06 execution logs; 3 runtime bugs and 6 build errors identified during implementation.  
**Status**: `Draft` → `Active`

**Summary**: 18 changes across user stories, edge cases, functional requirements, non-functional requirements, success criteria, key entities, assumptions, and clarifications. All additions are traceable to a specific phase log bug or error.

### New Scenarios

| ID | Section | Source | Description |
|----|---------|--------|-------------|
| US1 Scenario 2a | User Story 1 | Phase 05 Bug 2 | Bootstrap cache MUST be fully evicted (not merely invalidated) before navigating away from first-run |
| US2 Scenario 1a | User Story 2 | Phase 05 Bug 3 | Light-mode theme MUST produce visibly light-coloured shell/header/footer/dashboard |
| US2 Scenario 1b | User Story 2 | Phase 05 Bug 3 | FOUC prevention: `dark` class MUST already be on `<html>` before React mounts |
| US2 Scenario 7 | User Story 2 | Phase 05 Bug 1 | Shell settings endpoints MUST respond 200 on first boot with no manual intervention |

### New Edge Cases

| Source | Description |
|--------|-------------|
| Phase 05 Bug 2 | Cache-eviction race: first-run submit succeeds but stale `firstRunRequired: true` causes redirect loop back to `/first-run` |

### New Functional Requirements

| ID | Source | Description |
|----|--------|-------------|
| FR-001b | Phase 05 Bug 1 | Startup sequence: migrate → seed → listen, in order, before accepting HTTP traffic |
| FR-001c | Phase 05 Bug 1 | `app_shell_settings` singleton invariant; seed creates the row; API returns 500 with diagnostic message if absent |
| FR-009a | Phase 05 Bug 3 | Tailwind `class` dark mode strategy; all components MUST use `dark:` utility class pairs |
| FR-009b | Phase 05 Bug 3 | FOUC-prevention inline `<script>` in `index.html` `<head>` applies `dark` class before render |

### New Non-Functional Requirements

| ID | Source | Description |
|----|--------|-------------|
| NFR-009 | Phase 02 Errors 2 & 7 | Backend CJS module: no top-level `await`; use async IIFE; `tests/` must be in typecheck scope via `tsconfig.test.json` |
| NFR-010 | Phase 02 Error 8 | `exactOptionalPropertyTypes: true` — optional `fetch` body must use conditional spread, not `undefined` assignment |
| NFR-011 | Phase 05 Bug 2 | Post-mutation navigation: use `removeQueries` (full eviction), not `invalidateQueries` (stale-serves-synchronously), before navigating to gated routes |
| NFR-012 | Phase 02 Errors 3 & 4 | drizzle-kit `v0.21+`: config must use `dialect: 'sqlite'`; command must be `generate` (not deprecated `generate:sqlite`) |
| NFR-013 | Phase 02 Error 5 | Vitest must set `passWithNoTests: true` to avoid exit-1 failures during iterative phase delivery |

### New Success Criteria

| ID | Source | Description |
|----|--------|-------------|
| SC-008 | Phase 05 Bug 1 | `GET /api/admin/shell` returns HTTP 200 immediately after fresh-install startup |
| SC-009 | Phase 05 Bug 3 | Theme toggle produces a visible colour change in shell/header/main without a reload |
| SC-010 | Phase 05 Bug 2 | First-run completion does not loop back to `/first-run` |

### Revised Key Entities

| Entity | Change |
|--------|--------|
| App Shell Settings | Added singleton constraint: "A single singleton row MUST exist at all times; initialized by the server seed step on startup." |

### Revised Assumptions & Dependencies

Three new assumption bullets added:
- Singleton tables must have exactly one row; initialized by seed, never deleted.
- TanStack Query cache management for auth transitions requires `removeQueries`, not `invalidateQueries`.
- Tailwind CSS uses `darkMode: 'class'`; all theme-sensitive components use `dark:` utility pairs.

### New Clarifications (Session 2026-02-22)

Four Q&A items added:
- Server startup order (migrate → seed → listen)
- Seed idempotency requirement (`INSERT OR IGNORE` pattern)
- `removeQueries` vs `invalidateQueries` for post-auth navigation
- Dark mode class-based strategy + FOUC prevention obligation

---

## CH-03 : UX Polish & Bug Fix — 8 additions/revisions : 2026-Feb-22 2100 UTC

**Type**: Spec revision  
**Trigger**: Phase 07 execution — 2 runtime bugs discovered during human testing, 2 TypeScript build errors caught during Docker rebuild, 4 UX-polish FR changes added.  
**Status**: `Active` (no status change; incremental update)

**Summary**: 8 changes covering two critical runtime bugs (logout 500 crash; clock display config no-op), two TypeScript build errors under `exactOptionalPropertyTypes`, and four new or revised functional/non-functional requirements arising from UX polish work (sticky header, global clock config, breadcrumb nav, UserMenu redesign).

### New Scenarios

| ID | Section | Source | Description |
|----|---------|--------|-------------|
| Auth Scenario: Logout Correctness | Auth / Logout | Phase 07 Bug 1 | Logout MUST destroy the server-side session and clear the cookie atomically; a 500 before session destroy runs is a critical auth failure |
| Shell Scenario: Sticky Header | US2 Shell | Phase 07 FR | The shell header MUST remain visible when dashboard content scrolls; `h-screen / overflow-hidden` + `overflow-y-auto` on `<main>` is the required implementation pattern |

### New Functional Requirements

| ID | Source | Description |
|----|--------|-------------|
| FR-013 | Phase 07 UX | Global clock display config (`homeClockConfig`): a single config object stored on `app_shell_settings` controls layout, icon side, day/night side, and offset visibility for the entire clock strip; no per-extra-clock config |
| FR-014 | Phase 07 UX | Shell header MUST be sticky; layout MUST use `h-screen flex-col overflow-hidden` with `<main className="overflow-y-auto">` so only content scrolls |
| FR-015 | Phase 07 Bug 1 | API client MUST NOT set `Content-Type: application/json` when the request has no body; header MUST be omitted for bodyless POST/DELETE requests |

### New Non-Functional Requirements

| ID | Source | Description |
|----|--------|-------------|
| NFR-014 | Phase 07 Bug 1 | Post-logout navigation: MUST call `queryClient.clear()` (not `invalidateQueries`) then `navigate('/', { replace: true })` to prevent stale auth state serving after session destruction |
| NFR-015 | Phase 07 Bug 1 | `Content-Type: application/json` header MUST only be included in requests where a JSON body is present; absence triggers `FST_ERR_CTP_EMPTY_JSON_BODY` in Fastify strict mode before session destroy runs |

### New Success Criteria

| ID | Source | Description |
|----|--------|-------------|
| SC-011 | Phase 07 Bug 1 | Logout: after clicking logout, `GET /api/admin/shell` returns HTTP 401 (session is dead server-side) and the session cookie is absent from subsequent requests |

---

## CH-04 : Modern UI Redesign — 25 additions/revisions : 2026-Apr-24 0000 UTC

**Type**: Major spec revision
**Trigger**: User decision to transform HomeDash from a basic prototype into a modern, mobile-first smart home hub dashboard (Homer/Homarr/Dashy style). Full frontend UI redesign + completion of all Phase 5 dashboard features.
**Status**: `Active` (no status change; scope expansion)

**Summary**: 25 changes adding shadcn/ui component library, Lucide React icons, Sonner toast notifications, HSL-based design system, responsive navigation patterns, dashboard CRUD APIs, and expanded acceptance scenarios for modern UI.

### New User Story

| ID | Description |
|----|-------------|
| User Story 4 (P0) | Modern UI Foundation — cross-cutting requirement for consistent shadcn/ui components, HSL theme tokens, toast feedback, and responsive design across all pages |

### Revised User Stories

| ID | Change |
|----|--------|
| User Story 1 | Added requirement for "modern UI components (shadcn/ui Card, Input, Button)" in acceptance scenario 1; updated independent test to mention "modern shell" |
| User Story 2 | Added acceptance scenario 8 for settings page layout (sidebar/tab bar, Card sections, shadcn/ui controls); updated scenario 2 to specify "shadcn/ui DropdownMenu" |
| User Story 3 | Added acceptance scenarios 6 (Save/Cancel flow) and 7 (mobile single-column); updated scenarios 1 and 3 with modern UI specifics (Card list, Dialog, FAB, touch handles) |

### New Edge Cases

| Description |
|-------------|
| Mobile edit mode: touch drag/drop conflicts with page scroll; MUST use explicit drag handles |
| Dashboard with many widgets (20+): grid rendering MUST not block main thread for > 100ms |
| Icon picker with large catalog (500+ icons): MUST use virtualized list or search filtering |

### New Functional Requirements

| ID | Description |
|----|-------------|
| FR-009b | HSL-based CSS custom properties for theme colors; `dark` class switches values |
| FR-016a | Responsive grid breakpoints: 1 col mobile, 2 col tablet, 4+ col desktop; must use ResponsiveGridLayout |
| FR-018a | Edit mode UX: floating toolbar/FAB with Save/Cancel; visual indicator; local state until Save |
| FR-019b | Touch drag handles on mobile to avoid scroll conflicts |
| FR-034 | UI Component Library: shadcn/ui (Radix + Tailwind) for all interactive elements |
| FR-034a | cn() utility function (clsx + tailwind-merge) |
| FR-035 | General Icons: Lucide React (except clock strip which stays FontAwesome) |
| FR-036 | Toast Notifications: Sonner for all feedback; no browser alert/confirm |
| FR-037 | Loading States: Skeleton components for all data-fetching views |
| FR-038 | Settings Page Layout: sidebar nav desktop / tab bar mobile; Card sections |
| FR-039 | Responsive Navigation: hamburger menu (Sheet) on mobile |
| FR-040 | Empty Dashboard State: friendly illustration + CTA for admins |
| FR-041 | Dashboard CRUD API endpoints |
| FR-042 | Placeholder CRUD API endpoints |
| FR-043 | Widget Instance CRUD API endpoints |
| FR-044 | Links List Item CRUD API endpoints |
| FR-045 | Icon Cache API endpoints |

### Revised Functional Requirements

| ID | Change |
|----|--------|
| FR-010 | Updated to specify "shadcn/ui DropdownMenu" for user menu |
| FR-011a | Updated to specify "shadcn/ui Switch" for clock strip toggle |

### New Non-Functional Requirements

| ID | Description |
|----|-------------|
| NFR-014 | Touch Target Size: minimum 44×44px on mobile (WCAG 2.5.5) |
| NFR-015 | Dashboard Render Performance: 20 widgets FCP < 200ms; no main thread block > 100ms |
| NFR-016 | Icon Picker Performance: virtualized list or search for 500+ icons |

### New Success Criteria

| ID | Description |
|----|-------------|
| SC-011 | Consistent Component Library: all pages use shadcn/ui exclusively |
| SC-012 | Toast Feedback: all CRUD operations provide toast within 500ms |
| SC-013 | Responsive Grid: single-column mobile, multi-column desktop, no overflow |

### Revised Success Criteria

| ID | Change |
|----|--------|
| SC-005 | Updated to specify "360px" width and "44px minimum" touch targets |

### Revised Assumptions & Dependencies

Five new assumption bullets added:
- shadcn/ui component library (Radix + Tailwind); components in `frontend/src/components/ui/`
- Lucide React for general icons; FontAwesome Free for clock strip only
- Sonner for toast notifications via shadcn/ui Toaster integration
- class-variance-authority, clsx, and tailwind-merge required for shadcn/ui
- HSL-based CSS custom properties for theming (shadcn convention)

### New Clarifications (Session 2026-04-24)

Seven Q&A items added:
- Dashboard style target (Homer/Homarr/Dashy)
- Component library decision (shadcn/ui)
- Icon library decision (Lucide React, keeping FontAwesome for clocks)
- Toast/notification feedback (Sonner)
- Scope of redesign (full page redesign + new features)
- Framework decision (keep React + Vite + TanStack Query)
- Mobile navigation pattern (hamburger Sheet, bottom sheets)
