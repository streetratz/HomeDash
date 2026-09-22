# Feature Specification: Customizable Home Lab Dashboard

**Feature Branch**: `001-homelab-dashboard`  
**Created**: 2026-02-21  
**Revised**: 2026-04-24  
**Status**: Active  
**Input**: User description: "Modern mobile-friendly smart home hub dashboard with first-run admin creation, configurable header/footer, theme switcher, optional multi-timezone clock strip, editable grid dashboards (web/mobile variants), placeholder widgets, and initial Links List app widget with icons sourced from selfh.st icons library."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Run + View Dashboard (Priority: P1)

As a first-time user on my LAN, I want to create the initial admin account and immediately see a modern, polished dashboard layout (even if initially blank) so the app can be set up and used without external dependencies.

**Why this priority**: Without a first-run flow and a default dashboard, nothing else can be configured or validated.

**Independent Test**: In a fresh install with no existing users, complete admin creation and confirm that the main page renders with a modern shell (header/main/footer) and a dashboard area with proper mobile-first responsive design.

**Acceptance Scenarios**:

1. **Given** the app has no users configured, **When** I open the app, **Then** I am prompted to create the first user and told it will be an administrator. The form MUST use modern UI components (shadcn/ui Card, Input, Button) with proper mobile layout.
2. **Given** I create the first user successfully, **When** I return to the main page, **Then** I see the dashboard page layout (header, main content, footer) and I am authenticated.
2a. **Given** the first-run form submission succeeds, **When** the frontend handles the response, **Then** the bootstrap query cache MUST be fully evicted (not merely marked stale) before navigation to `/` occurs, so subsequent reads reflect the updated server state.
3. **Given** I am unauthenticated (logged out), **When** I open the main page, **Then**:
	- if an administrator has explicitly selected a public default dashboard for my device context, I see that dashboard, OR
	- if no public default is selected, I see the shell (header/main/footer) and a safe empty state indicating no public dashboard is configured.
4. **Given** I am authenticated, **When** I open the main page, **Then** the dashboard shown matches my configured dashboard preference for the detected device context (web or mobile).

---

### User Story 2 - Customize Shell (Header/Footer/Theme/Clocks) (Priority: P2)

As an administrator, I want to customize the page shell (logo, title, and optional timezones), and as any authenticated user I want to set my theme mode, so the dashboard is readable and consistent across devices.

**Why this priority**: The shell is always visible and sets the baseline experience; it enables quick personalization without needing dashboard editing.

**Independent Test**: As an administrator, update global shell settings and observe changes immediately (logo/title/clocks/header height/footer message/link). As an authenticated user, toggle theme mode and confirm it persists. All settings controls MUST use modern UI components.

**Acceptance Scenarios**:

1. **Given** I am on the main page, **When** I toggle light/dark mode, **Then** the UI switches theme and my selection persists for my next visit.
1a. **Given** the theme mode is set to **light**, **When** the page renders, **Then** the shell, header, clock strip, footer, and dashboard area MUST display light-mode colours (not dark-mode colours).
1b. **Given** the theme is set before the React application mounts (e.g., on a hard reload), **When** the browser parses `index.html`, **Then** the correct `dark` class MUST already be present on `<html>` to prevent a flash of incorrect content on initial load (FOUC prevention).
1c. **Given** the theme mode is set to **light**, **When** the clock strip and user menu render, **Then** all text, icons, and backgrounds within those components MUST have sufficient contrast against the light-mode container backgrounds (no dark-only hardcoded colours).
2. **Given** I am authenticated, **When** I click my user icon/name in the header, **Then** I see a dropdown menu (shadcn/ui DropdownMenu) that includes links for Settings and Logout.
3. **Given** I am an administrator, **When** I upload a logo image, **Then** the header shows the new logo and the browser tab favicon matches it.
4. **Given** I am an administrator and timezone clocks are enabled, **When** I configure a home timezone and up to 5 additional timezones, **Then** the header shows all configured clocks and visually identifies the home timezone.
5. **Given** I am an administrator, **When** I set a header height and title styling settings, **Then** the header remains fixed at the top and uses the configured height and title styling.
6. **Given** I am an administrator, **When** I set footer text and a repository link, **Then** the footer appears after the content (not sticky) and shows the message centered with the link.
7. **Given** the application starts for the first time (no prior seed data), **When** the server has completed startup, **Then** the `app_shell_settings` singleton row MUST exist and shell settings endpoints MUST respond successfully without requiring any manual intervention.
8. **Given** I am an administrator on the settings page, **When** I view the settings, **Then** the page MUST use a sidebar navigation (desktop) or tab bar (mobile) with organized sections using Card containers, and all form controls MUST use shadcn/ui components (Switch, Select, Input, Sheet/Dialog).

