---

description: "Task list for implementing HomeDash (Customizable Home Lab Dashboard)"

---

# Tasks: HomeDash (Customizable Home Lab Dashboard)

**Input**: Design documents from `specs/001-homelab-dashboard/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included. This feature includes auth, storage, and network boundaries; tests are required.

## Format: `- [ ] T### [P?] [US?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]/[US2]/[US3]/[US4]**: User story mapping (only used in story phases)
- Every task includes at least one exact file path

---

## Phase 1: Setup (Shared Infrastructure) ✅

**Purpose**: Create the repo structure and tooling described in plan.md (backend/ + frontend/), with repeatable dev/test commands.

- [X] T001 Create pnpm workspace root config in pnpm-workspace.yaml
- [X] T002 Initialize root package scripts and workspace wiring in package.json
- [X] T003 [P] Add shared TypeScript base config in tsconfig.base.json
- [X] T004 [P] Add shared formatting config in .editorconfig and .prettierrc
- [X] T005 [P] Configure ESLint with shared rules in .eslintrc.cjs (root)
- [X] T006 Configure lint-staged + Husky pre-commit hooks in .husky/ and .lintstagedrc
- [X] T007 [P] Create backend/ workspace package.json and tsconfig.json (extends base)
- [X] T008 [P] Create frontend/ workspace package.json, tsconfig.json, and Vite config in vite.config.ts
- [X] T009 Verify pnpm install, pnpm lint, pnpm typecheck, pnpm build, and pnpm test all pass from root

## Phase 2: Backend Foundation ✅

**Purpose**: Implement SQLite DB, Drizzle ORM schema, migrations, base services, health endpoints, and structured logging per plan.md and data-model.md.

- [X] T010 Install backend dependencies (drizzle-orm, better-sqlite3, fastify, etc.) in backend/package.json
- [X] T011 [P] Create Drizzle schema for `users` table in backend/src/db/schema.ts
- [X] T012 [P] Create Drizzle schema for `sessions` table in backend/src/db/schema.ts
- [X] T013 [P] Create Drizzle schema for `app_shell_settings` (singleton) in backend/src/db/schema.ts
- [X] T014 [P] Create Drizzle schema for `user_preferences` table in backend/src/db/schema.ts
- [X] T015 [P] Create Drizzle schema for `dashboards` table in backend/src/db/schema.ts
- [X] T016 [P] Create Drizzle schema for `placeholder_widgets` table in backend/src/db/schema.ts
- [X] T017 [P] Create Drizzle schema for `app_widget_instances` table in backend/src/db/schema.ts
- [X] T018 [P] Create Drizzle schema for `links_list_items` table in backend/src/db/schema.ts
- [X] T019 [P] Create Drizzle schema for `uploaded_assets` table in backend/src/db/schema.ts
- [X] T020 [P] Create Drizzle schema for `icon_cache_entries` table in backend/src/db/schema.ts
- [X] T021 Create Drizzle config in backend/drizzle.config.ts (SQLite dialect, migrations dir)
- [X] T022 Generate initial migration via drizzle-kit generate in backend/drizzle/
- [X] T023 Create migration runner in backend/src/db/migrate.ts (run on startup)
- [X] T024 Create DB connection and seed function in backend/src/db/index.ts
- [X] T025 Create data directory setup utility in backend/src/lib/data-dir.ts
- [X] T026 [P] Implement GET /healthz route in backend/src/api/health.ts
- [X] T027 [P] Implement GET /readyz route in backend/src/api/health.ts (DB + dir checks)
- [X] T028 Configure Pino structured logging in backend/src/server.ts (request IDs, durations)
- [X] T029 Create server entry point in backend/src/server.ts (startup sequence: migrate → seed → listen)
- [X] T030 Write unit tests for health endpoints in backend/tests/api/health.test.ts
- [X] T031 Write unit tests for seed idempotency in backend/tests/db/seed.test.ts
- [X] T032 Run pnpm lint, typecheck, test from root and verify all pass

## Phase 3: Backend Auth + First-Run (US1, US2) ✅

