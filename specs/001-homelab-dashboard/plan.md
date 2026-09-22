# Implementation Plan: Customizable Home Lab Dashboard

**Branch**: `001-homelab-dashboard` | **Date**: 2026-02-21 | **Revised**: 2026-04-24 | **Spec**: `specs/001-homelab-dashboard/spec.md`
**Input**: Feature specification from `specs/001-homelab-dashboard/spec.md`

## Summary

Build a LAN-hosted, offline-capable, **modern mobile-first smart home hub dashboard** web app with:

- first-run admin creation (when no users exist),
- authenticated + unauthenticated read-only browsing,
- **shadcn/ui component library** (Radix UI primitives + Tailwind CSS) for all interactive elements,
- **Lucide React** for general icons, FontAwesome Free for clock strip only,
- **Sonner** toast notifications for all user feedback,
- configurable global shell (logo + favicon, title font/size, header height, optional timezone clock strip, footer message/link),
- per-user preferences (theme + dashboard selection for web/mobile contexts),
- admin-only dashboard management and grid editing (drag/drop/resize translucent placeholders hosting app widgets) using `react-grid-layout`,
- initial Links List widget with best-effort icon fetch from selfh.st and local caching with offline fallback,
- **responsive design** with mobile-first breakpoints, touch-friendly controls, and hamburger navigation.

Supporting artifacts:

- Phase 0: `specs/001-homelab-dashboard/research.md`
- Phase 1: `specs/001-homelab-dashboard/data-model.md`, `specs/001-homelab-dashboard/contracts/openapi.yaml`, `specs/001-homelab-dashboard/quickstart.md`

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript (backend and frontend)
**Primary Dependencies**:
- Backend: Fastify, `@fastify/helmet`, cookie + server-side session (hand-rolled in SQLite), CSRF protection, Zod (request validation), Pino (structured logs), Drizzle ORM 0.45.2 + `better-sqlite3` (SQLite), Sharp (image processing)
- Frontend: React 18 + Vite + TypeScript, Tailwind CSS 3, **shadcn/ui** (Radix UI primitives), **Lucide React** (icons), **Sonner** (toasts), **class-variance-authority** + **clsx** + **tailwind-merge** (component utilities), TanStack Query v5, `react-grid-layout` (dashboard grid), FontAwesome Free (clock strip only)
**Storage**: SQLite for all domain state; local filesystem under a single data directory for uploaded assets + icon cache
**Testing**: Vitest (unit/integration), Playwright (E2E smoke flows), OpenAPI contract lint/validation
**Target Platform**: Linux (x64/arm64) in a Synology NAS Docker container (host networking) + local dev on macOS
**Project Type**: Web application (backend + frontend in one repo; backend serves frontend assets)
**Performance Goals**: UX interactions (theme toggle, navigation, edit toggle) visibly update within 1s on a home LAN; dashboard with 20 widgets renders FCP < 200ms
**Constraints**: Offline-first runtime, no telemetry, least-privilege authz, explicit CORS, secure cookie sessions + CSRF
**Scale/Scope**: Small LAN (single instance, low concurrency); prioritize correctness + operability over extreme throughput

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Post-design re-check (Phase 1)**: PASS
**Redesign re-check (2026-04-24)**: PASS — all new dependencies are MIT-licensed, offline-capable, and aligned with constitution principles.

- [x] Secure-by-default
  - Authn: cookie-based sessions (HttpOnly; `SameSite=Lax`; `Secure` when behind TLS)
  - Authz: explicit role checks (admin vs standard) and default-deny routing
  - Passwords: Argon2id with rate limiting on login
  - CSRF: required for all state-changing requests using cookie auth
  - Input validation: Zod schemas at all request boundaries; reject unknown fields
  - Security headers: CSP + `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` via Helmet
  - Secrets: session key + config via env vars / mounted secrets; never logged
