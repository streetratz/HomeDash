# Research — App Shortcuts Widget

**Feature**: 013-app-shortcuts | **Date**: 2025-07-14

## Table of Contents

- [R1: Data Storage Strategy](#r1-data-storage-strategy)
- [R2: Favicon Fetching Approach](#r2-favicon-fetching-approach)
- [R3: Icon Upload & Storage](#r3-icon-upload--storage)
- [R4: Status Ping Architecture](#r4-status-ping-architecture)
- [R5: Grouping & Ordering Model](#r5-grouping--ordering-model)
- [R6: Frontend Widget Integration](#r6-frontend-widget-integration)
- [R7: Responsive Grid Layout](#r7-responsive-grid-layout)

---

## R1: Data Storage Strategy

**Question**: Should shortcut data live entirely in `configJson` (like clock/weather) or in dedicated DB tables (like `linksListItems`)?

**Decision**: Dedicated DB tables (`app_shortcuts` and `shortcut_groups`), with only widget-level config (column count) in `configJson`.

**Rationale**:
- The existing `linksListItems` table establishes precedent for storing per-item data in dedicated tables with FK to `appWidgetInstances`.
- Dedicated tables enable: indexed queries, FK references to `uploadedAssets` for icons, efficient single-item CRUD without JSON rewriting, and future cross-widget features.
- `configJson` stores only widget-level presentation preferences (e.g., `{ "columns": 4 }`), keeping it small and consistent with how other widgets use it.

**Alternatives considered**:
- **Pure configJson**: Would work for small numbers of shortcuts but degrades with 50+ items — entire JSON blob must be read/written for any change. No FK integrity for icon assets. No efficient querying.
- **Hybrid (groups in configJson, items in table)**: Adds unnecessary complexity for minimal benefit. Groups are lightweight enough for a dedicated table.

---

## R2: Favicon Fetching Approach

**Question**: How should the server fetch favicons from target URLs?

**Decision**: New `faviconFetchService.ts` that performs a server-side GET to the target URL, parses HTML for `<link rel="icon">` tags, falls back to `/favicon.ico`, downloads the best icon, and stores it via the existing `uploadedAssets` system.

**Rationale**:
- Server-side fetching avoids CORS issues (NFR-001) and prevents leaking internal LAN URLs to the browser.
- The existing `uploadedAssets` table and `assetService.ts` upload pattern (magic-byte validation, atomic write, SHA-256) provides a proven storage mechanism.
- HTML parsing for `<link rel="icon">` covers modern apps; `/favicon.ico` fallback covers legacy apps.
- 5-second timeout per spec edge case; non-blocking (favicon fetch happens async after shortcut creation).

**Alternatives considered**:
- **Google Favicon API / external service**: Violates NFR-003 (privacy) and NFR-002 (LAN-only). Most homelab apps are on LAN anyway.
- **Client-side fetch via img tag**: CORS blocks most LAN services. Would expose internal URLs in browser network tab.
- **Reuse iconService.ts (selfh.st)**: Current icon service is designed for the selfh.st icon library, not arbitrary URL favicon extraction. Different enough to warrant a separate service, though both write to `uploadedAssets`.

**Implementation notes**:
- Use Node.js native `fetch()` with `AbortSignal.timeout(5000)`.
- Parse HTML with a lightweight regex or `cheerio` for `<link rel="icon">` / `<link rel="shortcut icon">`.
- Prefer largest icon available (parse `sizes` attribute).
- Store fetched favicon as `uploadedAssets` with kind `'shortcut_icon'`.
- Link via `iconAssetId` FK on `app_shortcuts` table.

---

## R3: Icon Upload & Storage

**Question**: How should custom icon uploads work alongside auto-fetched favicons?

**Decision**: Reuse the existing `@fastify/multipart` + `assetService.ts` pattern. Custom uploads stored in `$DATA_DIR/uploads/shortcut-icons/<uuid>.<ext>`. Override tracked via separate `iconOverrideAssetId` column.

**Rationale**:
- Existing upload flow handles multipart parsing, magic-byte MIME detection, atomic writes, and SHA-256 hashing — no need to reinvent.
- Separate `iconAssetId` (auto-fetched) and `iconOverrideAssetId` (user-uploaded) columns allow reverting to the auto-fetched icon if the user removes their custom upload.
- 512 KB limit per FR-019 (enforced at route level; existing plugin limit is 6 MB which is fine as a hard cap).
- Supported formats: PNG, JPEG, SVG, ICO, WebP per FR-019. ICO is new — needs magic-byte detection added (bytes `00 00 01 00`).

**Alternatives considered**:
- **Single iconAssetId column**: Loses the auto-fetched favicon when user uploads a custom one. No way to "revert to auto" without re-fetching.
- **Base64 in configJson**: Bloats the JSON, no deduplication, no FK integrity.
- **External CDN/S3**: Violates LAN-only principle (NFR-002/003).

---

## R4: Status Ping Architecture

**Question**: How should periodic health pings be implemented without blocking the UI?

**Decision**: New `shortcutPingService.ts` that reuses the existing `statusCheckService.executeChecks()` for actual HTTP checks. Ping results cached in a `shortcut_ping_results` table. Frontend polls via a dedicated endpoint on a 60-second interval using TanStack Query's `refetchInterval`.

**Rationale**:
- `statusCheckService.ts` already implements parallel HTTP checks with timeout, error handling, and the exact response model needed. Reuse avoids duplication.
- Server-side caching of ping results means multiple browser tabs / clients don't trigger redundant checks.
- 60-second default interval (per spec assumptions) is sensible for homelab monitoring.
- The server runs a scheduled check loop (setInterval); the frontend just reads cached results.
- NFR-006 requires all pings for a widget complete within 30s — `executeChecks()` already runs in parallel with per-check timeouts.

**Alternatives considered**:
- **Client-side polling per shortcut**: Would generate N×clients requests every 60s. CORS issues with LAN services.
- **WebSocket push**: Over-engineered for 60s refresh. Adds complexity (WS auth, reconnection). TanStack Query polling is simpler and already used in the project.
- **Cron job / worker thread**: `setInterval` is sufficient for single-process SQLite app. Worker threads would add complexity for minimal benefit.

**Implementation notes**:
- `shortcutPingService.runPingCycle(widgetInstanceId)`: queries shortcuts with `pingEnabled: true`, calls `executeChecks()`, upserts results into `shortcut_ping_results`.
- Global interval manager starts/stops cycles based on which widget instances have ping-enabled shortcuts.
- Treat any 2xx/3xx as "reachable" (FR-016) — override `expectedStatus` in `ServiceCheckInput` to accept range.
- Frontend: `GET /api/admin/app-shortcuts/:widgetId/ping-results` returns latest cached results.

---

## R5: Grouping & Ordering Model

**Question**: How should shortcut groups and ordering be modeled?

**Decision**: Dedicated `shortcut_groups` table with `widgetInstanceId` FK, `name`, and `orderIndex`. Shortcuts reference group via nullable `groupId` FK. Ordering is per-group via `orderIndex` on the shortcut.

**Rationale**:
- Groups are first-class entities (create, rename, reorder, delete per FR-011).
- Nullable `groupId` on shortcuts handles the "ungrouped" case (FR-013) — NULL groupId = default section.
- `orderIndex` INTEGER on both groups and shortcuts enables efficient reordering.
- Cascade delete on group removes group assignment but NOT the shortcuts (shortcuts become ungrouped).

**Alternatives considered**:
- **Groups in configJson, shortcuts in table**: Splits related data across two storage mechanisms. Group-shortcut FK integrity lost.
- **Tags/labels model**: Over-complex for the requirement (shortcut belongs to at most one group).
- **Flat ordering with group as string field**: Loses group ordering capability. Renaming requires updating all shortcuts.

---

## R6: Frontend Widget Integration

**Question**: How should the widget integrate with the existing registry and edit mode?

**Decision**: Register as `'app_shortcuts'` in `registry.tsx`. Display component (`AppShortcutsWidget`) fetches shortcut data from dedicated API (not from `widget.config`). Config form (`AppShortcutsConfigForm`) manages shortcuts, groups, and widget settings inline using the existing `PlaceholderConfigDialog` pattern.

**Rationale**:
- The registry pattern requires only: DisplayComponent, ConfigFormComponent, icon, defaultConfig, and type string — well-documented in `registry.tsx`.
- Unlike simple widgets (clock, weather) that read everything from `widget.config`, this widget has its own data (shortcuts, groups) that lives in the DB. The display component fetches via TanStack Query hooks, similar to how `TodoWidget` fetches todo items.
- The config form is more complex — it needs to manage the full shortcut/group lifecycle. This is similar to the links_list config form pattern but with more features (groups, icons, ping toggle).
- `configJson` stores only `{ columns: 4 }` — minimal widget-level settings.

**Alternatives considered**:
- **Embed all data in configJson**: Would make the config form the sole data management mechanism (save layout = save shortcuts). Loses independent shortcut CRUD. Conflicts with how edit mode works (draft-based, save-all).
- **Separate management page**: Over-engineered. Shortcuts are widget-scoped. The config dialog is the natural place.

---

## R7: Responsive Grid Layout

**Question**: How should the shortcut grid within the widget respond to different viewport sizes?

**Decision**: CSS Grid with `grid-template-columns: repeat(min(configuredColumns, autoFit), minmax(80px, 1fr))`. The configured column count is a maximum; CSS handles responsive reduction.

**Rationale**:
- CSS Grid's `minmax` with `auto-fit`/`auto-fill` provides native responsive behavior without JavaScript breakpoint logic.
- The user-configured column count (2–8, default 4, per FR-009) acts as the maximum. On smaller viewports, CSS naturally reduces columns.
- 80px minimum ensures touch target ≥44×44px (NFR-004) with padding.
- No dependency on react-grid-layout for the inner shortcut grid (that's for dashboard-level layout). CSS Grid is simpler and more performant for a uniform grid of equal-sized items.

**Alternatives considered**:
- **Flexbox with wrapping**: Works but harder to maintain equal column widths. CSS Grid is purpose-built for this.
- **react-grid-layout nested**: Overkill — shortcuts are uniform items, not arbitrarily sized/positioned.
- **JavaScript breakpoint detection**: Unnecessary complexity when CSS handles it natively.