---

### User Story 3 - Manage & Edit Dashboards + Widgets (Priority: P3)

As an administrator, I want to create/manage dashboards and edit a dashboard grid with placeholder widgets (drag, drop, resize) so I can build a smart home hub layout for my home lab.

**Why this priority**: Dashboard editing is the differentiator; however, it can be built after first-run + shell customization.

**Independent Test**: As an administrator, create a dashboard, set it as web/mobile/both, enter edit mode, add/resize/move placeholders, configure background, then exit edit mode and confirm layout persists. The dashboard MUST render as a modern smart-home-hub-style grid with translucent widget cards.

**Acceptance Scenarios**:

1. **Given** I am an administrator, **When** I navigate to dashboard management, **Then** I can create, rename, and delete dashboards using modern UI (Card list, Dialog for create/edit, confirm dialog for delete).
2. **Given** I am an administrator and I create or update a dashboard, **When** I choose its device applicability (web only, mobile only, or both), **Then** it is available only in the appropriate contexts.
3. **Given** I am an administrator viewing a dashboard, **When** I click an Edit button (FAB or toolbar), **Then** editing is enabled with a visual indicator and I can drag, drop, and resize placeholder widgets aligned to the grid. On mobile, drag handles MUST be touch-friendly.
4. **Given** I am an administrator and I configure a dashboard background (solid color or image plus display mode), **When** I view the dashboard, **Then** the background renders according to the selected mode.
5. **Given** I am an administrator and I add a Links List app widget into a placeholder widget, **When** I view the dashboard, **Then** the placeholder renders the widget content and link icons display.
6. **Given** I am in edit mode, **When** I click Save, **Then** all layout changes (positions, sizes) are persisted via the API. **When** I click Cancel, **Then** all changes are discarded and the previous layout is restored.
7. **Given** I am viewing a dashboard on a mobile device (< 768px), **When** the grid renders, **Then** it MUST use a single-column layout with appropriately stacked widgets.

_Note: Dashboard management and editing are administrator capabilities because dashboards are shared/global._

---

### User Story 4 - Modern UI Foundation (Priority: P0 — Cross-Cutting)

As a user, I want the entire application to have a modern, polished, mobile-first interface with consistent design language so it feels like a professional smart home hub, not a prototype.

**Why this priority**: P0 because it affects every other user story. The UI component library and design system MUST be established before any page-level work.

**Independent Test**: All pages (login, first-run, settings, dashboard) render with consistent shadcn/ui components, proper dark/light theme support via CSS custom properties, and responsive layouts from 360px to desktop widths.

**Acceptance Scenarios**:

1. **Given** the app is loaded on any page, **When** I inspect the visual design, **Then** all interactive elements (buttons, inputs, toggles, dropdowns, dialogs) MUST use shadcn/ui components with consistent styling.
2. **Given** the app is loaded in dark mode, **When** I switch to light mode, **Then** all components MUST update via HSL-based CSS custom properties — no Tailwind hardcoded colors without `dark:` counterparts.
3. **Given** I am on a mobile device (360px width), **When** I use any page, **Then** all content is accessible without horizontal scrolling, touch targets are ≥44px, and navigation is intuitive.
4. **Given** an action completes (save, delete, error), **When** feedback is shown, **Then** it MUST use toast notifications (Sonner) rather than inline alerts or browser alerts.
5. **Given** I am using keyboard navigation, **When** I tab through interactive elements, **Then** focus states MUST be clearly visible and all dialogs/sheets are keyboard-dismissible (Escape key).

---

### Edge Cases