**Purpose**: Implement auth (session cookies, CSRF, argon2 password hashing), first-run admin creation, login/logout, and authn/authz middleware.

- [X] T033 Implement password hashing service (argon2id) in backend/src/auth/password.ts
- [X] T034 Implement session service (create/validate/destroy) in backend/src/auth/session.ts
- [X] T035 Implement CSRF protection middleware in backend/src/auth/csrf.ts
- [X] T036 Implement auth middleware (cookie extraction, session lookup, role check) in backend/src/auth/middleware.ts
- [X] T037 Implement user service (createUser, getByUsername, etc.) in backend/src/services/user.ts
- [X] T038 [US1] Implement GET /api/public/bootstrap (firstRunRequired + unauthenticatedUserState) in backend/src/api/public.ts
- [X] T039 [US1] Implement POST /api/first-run/admin in backend/src/api/first-run.ts
- [X] T040 Implement POST /api/auth/login in backend/src/api/auth.ts
- [X] T041 Implement POST /api/auth/logout in backend/src/api/auth.ts
- [X] T042 Implement GET /api/auth/me in backend/src/api/auth.ts
- [X] T043 [P] Write auth positive/negative tests in backend/tests/auth/auth.test.ts
- [X] T044 [P] Write first-run tests in backend/tests/api/first-run.test.ts
- [X] T045 [P] Write CSRF tests in backend/tests/auth/csrf.test.ts
- [X] T046 Run pnpm lint, typecheck, test from root and verify all pass

## Phase 4: Backend Shell Settings + User Preferences (US2) ✅

**Purpose**: Implement shell settings CRUD (admin), user preferences CRUD, logo upload + favicon generation, and asset serving.

- [X] T047 Implement shell settings service in backend/src/services/shell-settings.ts
- [X] T048 Implement GET /api/admin/shell and PUT /api/admin/shell in backend/src/api/admin-shell.ts
- [X] T049 Implement user preferences service in backend/src/services/user-preferences.ts
- [X] T050 Implement GET /api/user/preferences and PUT /api/user/preferences in backend/src/api/user-preferences.ts
- [X] T051 Implement asset upload service (magic-byte validation, atomic write) in backend/src/services/assets.ts
- [X] T052 Implement POST /api/admin/assets/logo (upload + favicon generation via Sharp) in backend/src/api/admin-assets.ts
- [X] T053 Implement GET /api/admin/shell response includes logo URL if set, in backend/src/api/admin-shell.ts
- [X] T054 Configure @fastify/static to serve uploaded assets from $DATA_DIR in backend/src/server.ts
- [X] T055 [P] Write shell settings tests in backend/tests/api/shell-settings.test.ts
- [X] T056 [P] Write user preferences tests in backend/tests/api/user-preferences.test.ts
- [X] T057 [P] Write asset upload tests in backend/tests/api/assets.test.ts
- [X] T058 Run pnpm lint, typecheck, test from root and verify all pass

## Phase 5: Frontend Foundation (US1, US2) ✅

**Purpose**: Implement frontend base: API client, auth state, routing, first-run page, login page, shell layout (header/footer/clocks), settings page, and theme persistence.

- [X] T059 Create API client module in frontend/src/lib/api.ts (fetch wrapper with CSRF)
- [X] T060 Create TanStack Query provider and bootstrap hook in frontend/src/state/query.ts
- [X] T061 [US1] Create routing setup (react-router-dom) in frontend/src/App.tsx
- [X] T062 Create auth context provider in frontend/src/state/auth.tsx
- [X] T063 [US1] Implement First-Run page in frontend/src/pages/FirstRunPage.tsx
- [X] T064 [US1] Implement Login page in frontend/src/pages/LoginPage.tsx
- [X] T065 [US2] Implement Shell layout (header + main + footer) in frontend/src/components/Shell.tsx
- [X] T066 [US2] Implement Header component with logo, title, theme toggle, user menu in frontend/src/components/Header.tsx
- [X] T067 [US2] Implement ClockStrip component in frontend/src/components/ClockStrip.tsx
- [X] T068 [US2] Implement Footer component in frontend/src/components/Footer.tsx
- [X] T069 [US2] Implement theme persistence (localStorage + class toggle) in frontend/src/state/theme.ts
- [X] T070 [US2] Implement Settings page with shell settings admin section in frontend/src/pages/SettingsPage.tsx
- [X] T071 Write component tests for Shell/Header/Footer in frontend/src/components/__tests__/
- [X] T072 Run pnpm lint, typecheck, test from root and verify all pass