- [x] LAN-only boundary
  - Binding: `HOST`/`PORT` configurable (documented); safe defaults; no auto-expose features
  - CORS: disabled by default; if enabled, allowlist `ALLOWED_ORIGINS` only
  - Proxy trust: explicit `TRUST_PROXY` config when behind reverse proxy
- [x] Mobile-first UI
  - Responsive layout for ~360px+; touch targets >= 44px; keyboard navigation; semantic HTML
  - shadcn/ui provides ARIA-compliant components out of the box
  - Grid editor includes keyboard-accessible move/resize fallback behavior
  - Mobile navigation via Sheet (hamburger menu); bottom sheets for configuration dialogs
- [x] Operability
  - Structured logs (Pino) + request IDs; user-safe errors + actionable server logs
  - `/healthz` and `/readyz` endpoints; readiness fails if DB/migrations are not usable
- [x] Testing & change safety
  - Backend authn/authz tests (positive/negative), migration tests, and OpenAPI contract checks
  - Frontend component tests for shell controls; Playwright tests for first-run and unauth view

**Note on unauthenticated mode vs Secure-by-default**: unauthenticated browsing is supported only for explicitly public, read-only data (default dashboards + shell). All mutation endpoints and all user/admin settings endpoints require authentication.

## Threat Model Note (Required)

This feature includes auth, network boundary decisions (public endpoints), and persistent storage changes.
Per constitution, every PR that changes auth/network/storage MUST include (or update) a threat model note.

### Scope (what changed)

**Phases 1-4 (Completed)** — Auth, shell, settings, theme all implemented and tested.

**Redesign scope (new)** — New dashboard CRUD API endpoints, placeholder/widget/links CRUD endpoints, icon cache management endpoints. New frontend pages with shadcn/ui components. No changes to auth model.

- New endpoints: Dashboard CRUD (`/api/admin/dashboards/*`), Placeholder CRUD (`/api/admin/placeholders/*`, `/api/admin/dashboards/:id/placeholders`, `/api/admin/dashboards/:id/layout`), Widget CRUD (`/api/admin/widgets/*`, `/api/admin/placeholders/:id/widgets/*`), Links CRUD (`/api/admin/links/*`, `/api/admin/widgets/:id/links/*`), Icon cache (`/api/admin/icons/refresh`, `/api/icons`, `/api/icons/:key`), Dashboard read (`/api/dashboards/:id`)
- New stored data: Dashboard, placeholder, widget, and link records (schema already exists). Icon cache entries.
- New trust boundaries: Dashboard read endpoint allows any authenticated user. All mutation endpoints admin-only. Icon cache read is public (cached data only).

### Assets to protect

- Session cookies + CSRF tokens
- User credentials (password hashes)
- Admin-only configuration (shell settings, dashboard management)
- Uploaded files (logo/background) and icon cache
- SQLite DB file on disk

### Entry points & abuse cases

- Auth endpoints brute force, session fixation, CSRF on mutations (mitigated in Phase 3)
- Public endpoints data leakage / enumeration
- Upload endpoints: polyglot files, oversized payloads, path traversal (mitigated in Phase 4)
- Icon refresh: SSRF-like fetch behavior, unexpected outbound traffic (mitigated by admin-only control)
- Static file serving from data dir: path traversal via `@fastify/static` (mitigated by root pinning)
- Dashboard CRUD: unauthorized access to admin endpoints (mitigated by auth middleware)

### Mitigations (must be implemented)

- Default-deny authz; public endpoints are GET-only and return only admin-selected defaults
- CSRF required on all state-changing requests
- Rate limiting on auth entry points
- Strict input validation; reject unknown fields
- Upload magic-byte sniffing + size limits + atomic writes
- External icon fetch is admin-only, best-effort, and never blocks primary navigation
- CORS disabled by default; allowlist only via `ALLOWED_ORIGINS` env var
- Helmet security headers applied globally
- SQLite WAL + foreign keys + busy timeout

### Residual risk / follow-ups