- First-run interrupted (browser refresh) before admin creation completes.
- Unauthenticated user attempts to access settings or dashboard management.
- Uploaded image is too large or is an unsupported file type.
- More than 5 additional timezones are configured.
- Device type (web vs mobile) changes after login; user has only one dashboard configured.
- Device detection is ambiguous/unknown; system falls back safely.
- User agent spoofing; system behavior remains safe and predictable.
- Background image missing/unavailable; system falls back gracefully.
- External icon lookup fails; system shows a safe fallback icon.
- No cached icon available; system shows a safe fallback icon.
- Link URL is invalid or unsafe scheme; system rejects or sanitizes.
- First-run form submission succeeds but frontend navigates before cache is evicted; system MUST evict bootstrap cache entries before transitioning to `/` to avoid a re-redirect loop back to `/first-run`.
- Mobile edit mode: touch drag/drop conflicts with page scroll; MUST use explicit drag handles.
- Dashboard with many widgets (20+): grid rendering MUST not block the main thread for > 100ms.
- Icon picker with large catalog (500+ icons): MUST use virtualized list or search filtering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (First Run)**: When no users exist, the system MUST present a first-run flow to create the initial user and assign that user administrator privileges.
- **FR-001a (Persistence Store)**: The system MUST persist user management, dashboard management, and user preference data in a local SQLite database.
- **FR-001b (Startup Initialization Sequence)**: The server MUST execute the following startup steps in order before accepting any HTTP traffic: (1) run all pending database migrations, (2) run the seed function to initialize required singleton database rows (e.g., `app_shell_settings`), (3) begin listening on the configured host/port. Omitting any step MUST be treated as a fatal startup error.
- **FR-001c (Shell Settings Singleton)**: The `app_shell_settings` table MUST always contain exactly one row. The seed step (FR-001b) MUST create this row if it does not already exist. Shell settings API endpoints MUST return a 500 error with a diagnostic message if the row is absent, rather than returning misleading empty responses.
- **FR-002 (Auth States)**: The system MUST support authenticated and unauthenticated browsing modes.
- **FR-003 (Default Dashboards)**: The system MUST allow an administrator to explicitly select default dashboards for unauthenticated users for web and mobile contexts. Defaults MUST be unset until selected, and the public (unauthenticated) experience MUST render only the explicitly selected defaults.
- **FR-004 (User Dashboards)**: The system MUST allow authenticated users to select which dashboard is used for web and which is used for mobile (or one dashboard for both).
- **FR-004a (Device Context Detection)**: The system MUST determine whether to show the web or mobile dashboard based on device detection (user agent), not viewport width.