## Phase 6: Bug Fixes + Quality (Cross-Cutting) ✅

**Purpose**: Fix all lint errors, type errors, and test failures discovered after Phase 5 implementation.

- [X] T073 Fix ESLint configuration issues in .eslintrc.cjs (vitest globals, import resolution)
- [X] T074 Fix type import issues across all backend/frontend files (use `import type` consistently)
- [X] T075 Fix async/sync Fastify hook issues (done() callback for sync onRequest hooks) in backend/src/auth/middleware.ts
- [X] T076 Fix floating promise issues in frontend form handlers (void wrappers)
- [X] T077 Fix vitest/playwright config conflict in frontend/vitest.config.ts

## Phase 7: UX Polish + Bug Fixes ✅

**Purpose**: Refine existing UI, fix visual bugs, and improve user experience.

- [X] T118 Add rate limiting to auth endpoints in backend/src/auth/rate-limit.ts
- [X] T119 [US2] Add FOUC prevention script to frontend/index.html (apply dark class before React mounts)
- [X] T120 [US2] Fix light-mode contrast issues in ClockStrip and user menu (FR-009a, SC-009)
- [X] T121 [US2] Fix clock strip toggle to use ARIA role="switch" (FR-011a) in frontend/src/pages/SettingsPage.tsx
- [X] T122 [US2] Add timezone selection via searchable combobox (FR-011b) in frontend/src/pages/SettingsPage.tsx
- [X] T123 [US1] Fix first-run cache eviction (removeQueries before navigate) in frontend/src/pages/FirstRunPage.tsx
- [X] T124 [US1][US2] Add default dashboard selection (web/mobile) for unauthenticated users in Settings (FR-003)
- [X] T125 [US1][US2] Add user dashboard preference selection in Settings (FR-004) frontend/src/pages/SettingsPage.tsx
- [X] T126 [US1] Add device context detection (user agent → web/mobile) in backend/src/lib/device-detect.ts (FR-004a)
- [X] T127 [US2] Add clock day/night indicators (sun/moon icons, FR-012) in frontend/src/components/ClockStrip.tsx
- [X] T128 [US2] Add header height configuration to Settings (FR-013) in frontend/src/pages/SettingsPage.tsx
- [X] T129 [US2] Add favicon generation on logo upload (FR-007a) in backend/src/services/assets.ts
- [X] T130 [US2] Add title font selection (system-sans/serif/monospace) to Settings (FR-008a)
- [X] T131 [US2] Implement public shell settings endpoint for unauthenticated users in backend/src/api/public.ts
- [X] T132 Run pnpm lint, typecheck, test from root and verify all pass

---

## Phase R0: Dependency Upgrades (Pre-requisite for Redesign)

**Purpose**: Upgrade core dependencies to latest stable versions before redesign work begins.

- [ ] T141 Remove unused @fastify/session from backend/package.json (already done in file, needs pnpm install)
- [ ] T142 [P] Upgrade drizzle-orm to 0.45.2 and drizzle-kit to 0.31.10 in backend/package.json
- [ ] T143 Verify Drizzle migration artifacts still work with new drizzle-kit in backend/drizzle/
- [ ] T144 Migrate ESLint v8 → v9 flat config: create eslint.config.js, delete .eslintrc.cjs, update root package.json deps
- [ ] T145 [P] Install @eslint/js, globals, typescript-eslint 8.x, eslint-plugin-react 7.x, eslint-plugin-react-hooks 7.x in package.json
- [ ] T146 Run pnpm install, pnpm lint, pnpm typecheck, pnpm test and verify all pass

## Phase R1: UI Foundation — shadcn/ui + Design System (US4)