- Session secret defaults to a placeholder value; production deployments MUST set `SESSION_SECRET`.
- DB file permissions: `HOMEDASH_DATA_DIR` ownership should be restricted to the service user.
- HSTS disabled intentionally for LAN HTTP. Reverse proxies should add HSTS when terminating TLS.

## Project Structure

### Documentation (this feature)

```text
specs/001-homelab-dashboard/
├── spec.md
├── plan.md
├── tasks.md
├── changelog-spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
├── logs/
│   ├── readme.md
│   └── NN-phase-*.md (+ .log sidecars)
└── test-outcomes-and-results.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/              # route registration (public, auth, admin)
│   ├── auth/             # session, CSRF, password hashing, rate limits
│   ├── db/               # drizzle schema + migrations runner
│   ├── services/         # dashboards, settings, assets, icons
│   ├── lib/              # shared utilities (validation, errors, logging)
│   └── server.ts
└── tests/

frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components (Button, Card, Dialog, etc.)
│   │   ├── layout/       # Shell, Header, Footer, Navigation
│   │   ├── dashboard/    # DashboardGrid, PlaceholderWidget, WidgetRenderer
│   │   └── widgets/      # LinksListWidget, etc.
│   ├── pages/            # Login, FirstRun, Settings, Dashboard, DashboardManagement
│   ├── hooks/            # TanStack Query hooks (useDashboard, useShellSettings, etc.)
│   ├── state/            # Auth context, theme context
│   ├── lib/
│   │   └── utils.ts      # cn() utility (clsx + tailwind-merge)
│   └── App.tsx
├── components.json       # shadcn/ui configuration
└── tests/
```

**Structure Decision**: Use a `backend/` + `frontend/` layout to keep web UI and API concerns separated, while still enabling a single-container deployment where the backend serves the built frontend bundle at the same origin.

## Complexity Tracking

No constitution violations required for this feature.

## Phase 0: Research (Completed)

See `specs/001-homelab-dashboard/research.md`.

## Phase 1: Design Outputs (Completed)

- Data model: `specs/001-homelab-dashboard/data-model.md`
- API contracts: `specs/001-homelab-dashboard/contracts/openapi.yaml`
- Operator/developer quickstart: `specs/001-homelab-dashboard/quickstart.md`

## Phase 2: Implementation Milestones

### Completed Work (Phases 1-4 + 7)

The following milestones are implemented and tested:

1. ✅ Scaffold `backend/` + `frontend/` with shared formatting/linting and CI test gates.
2. ✅ SQLite schema + migrations + base services; `/healthz` + `/readyz` and structured logging.
3. ✅ First-run admin creation + login/logout + session cookies + CSRF; authn/authz tests.
4. ✅ Global shell settings (logo upload + favicon, title styling, header height, clocks, footer) and per-user preferences (theme + dashboard mapping).
5. ✅ Bug fixes: 48 lint errors → 0, async/sync DB fixes, vitest/playwright config separation, ESLint config fixes.

### Redesign Milestones (New)

**Milestone R0: Dependency Upgrades (Pre-requisite)**
- Remove unused `@fastify/session` ✅
- Upgrade drizzle-orm 0.30→0.45.2 + drizzle-kit 0.21→0.31.10
- Migrate ESLint v8→v9 flat config
- Verify: typecheck + lint + test pass

**Milestone R1: UI Foundation — shadcn/ui + Design System**
- Initialize shadcn/ui in frontend workspace
- Install: lucide-react, class-variance-authority, clsx, tailwind-merge, sonner
- Configure `components.json`, `cn()` utility, HSL-based CSS custom properties
- Add core components: Button, Card, Input, Label, Dialog, Sheet, DropdownMenu, Switch, Select, Separator, Badge, Tooltip, Skeleton, Toast (Sonner)
- Update Tailwind config with shadcn/ui design tokens