- **FR-005 (Page Shell Layout)**: The main page MUST be divided into a header, a main content area, and a footer.
- **FR-006 (Header Static)**: The header MUST remain static at the top of the page while content scrolls.
- **FR-007 (Header Logo/Favicon)**: The header MUST support a user-uploaded logo image shown on the left, and the favicon MUST match the configured logo.
- **FR-007a (Favicon Generation)**: When the logo is updated, the system MUST update favicon assets served from the app origin (at minimum `/favicon.ico`), using locally generated assets (no external fetch). Updates MUST be visible after a normal reload.
- **FR-008 (Header Title)**: The header MUST display a configurable title, and settings MUST allow configuring the title’s font selection and font size.
- **FR-008a (Title Font Options)**: Title font selection MUST be limited to a predefined offline-safe set (no remote font loading). Supported values: `system-sans`, `system-serif`, `monospace`.
- **FR-009 (Theme Switch)**: The header MUST provide a theme mode switch (light/dark) and persist the user's selection.
- **FR-009a (Theme-Aware Components)**: All UI chrome components (header, clock strip, user menu dropdown, footer) MUST provide both light-mode and dark-mode colour tokens using Tailwind `dark:` variants. Hardcoding colours for a single theme without a counterpart is not acceptable.
- **FR-009b (Design System Tokens)**: The frontend MUST use HSL-based CSS custom properties for all theme colors (background, foreground, primary, secondary, muted, accent, destructive, border, ring). The `dark` class on `<html>` MUST switch the custom property values. No component may use hardcoded Tailwind color classes (e.g., `bg-gray-900`) without a `dark:` counterpart.
- **FR-010 (User Menu)**: The header MUST show either a login control (if unauthenticated) or user identity (icon + name). When authenticated, selecting the user identity MUST open a dropdown menu (shadcn/ui DropdownMenu) with at least Logout and Settings.
- **FR-010a (Settings Authorization)**: The Settings area MUST expose only user-level preferences to standard users, and MUST restrict administrative settings (e.g., shell settings and dashboard management) to administrators.
- **FR-011 (Optional Clock Strip)**: The header MUST support an optional, enable/disable clock strip containing a home timezone clock plus up to 5 additional timezone clocks. The clock strip horizontal alignment (left, center, right) MUST be configurable per installation.
- **FR-011a (Clock Strip Toggle)**: The enable/disable control for the clock strip in Settings MUST be rendered as an accessible toggle button (shadcn/ui Switch with ARIA `role="switch"`), not a plain checkbox.
- **FR-011b (Timezone Selection UI)**: Timezone selection for the home clock and each extra clock MUST be via a searchable combobox (native `<input list>` backed by a `<datalist>`) populated from the browser's IANA timezone database (`Intl.supportedValuesOf('timeZone')`). Free-text input without suggestions is not acceptable.
- **FR-012 (Home Timezone Indicator)**: The home timezone clock MUST be visually identified with a home icon (Font Awesome Free `faHouse`), and additional clocks MUST support a short configurable label (e.g., UTC, PST). Clocks MUST NOT display seconds - only hours and minutes (HH:MM). Each clock MUST display a day/night indicator: a sun icon (Font Awesome Free `faSun`) for local hours 06:00-17:59 and a moon icon (`faMoon`) for 18:00-05:59.
- **FR-012a (Clock Icon Library)**: Clock strip icons (home, sun, moon) MUST be rendered using Font Awesome Free (`@fortawesome/react-fontawesome` + `@fortawesome/free-solid-svg-icons`) bundled with the app. No external CDN icon loading is permitted.
- **FR-013 (Header Height)**: The header height MUST be configurable via settings.

- **FR-014 (Footer Content)**: The footer MUST support a configurable centered message and a link to the project repository.
- **FR-015 (Footer Behavior)**: The footer MUST appear at the end of the page content and MUST NOT be sticky.

- **FR-016 (Dashboard Grid)**: A dashboard MUST be an editable grid that can contain multiple placeholder widgets.
- **FR-016a (Dashboard Grid Responsive)**: The dashboard grid MUST use responsive breakpoints: single-column on mobile (< 768px), 2 columns on tablet, 4+ columns on desktop. The `react-grid-layout` `ResponsiveGridLayout` component MUST be used.
- **FR-017 (Dashboard Background)**: A dashboard MUST support a solid-color background or an image background with a configurable display mode (fill or stretched).
- **FR-018 (Edit Mode Toggle)**: Dashboards MUST NOT be editable by default; administrators MUST be able to enable an edit mode via an Edit control on the dashboard view.
- **FR-018a (Edit Mode UX)**: Edit mode MUST show a floating toolbar or FAB with Save and Cancel actions. A visual indicator (e.g., colored border, toolbar) MUST distinguish edit mode from view mode. Layout changes MUST be held in local state until Save is pressed.
- **FR-019 (Drag/Drop/Resize)**: In edit mode, administrators MUST be able to drag, drop, and resize placeholder widgets within the grid.
- **FR-019a (Edit Authorization)**: Only administrators can edit dashboards (including adding/moving/resizing placeholders and modifying background and hosted app widgets).
- **FR-019b (Touch Drag Handles)**: On touch devices, placeholder widgets in edit mode MUST provide explicit drag handle areas to avoid conflicts with page scroll.

- **FR-020 (Dashboard Management)**: The system MUST provide an administrator-only dashboard management page that supports creating, renaming, deleting shared dashboards, and selecting whether a dashboard is web only, mobile only, or both.

- **FR-021 (Placeholder Shapes)**: Placeholder widgets MUST align to the grid and support multiple shapes/sizes including square, tall rectangle, and wide rectangle.
- **FR-022 (Placeholder Identity)**: Each placeholder widget MUST have a stable ID.
- **FR-023 (Placeholder Styling)**: Each placeholder widget MUST have a rounded border and a configurable border color.
- **FR-024 (Placeholder Title Pill)**: Each placeholder widget MUST display a configurable title in a pill near the top-left; the pill color MUST match the border color.
- **FR-025 (Placeholder Transparency)**: Placeholder widgets MUST be translucent so the dashboard background remains visible (target opacity ~30%).
- **FR-026 (Widget Container)**: A placeholder widget MUST be able to host one or more app widgets.
- **FR-026a (Widget Ordering)**: When a placeholder hosts multiple app widgets, the system MUST preserve their configured order.