**Purpose**: Set up shadcn/ui component library, Lucide icons, Sonner toasts, and HSL-based design system tokens.

- [ ] T147 [US4] Initialize shadcn/ui: run `npx shadcn@latest init` in frontend/, configure components.json
- [ ] T148 [US4] Install lucide-react, class-variance-authority, clsx, tailwind-merge, sonner in frontend/package.json
- [ ] T149 [US4] Create cn() utility function in frontend/src/lib/utils.ts (clsx + tailwind-merge)
- [ ] T150 [US4] Update frontend/src/index.css with HSL-based CSS custom properties for light and dark themes (FR-009b)
- [ ] T151 [US4] Update frontend/tailwind.config.ts to reference CSS custom properties for all theme colors
- [ ] T152 [US4] Add shadcn/ui Button component via `npx shadcn@latest add button` in frontend/src/components/ui/button.tsx
- [ ] T153 [US4][P] Add shadcn/ui Card component in frontend/src/components/ui/card.tsx
- [ ] T154 [US4][P] Add shadcn/ui Input + Label components in frontend/src/components/ui/input.tsx, label.tsx
- [ ] T155 [US4][P] Add shadcn/ui Dialog component in frontend/src/components/ui/dialog.tsx
- [ ] T156 [US4][P] Add shadcn/ui Sheet component in frontend/src/components/ui/sheet.tsx
- [ ] T157 [US4][P] Add shadcn/ui DropdownMenu component in frontend/src/components/ui/dropdown-menu.tsx
- [ ] T158 [US4][P] Add shadcn/ui Switch component in frontend/src/components/ui/switch.tsx
- [ ] T159 [US4][P] Add shadcn/ui Select component in frontend/src/components/ui/select.tsx
- [ ] T160 [US4][P] Add shadcn/ui Skeleton component in frontend/src/components/ui/skeleton.tsx
- [ ] T161 [US4][P] Add shadcn/ui Tooltip, Badge, Separator components
- [ ] T162 [US4] Add Sonner Toaster component integration in frontend/src/App.tsx
- [ ] T163 [US4] Verify dark mode toggle works with new CSS custom properties (SC-009)
- [ ] T164 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R2: Redesign Existing Pages (US1, US2, US4)

**Purpose**: Redesign all existing pages to use shadcn/ui components with modern, mobile-first layouts.

- [ ] T165 [US4] Redesign Shell layout with glassmorphism header in frontend/src/components/Shell.tsx
- [ ] T166 [US4] Redesign Header: add hamburger menu (Sheet) for mobile (FR-039) in frontend/src/components/Header.tsx
- [ ] T167 [US2] Redesign Header: replace user menu with shadcn/ui DropdownMenu (FR-010) in frontend/src/components/Header.tsx
- [ ] T168 [US2] Redesign ClockStrip: polish visuals, maintain FontAwesome icons in frontend/src/components/ClockStrip.tsx
- [ ] T169 [US2] Redesign Footer: minimal, clean layout in frontend/src/components/Footer.tsx
- [ ] T170 [US1] Redesign Login page: centered Card, shadcn Input/Button, toast errors (FR-036) in frontend/src/pages/LoginPage.tsx
- [ ] T171 [US1] Redesign First-Run page: welcoming onboarding Card, toast feedback in frontend/src/pages/FirstRunPage.tsx
- [ ] T172 [US2] Redesign Settings page: sidebar nav (desktop) / tab bar (mobile) layout (FR-038) in frontend/src/pages/SettingsPage.tsx
- [ ] T173 [US2] Convert all Settings form controls to shadcn/ui (Switch, Select, Input, Dialog) in frontend/src/pages/SettingsPage.tsx
- [ ] T174 [US2] Add Skeleton loading states to all data-fetching views (FR-037)
- [ ] T175 [US4] Replace all inline error messages with Sonner toast notifications (FR-036) across frontend/src/pages/
- [ ] T176 [US4] Migrate all general icons from existing to Lucide React (FR-035) across frontend/src/components/
- [ ] T177 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R3: Backend Dashboard & Widget CRUD APIs (US3)