**Milestone R2: Redesign Existing Pages**
- Shell layout: glassmorphism header, responsive hamburger menu (Sheet), polished clock strip and footer
- Login page: centered Card layout, shadcn Input/Button, toast errors, mobile layout
- First-run page: welcoming onboarding Card, step indicator, toast feedback
- Settings page: sidebar nav (desktop) / tab bar (mobile), Card sections, Switch/Select components, Sheet/Dialog for complex configs, image upload preview, toast confirmations

**Milestone R3: Backend Dashboard & Widget CRUD APIs**
- Dashboard CRUD: list, create, update, delete, read-with-children (FR-041)
- Placeholder CRUD: add, update, delete, batch layout update (FR-042)
- Widget instance CRUD: add, update, delete, reorder (FR-043)
- Links list item CRUD: add, update, delete, reorder (FR-044)
- Background image upload: reuse asset upload pattern
- Icon cache management: refresh, list, get (FR-045)

**Milestone R4: Dashboard Grid — View Mode**
- `DashboardGrid.tsx` with react-grid-layout ResponsiveGridLayout
- Read-only mode (no drag/drop/resize), responsive breakpoints (FR-016a)
- `PlaceholderWidget.tsx` with translucent styling, title pill (FR-023-025)
- `WidgetRenderer.tsx` type discriminator + component registry
- `LinksListWidget.tsx` with vertical/horizontal modes (FR-030-033)
- Empty dashboard state (FR-040)
- TanStack Query hooks for dashboard data

**Milestone R5: Dashboard Grid — Edit Mode**
- Edit mode toggle (admin-only FAB/toolbar) (FR-018a)
- Drag/drop/resize with touch-friendly handles (FR-019b)
- Placeholder configuration dialog (title, border color, opacity)
- Widget configuration (add/edit/remove links, icon picker, layout mode)
- Dashboard background configuration (color picker, image upload, display mode)
- Save/Cancel flow with optimistic local state (FR-018a)

**Milestone R6: Dashboard Management Page**
- `/admin/dashboards` route (admin only)
- Dashboard list with Cards, create/rename/delete dialogs (FR-020)
- Device applicability selector (web/mobile/both)
- Default dashboard assignment integration

**Milestone R7: Polish & Testing**
- Page transition animations, edit mode enter/exit animation
- Accessibility audit (keyboard nav, ARIA labels, focus management)
- Mobile optimization (touch targets, swipe gestures, bottom sheets)
- Unit tests for widget components (Vitest)
- Integration tests for dashboard CRUD (backend)
- E2E tests for key flows (Playwright)

## Design Notes

### shadcn/ui Integration

shadcn/ui components are **not** installed as an npm package. They are scaffolded into the project via the `npx shadcn@latest add <component>` CLI, which creates component files in `frontend/src/components/ui/`. This means:

- Components are fully customizable (source code lives in the project)
- No version drift from an external package
- `components.json` configures paths, Tailwind CSS config location, and component aliases

### Theme System

The existing Tailwind `darkMode: 'class'` strategy is extended with HSL-based CSS custom properties (shadcn/ui convention):

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

All shadcn/ui components reference these variables via Tailwind (`bg-background`, `text-foreground`, etc.), ensuring consistent theming.

### Icon Strategy

| Context | Library | Rationale |
|---------|---------|-----------|
| Clock strip (home, sun, moon) | FontAwesome Free | Spec mandate FR-012a |
| All other UI icons | Lucide React | Modern, lightweight, shadcn/ui default |
| Link item icons | selfh.st cache or fallback | Domain-specific service icons |

### Grid Library

`react-grid-layout` (already in deps) with `ResponsiveGridLayout`:
- Breakpoints: `lg` (1200+, 12 cols), `md` (996+, 8 cols), `sm` (768+, 4 cols), `xs` (<768, 1 col)
- `isDraggable` and `isResizable` controlled by edit mode state
- Touch support via `useCSSTransforms` and explicit drag handles