- **FR-027 (App Widget Types)**: The system MUST support multiple app widget types; the initial release MUST include the Links List widget.

- **FR-028 (Links List Content)**: A Links List widget MUST render one or more hyperlinks; each link MUST include a title, a URL, and an icon.
- **FR-029 (Links List Icons)**: The system MUST support automatically selecting an icon based on the link URL and MUST allow manual icon selection from the same icon set.
- **FR-029a (Icon Fetch + Cache)**: The system SHOULD support fetching icons from the selfh.st icon library via an administrator-controlled action (e.g., manual refresh) and caching them locally; when offline or fetch fails, the system MUST use cached icons or a safe built-in fallback.
- **FR-030 (Links List Layouts)**: The Links List widget MUST support vertical and horizontal display modes.
- **FR-031 (Links List Title Length)**: Link titles MUST be limited to a maximum of 15 characters.
- **FR-032 (Links List Vertical Mode)**: In vertical mode, the title MUST appear to the right of the icon and the icon display MUST support a small size or be disabled.
- **FR-033 (Links List Horizontal Mode)**: In horizontal mode, the title MUST be displayed below the icon or be optionally hidden, and icons MUST support a larger size appropriate for that layout.

- **FR-034 (UI Component Library)**: The frontend MUST use shadcn/ui (Radix UI primitives + Tailwind CSS) as the component library. All interactive elements (Button, Input, Select, Dialog, Sheet, Switch, DropdownMenu, Card, Tooltip, Skeleton) MUST be sourced from shadcn/ui.
- **FR-034a (Component Utility)**: The frontend MUST provide a `cn()` utility function combining `clsx` and `tailwind-merge` for conditional class composition.
- **FR-035 (General Icons)**: All UI icons except clock strip icons MUST use Lucide React. Clock strip icons remain Font Awesome Free per FR-012a.
- **FR-036 (Toast Notifications)**: All user feedback for actions (save success, errors, deletions) MUST use Sonner toast notifications. Browser `alert()`/`confirm()` MUST NOT be used.
- **FR-037 (Loading States)**: All data-fetching views MUST show Skeleton loading components during load. Empty white screens or spinners-only are not acceptable.
- **FR-038 (Settings Page Layout)**: The settings page MUST use sidebar navigation on desktop (>= 768px) and a tab bar on mobile (< 768px). Each settings section MUST be wrapped in a shadcn/ui Card.
- **FR-039 (Responsive Navigation)**: On mobile (< 768px), the header MUST provide a hamburger menu (shadcn/ui Sheet) for navigation instead of inline nav links.
- **FR-040 (Empty Dashboard State)**: When no dashboards exist, the dashboard page MUST show a friendly empty state with an illustration or icon and a "Create your first dashboard" CTA for administrators, or "No dashboard configured" for non-admin/unauthenticated users.