**Purpose**: Implement all backend CRUD endpoints for dashboards, placeholders, widgets, links, and icon cache management.

- [ ] T178 [US3] Implement dashboardService: list, create, update, delete, getWithChildren in backend/src/services/dashboard.ts
- [ ] T179 [US3] Implement placeholderService: add, update, delete, batchUpdateLayout in backend/src/services/placeholder.ts
- [ ] T180 [US3] Implement widgetService: add, update, delete, reorder in backend/src/services/widget.ts
- [ ] T181 [US3] Implement linksService: add, update, delete, reorder in backend/src/services/links.ts
- [ ] T182 [US3] Implement iconCacheService: refresh, list, getByKey in backend/src/services/icon-cache.ts
- [ ] T183 [US3] Register dashboard admin routes (FR-041) in backend/src/api/admin-dashboards.ts
- [ ] T184 [US3] Register placeholder admin routes (FR-042) in backend/src/api/admin-placeholders.ts
- [ ] T185 [US3] Register widget admin routes (FR-043) in backend/src/api/admin-widgets.ts
- [ ] T186 [US3] Register links admin routes (FR-044) in backend/src/api/admin-links.ts
- [ ] T187 [US3] Register icon cache routes (FR-045) in backend/src/api/admin-icons.ts and backend/src/api/public-icons.ts
- [ ] T188 [US3] Implement dashboard read endpoint (any auth) GET /api/dashboards/:id in backend/src/api/dashboards.ts
- [ ] T189 [US3] Implement background image upload POST /api/admin/assets/background in backend/src/api/admin-assets.ts
- [ ] T190 [US3][P] Write dashboard CRUD tests in backend/tests/api/dashboard.test.ts
- [ ] T191 [US3][P] Write placeholder CRUD tests in backend/tests/api/placeholder.test.ts
- [ ] T192 [US3][P] Write widget CRUD tests in backend/tests/api/widget.test.ts
- [ ] T193 [US3][P] Write links CRUD tests in backend/tests/api/links.test.ts
- [ ] T194 [US3][P] Write icon cache tests in backend/tests/api/icon-cache.test.ts
- [ ] T195 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R4: Dashboard Grid — View Mode (US3, US4)

**Purpose**: Implement dashboard grid view using react-grid-layout with placeholder widgets and Links List widget.

- [ ] T196 [US3] Create TanStack Query hooks: useDashboards(), useDashboard(id) in frontend/src/hooks/useDashboard.ts
- [ ] T197 [US3] Create DashboardGrid component (ResponsiveGridLayout, read-only mode) in frontend/src/components/dashboard/DashboardGrid.tsx
- [ ] T198 [US3] Create PlaceholderWidget component (translucent, title pill, border color) in frontend/src/components/dashboard/PlaceholderWidget.tsx
- [ ] T199 [US3] Create WidgetRenderer component (type discriminator → component registry) in frontend/src/components/dashboard/WidgetRenderer.tsx
- [ ] T200 [US3] Create LinksListWidget (vertical + horizontal modes, icon display) in frontend/src/components/widgets/LinksListWidget.tsx
- [ ] T201 [US3] Implement responsive breakpoints: 1 col mobile, 2 col tablet, 4+ col desktop (FR-016a) in DashboardGrid.tsx
- [ ] T202 [US3] Implement dashboard background rendering (solid color / image with fill/stretch) in DashboardGrid.tsx
- [ ] T203 [US4] Create EmptyDashboardState component (FR-040) in frontend/src/components/dashboard/EmptyDashboardState.tsx
- [ ] T204 [US3] Create Dashboard page route and device context routing in frontend/src/pages/DashboardPage.tsx
- [ ] T205 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R5: Dashboard Grid — Edit Mode (US3)

**Purpose**: Implement dashboard grid editing: drag/drop/resize, placeholder/widget configuration, save/cancel flow.