- **FR-041 (Dashboard CRUD API)**: The backend MUST provide REST endpoints for dashboard CRUD: `GET /api/admin/dashboards` (list), `POST /api/admin/dashboards` (create), `PUT /api/admin/dashboards/:id` (update), `DELETE /api/admin/dashboards/:id` (delete), `GET /api/dashboards/:id` (read with placeholders + widgets, any authenticated user).
- **FR-042 (Placeholder CRUD API)**: The backend MUST provide: `POST /api/admin/dashboards/:id/placeholders` (add), `PUT /api/admin/placeholders/:id` (update), `DELETE /api/admin/placeholders/:id` (remove), `PUT /api/admin/dashboards/:id/layout` (batch update all positions).
- **FR-043 (Widget Instance CRUD API)**: The backend MUST provide: `POST /api/admin/placeholders/:id/widgets` (add widget), `PUT /api/admin/widgets/:id` (update config), `DELETE /api/admin/widgets/:id` (remove), `PUT /api/admin/placeholders/:id/widgets/order` (reorder).
- **FR-044 (Links List Item CRUD API)**: The backend MUST provide: `POST /api/admin/widgets/:id/links` (add link), `PUT /api/admin/links/:id` (update), `DELETE /api/admin/links/:id` (remove), `PUT /api/admin/widgets/:id/links/order` (reorder).
- **FR-045 (Icon Cache API)**: The backend MUST provide: `POST /api/admin/icons/refresh` (fetch from selfh.st), `GET /api/icons` (list cached icons), `GET /api/icons/:key` (get icon data).
### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security Baseline)**: All settings, edit functions, and management pages MUST require authentication, and authorization MUST be least-privilege.
- **NFR-001a (Admin Scope)**: Only administrators can modify global shell settings and manage/edit shared dashboards.
- **NFR-002 (Unauthenticated Safety)**: Unauthenticated mode MUST be read-only and MUST NOT expose settings, editing, or management capabilities.
- **NFR-003 (LAN-Only Runtime)**: Core functionality MUST work without internet connectivity; external resources (e.g., icon sources) MUST have safe fallbacks.
- **NFR-003a (Best-Effort External Fetch)**: Any external icon fetching MUST be best-effort, MUST NOT block primary navigation, and MUST NOT be required for correct rendering.
- **NFR-004 (Accessibility)**: Primary flows (login, settings, dashboard edit toggles) MUST be usable by keyboard and assistive technologies.
- **NFR-005 (Responsive UX)**: The app MUST remain usable on common mobile widths and desktop layouts.
- **NFR-006 (Performance)**: On a typical home LAN, common actions (theme toggle, navigation between dashboard/management/settings, edit toggle) MUST visibly update within 1 second in normal operation.
- **NFR-007 (Operability)**: The system MUST provide diagnostic logging and user-facing error messages sufficient to troubleshoot in a NAS/container environment.
- **NFR-008 (Privacy)**: The system MUST NOT enable telemetry or external callbacks by default.
- **NFR-008a (Icon Refresh Control)**: If the system supports external icon fetching, it MUST be an administrator-controlled behavior (e.g., manual refresh) and MUST NOT constitute telemetry.
- **NFR-009 (TypeScript Build Integrity — Backend)**: The backend TypeScript configuration MUST set `"module": "CommonJS"`. Top-level `await` is not permitted in backend source files; server startup MUST use an async IIFE wrapper. The `typecheck` npm script MUST type-check both `src/` and `tests/` directories (e.g., by running a second `tsc --project tsconfig.test.json --noEmit`); silently excluding `tests/` via `"rootDir": "src"` is not acceptable.
- **NFR-010 (TypeScript Strict Optional Properties — API Client)**: The frontend TypeScript configuration enables `exactOptionalPropertyTypes: true`. API client code that constructs `fetch()` option objects MUST conditionally spread optional fields (e.g., `body`) rather than assigning `undefined` to properties, as `undefined` is not assignable to `BodyInit | null` under this flag.
- **NFR-011 (Frontend Cache Lifecycle — Post-Mutation Navigation)**: After any mutation that changes the result of a cacheable bootstrap or authentication query (e.g., first-run admin creation, login, logout), the frontend MUST fully evict those cache entries (e.g., via `removeQueries`) before navigating to a route that reads them. Marking entries stale (`invalidateQueries`) is insufficient because stale entries are served synchronously until a background refetch completes, which can cause redirect loops.
- **NFR-012 (Drizzle-kit CLI Version Constraints)**: The project MUST use drizzle-kit `v0.21+`. The migration generation command is `drizzle-kit generate` (the deprecated `generate:sqlite` subcommand MUST NOT be used). The Drizzle config MUST specify `dialect: 'sqlite'` (the deprecated `driver: 'better-sqlite'` key MUST NOT be used).
- **NFR-013 (Vitest Zero-Test Safety)**: The Vitest configuration MUST set `passWithNoTests: true`. This prevents the test runner from exiting with code 1 during scaffolding phases when test files have not yet been created.
- **NFR-014 (Touch Target Size)**: All interactive elements on mobile viewports MUST have a minimum touch target of 44×44px per WCAG 2.5.5.
- **NFR-015 (Dashboard Render Performance)**: A dashboard with 20 placeholder widgets MUST render (first contentful paint) within 200ms on a mid-range device. Grid layout calculations MUST NOT block the main thread for > 100ms.
- **NFR-016 (Icon Picker Performance)**: The icon picker MUST handle 500+ icons without janky scrolling; virtualized list or search filtering MUST be used when the catalog exceeds 100 items.

### Assumptions & Dependencies

- The first release focuses on first-run admin setup, dashboard customization/editing, and the Links List widget; user self-registration and advanced role management are out of scope.
- SQLite is available as the local persistence store for users, dashboards, and preferences.
- Default dashboards for unauthenticated users are configured by an administrator.
- When external icon sources are unavailable, the UI falls back to a safe built-in icon without breaking navigation.
- If enabled by an administrator, the app may fetch icons from the selfh.st icon library and cache them locally; offline behavior uses cache or safe fallback.
- Clock strip icons are provided by Font Awesome Free (`@fortawesome/react-fontawesome` + `@fortawesome/free-solid-svg-icons`), which is open-source (MIT/CC-BY-4.0), bundled at build time, and requires no external CDN at runtime.
- The database schema contains singleton tables (e.g., `app_shell_settings`) that must have exactly one row at all times. These are initialized by the seed step and are never deleted.
- The frontend uses TanStack Query for server state. Cache management for authentication transitions (login, logout, first-run) relies on full cache eviction (`removeQueries`), not just invalidation, to guarantee correct navigation.
- Tailwind CSS is configured with `darkMode: 'class'` and all theme-sensitive components use `dark:` utility class pairs.
- shadcn/ui is used as the component library (Radix UI primitives + Tailwind). Components are installed via the shadcn CLI and live in `frontend/src/components/ui/`.
- Lucide React is used for all general-purpose icons. FontAwesome Free is used only for clock strip icons (FR-012a).
- Sonner is used for toast notifications via the shadcn/ui `<Toaster>` integration.
- `class-variance-authority`, `clsx`, and `tailwind-merge` are required utilities for shadcn/ui component styling.

### Key Entities *(include if feature involves data)*

- **User**: A person who can authenticate; has a display name and role (administrator or standard).
- **Session**: The authenticated browsing context for a user.
- **App Shell Settings**: Global settings for logo/title styling, header height, timezone clocks, and footer message/link; editable by administrators. A single singleton row MUST exist at all times; initialized by the server seed step on startup.
- **User Preferences**: Per-user settings for theme mode and dashboard preference mapping.
- **Dashboard**: A named shared/global dashboard definition, managed by administrators, associated to a device applicability (web, mobile, or both).
- **Dashboard Preference**: The mapping from a user (or unauthenticated defaults) to which dashboard is shown for web and for mobile.
- **Dashboard Background**: Background configuration (solid color or image + display mode).
- **Placeholder Widget**: A grid-aligned container with ID, shape/size, translucent styling, title pill, and a list of hosted app widgets.
- **App Widget**: A widget instance hosted in a placeholder; includes a type discriminator and type-specific configuration.
- **Link Item**: A single link entry for the Links List widget (title, URL, icon reference).
- **Uploaded Asset**: A stored image selected by a user (e.g., logo, background).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (First Run Completion)**: A new installation allows creation of the first admin user in under 3 minutes without requiring external services.
- **SC-002 (Unauthenticated View)**: Unauthenticated users can load the default dashboard and see header/main/footer with no access to editing or settings.
- **SC-003 (Customization Persisted)**: Theme mode persists across reloads for the same user; global shell settings persist across reloads for all users.
- **SC-004 (Dashboard Editing Works)**: An administrator can create a dashboard, enter edit mode, add/move/resize at least 6 placeholders, and see the layout persist on reload.
- **SC-005 (Mobile Usability)**: The dashboard is usable on a phone-sized viewport (360px) without horizontal scrolling for primary controls. Touch targets meet 44px minimum.
- **SC-006 (Safety Controls)**: Attempts to access settings/editing/management while unauthenticated are denied.
- **SC-007 (Links Widget Value)**: A user can configure a Links List widget with at least 10 links and successfully navigate to each link.
- **SC-008 (Shell Settings Immediately Available)**: On any fresh install, `GET /api/admin/shell` MUST return HTTP 200 with valid default shell settings immediately after the server completes startup — no additional manual steps or API calls should be needed.
- **SC-009 (Theme Toggle Produces Visible Change)**: After switching from dark to light mode (or vice versa), the background colour of the shell, header, and main content area MUST visibly change; the page MUST NOT require a reload.
- **SC-010 (No First-Run Loop)**: After completing the first-run admin creation form, the browser MUST navigate to the dashboard and NOT redirect back to `/first-run`.
- **SC-011 (Consistent Component Library)**: All pages (login, first-run, settings, dashboard) use shadcn/ui components exclusively for interactive elements — no raw HTML `<button>`, `<input>`, or `<select>` elements.
- **SC-012 (Toast Feedback)**: All CRUD operations provide toast feedback (success or error) within 500ms of API response. No browser alerts or confirms are used anywhere.
- **SC-013 (Responsive Grid)**: Dashboard grid renders single-column on mobile (< 768px), multi-column on desktop, with no layout overflow or overlap.