- [ ] T206 [US3] Implement edit mode toggle (admin-only FAB with Save/Cancel) (FR-018a) in frontend/src/components/dashboard/EditModeToolbar.tsx
- [ ] T207 [US3] Enable drag/drop/resize in DashboardGrid when edit mode active (FR-019) in DashboardGrid.tsx
- [ ] T208 [US3] Add touch-friendly drag handles for mobile (FR-019b) in PlaceholderWidget.tsx
- [ ] T209 [US3] Create PlaceholderConfigDialog (title, border color, opacity) in frontend/src/components/dashboard/PlaceholderConfigDialog.tsx
- [ ] T210 [US3] Create WidgetConfigSheet (add/edit/remove links, icon picker, layout mode) in frontend/src/components/dashboard/WidgetConfigSheet.tsx
- [ ] T211 [US3] Create IconPicker component (cached icons, search/filter, fallback) in frontend/src/components/dashboard/IconPicker.tsx
- [ ] T212 [US3] Create BackgroundConfigDialog (color picker, image upload, display mode) in frontend/src/components/dashboard/BackgroundConfigDialog.tsx
- [ ] T213 [US3] Implement Save flow: batch layout update + individual CRUD mutations in frontend/src/hooks/useDashboardEdit.ts
- [ ] T214 [US3] Implement Cancel flow: discard local state and restore server state in useDashboardEdit.ts
- [ ] T215 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R6: Dashboard Management Page (US3)

**Purpose**: Implement admin-only dashboard management page with CRUD operations.

- [ ] T216 [US3] Create DashboardManagement page route in frontend/src/pages/DashboardManagementPage.tsx
- [ ] T217 [US3] Implement dashboard list with Card components in DashboardManagementPage.tsx
- [ ] T218 [US3] Create CreateDashboardDialog (name, device applicability) in frontend/src/components/dashboard/CreateDashboardDialog.tsx
- [ ] T219 [US3] Implement rename dashboard (inline edit) in DashboardManagementPage.tsx
- [ ] T220 [US3] Implement delete dashboard (confirm dialog) in DashboardManagementPage.tsx
- [ ] T221 [US3] Add device applicability selector (web/mobile/both) in CreateDashboardDialog.tsx
- [ ] T222 [US3] Add navigation from Settings default dashboard selectors to dashboard management
- [ ] T223 Run pnpm lint, typecheck, test from root and verify all pass

## Phase R7: Polish, Accessibility & Testing (Cross-Cutting)

**Purpose**: Final polish, accessibility audit, mobile optimization, and comprehensive testing.

- [ ] T224 Add page transition animations (subtle fade/slide) across frontend/src/pages/
- [ ] T225 Add edit mode enter/exit animations in DashboardGrid.tsx
- [ ] T226 Add widget add/remove animations in PlaceholderWidget.tsx
- [ ] T227 Accessibility audit: keyboard navigation for all shadcn/ui components
- [ ] T228 Accessibility audit: ARIA labels on edit controls, grid items, dialogs
- [ ] T229 Accessibility audit: focus management in dialogs/sheets (FR-034, NFR-004)
- [ ] T230 Mobile optimization: verify all touch targets >= 44px (NFR-014)
- [ ] T231 Mobile optimization: test bottom sheet patterns for config dialogs on mobile
- [ ] T232 [P] Write unit tests for DashboardGrid, PlaceholderWidget, WidgetRenderer in frontend/src/components/__tests__/
- [ ] T233 [P] Write unit tests for LinksListWidget in frontend/src/components/__tests__/
- [ ] T234 [P] Write E2E test: create dashboard → add placeholder → add links widget → view dashboard in frontend/tests/e2e/
- [ ] T235 [P] Write E2E test: edit mode → drag/resize → save in frontend/tests/e2e/
- [ ] T236 [P] Write E2E test: mobile responsive rendering (single column) in frontend/tests/e2e/
- [ ] T237 [P] Write E2E test: icon fallback behavior in frontend/tests/e2e/
- [ ] T238 Update specs/001-homelab-dashboard/quickstart.md with new frontend deps and shadcn/ui setup
- [ ] T239 Update specs/001-homelab-dashboard/contracts/openapi.yaml with new CRUD endpoints
- [ ] T240 Run pnpm lint, typecheck, test from root and verify ALL pass (final gate)