## Clarifications

### Session 2026-02-21

- Q: How should dashboards be scoped with respect to users? → A: Dashboards are global/shared; there are no private dashboards. Any admin can manage dashboards, and unauthenticated users only see the selected default dashboards.
- Q: Who can change header/footer/logo/title/clocks, and are those settings global or per-user? → A: Global shell settings are shared and editable by admins only; per-user preferences are limited to theme mode and dashboard selection.
- Q: How many app widgets can a single placeholder widget host? → A: Multiple app widgets per placeholder widget.
- Q: How should the app decide whether to show the “web” dashboard or the “mobile” dashboard? → A: Determine context via device detection (user agent), not viewport width.
- Q: How should the app use the selfh.st icons library while still working fully offline? → A: Fetch icons from selfh.st at runtime and cache locally; if offline, use cached or fallback.
- Q: Where should user management, dashboard management, and preferences be stored? → A: In a SQLite database.

### Session 2026-02-22

- Q: What is the required startup order for the backend server? → A: Migrations MUST run before seed; seed MUST run before the HTTP listener starts. All three steps are required on every cold start.
- Q: What is the correct way to handle the `app_shell_settings` row if the seed runs more than once (e.g., container restart)? → A: The seed function MUST be idempotent — it should `INSERT OR IGNORE` / check for existence and skip if the singleton already exists.
- Q: Should the frontend use `invalidateQueries` or `removeQueries` after first-run / login / logout? → A: `removeQueries` (full eviction). `invalidateQueries` serves stale data synchronously during navigation, causing redirect loops on routes that gate on `firstRunRequired` or `isAuthenticated`.

### Session 2026-04-24

- Q: What style of dashboard is the user aiming for? → A: A modern, mobile-friendly smart home hub dashboard in the style of Homer / Homarr / Dashy — polished UI with card-based widgets, translucent placeholders, and a professional aesthetic.
- Q: Should the frontend component library change? → A: Yes. Adopt shadcn/ui (Radix UI + Tailwind CSS) for all interactive components. This provides accessible, dark-mode-ready components out of the box.
- Q: What icon library for general UI? → A: Lucide React for all general icons. FontAwesome Free remains only for clock strip icons per FR-012a.
- Q: What about toast/notification feedback? → A: Use Sonner (shadcn/ui compatible). Replace all inline error messages and browser alerts with toast notifications.
- Q: Should pages be redesigned or just restyled? → A: Full redesign of all existing pages (login, first-run, settings, shell layout) to use shadcn/ui components with modern layouts, plus building all missing Phase 5 dashboard features.
- Q: Is the user open to switching frontend libraries entirely (e.g., to Svelte, Next.js)? → A: No. Keep React + Vite + TanStack Query + Tailwind. Add shadcn/ui on top.
- Q: What mobile navigation pattern? → A: Hamburger menu using shadcn/ui Sheet (slide-out drawer). Bottom sheets for configuration dialogs on mobile.
- Q: Is dark mode class-based or media-query-based? → A: Class-based (`darkMode: 'class'` in Tailwind config). All components MUST use `dark:` utility pairs. A FOUC-prevention inline script in `index.html` MUST apply the `dark` class before React mounts.