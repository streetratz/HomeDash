# Changelog

All notable changes to HomeDash will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Per-widget public dashboard visibility** (#66) — administrators can expose
  supported integration widgets individually while all existing and newly
  created widgets remain hidden by default. Anonymous views use dedicated,
  rate-limited, read-only snapshots for Pi-hole, UniFi, Sonos, stocks, and app
  shortcuts.

### Fixed

- **Public-visibility migration preserves widget configuration** (#209) —
  SQLite foreign keys are now disabled before Drizzle starts its migration
  transaction, preventing table rebuilds from cascading into shortcuts, links,
  and widget-connection rows. Foreign-key enforcement is restored and checked
  before startup continues.
- **Legacy Docker socket connections survive upgrades** (#208) — persisted
  absolute paths such as `/var/run/docker.sock` are normalized once at startup
  to `unix:///var/run/docker.sock`, preserving connection IDs and widget links.
  New connection input remains strict and still requires an explicit scheme.
- **Remote Docker hosts never worked** — three independent defects, each sufficient on its own to break every non-local connection (#181):
  - the Engine API version was hard-coded to `/v1.43/`, which modern daemons reject outright (`MinAPIVersion` 1.44+);
  - `parseDockerUrl()` silently coerced _any_ input to a socket path, so `tcp://host:2375` was read as a local file;
  - every failure path fell back to `unix:///var/run/docker.sock`, so a broken remote connection showed the local machine's containers as if it had worked.
- **Docker widget errors are now distinguishable** — "no connection configured", "invalid endpoint", "host unreachable", "SSH auth failed", "host key not verified" and "incompatible API version" each render differently, because each is fixed somewhere different. A widget in any error state shows no containers rather than falling back.

### Added

- **`ssh://` Docker endpoints** — connect to a daemon that is not exposed on the network, via `docker system dial-stdio`. Strict host-key checking, `BatchMode`, no agent/X11 forwarding, and a refusal to use a group- or world-readable key. New optional env vars `HOMEDASH_SSH_KEY_PATH`, `HOMEDASH_SSH_KNOWN_HOSTS_PATH`, `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING`.
- **Engine API version negotiation** — the daemon's advertised range is read once per endpoint and cached, then clamped into a supported version instead of assuming one.
- **Endpoint format guidance** — the connection form states all four accepted forms and the default port applied when omitted (`tcp`→2375, `https`→2376, `ssh`→22), before any input.

### Security

- Public dashboard bootstrap now removes hidden, unsupported, and private
  widgets before sending layout data. Public widget requests use structural
  dashboard authorization, allowlisted payloads, bounded single-flight caching,
  and a uniform not-found response; anonymous controls remain prohibited.
- **`GET /api/docker/containers` required no authentication** (#189). It also accepted a caller-supplied `?url=`, which made it an unauthenticated SSRF probe with a JSON parser attached. The route now requires a session and resolves the endpoint server-side from the widget's linked connection; no caller can influence the address.
- **`POST /api/docker/ping` has been deleted.** Unauthenticated, it was a port scanner: supply any `tcp://` address and read the 200/502. The admin connection-test route already did the same job correctly.
- Admin connection-test routes now validate the endpoint grammar and reject link-local and unspecified addresses before dialling.

### Breaking

- **`POST /api/docker/ping` is gone.** Use `POST /api/admin/connections/docker/test` (admin, CSRF-protected). Nothing in the HomeDash UI still calls the old route.
- **Stored endpoints that do not match one of the four accepted forms now fail closed.** Previously `http://host:2375` or a bare `host:2375` appeared to work — while actually showing the local daemon. Re-enter such a connection with an explicit `unix://`, `tcp://`, `https://` or `ssh://` scheme. `unix:///var/run/docker.sock` connections are unaffected.
- **Container actions now target the displayed host.** Start/stop/restart previously fell back to the local daemon, so a "restart" in a widget pointed at a remote host could restart a _local_ container of the same id. Actions now go to the same endpoint the listing came from.
- **The `dockerUrl` widget-config field has been removed.** Existing widgets carrying one are migrated into a real connection automatically on first startup after upgrade — idempotent, no operator action, no schema change. The field is no longer accepted from clients.

## [3.0.4] - 2026-06-28

### Fixed

- **Sonos Library: SMB folder drill-down in Docker** — CIFS folder URIs (`x-file-cifs://`) now normalized to `S://` ObjectIDs for ContentDirectory queries; container detection uses audio file extension check instead of URI-prefix heuristic (#175)

## [3.0.3] - 2026-06-28

### Fixed

- **Sonos Library: SMB share folders not browsable** — sub-folders were misclassified as tracks due to node-sonos `dropIDNamespace()` mangling `S://` ObjectIDs and the container detection only recognizing `x-rincon-playlist:` URIs (#175)

## [3.0.2] - 2026-06-28

### Fixed

- **First-run admin race condition** — concurrent requests to `/api/first-run/admin` can no longer create duplicate admin accounts; unique constraint violations now return 409 (#164)
- **User-create race → 500** — `POST /api/admin/users` catches `SQLITE_CONSTRAINT_UNIQUE` and returns 409 Conflict instead of unhandled 500 (#165)
- **Render-phase setState** — `useIdleDetection` no longer calls `setIsIdle` during render; moved to a `useEffect` (#166)
- **Timer leak in useSonosModifyGroup** — delayed query invalidation is now cleared on unmount (#167)
- **OAuth admin-delete permission** — admins can now delete any user's OAuth account via the admin endpoint (#169)

### Added

- `isUniqueConstraintError()` utility in `lib/errors.ts` for reusable SQLite constraint handling
- Unit tests for `useIdleDetection` timer cleanup and state transitions (#170)

## [3.0.1] - 2026-06-28

### Improved

- **Button tactile feedback** — all buttons now scale down on press (`active:scale-0.97`) for responsive feel (#142)
- **Targeted transitions** — replaced 12 `transition-all` usages with specific property lists; eliminates jank on rapid interactions (#143)
- **Reduced motion support** — marquee, equalizer bars, and aurora animations respect `prefers-reduced-motion` (#144)
- **Dynamic font loading** — only the selected body/title font is loaded on demand; removed ~180KB from initial bundle (#145)
- **Widget theme tokens** — replaced fragile `!important` CSS selector hacks with semantic `.widget-dark-panel` classes and CSS custom properties (#146)
- **Card corner radius** — normalized all `rounded-[10px]` to `rounded-lg` token for consistency (#147)
- **Marquee pacing** — animation duration now scales with text length (6–20s) instead of fixed 12s (#148)
- **Touch hover guard** — new `can-hover:` Tailwind variant prevents ghost hover states on touch devices (#149)
- **Widget loading skeletons** — new `WidgetSkeleton` component with stat/media/list variants; Spotify + Docker use content-shaped placeholders (#150)
- **Sheet/overlay animations** — Sheet duration reduced from 500ms to 250ms ease-out; FullScreenSonos gets fade+zoom entry (#151)
- **Spacing scale** — DashboardSkeleton gap normalized to 4/8 base scale (#152)
- **Header animation easing** — ambient gradients use linear timing for smoother constant drift (#153)
- **Focus ring consistency** — all custom inputs standardized to `focus-visible:ring-ring` (#154)
- **Slider thumb feedback** — press state with `active:scale-90` (#155)
- **Empty state hierarchy** — enlarged icon and bumped typography for confident focal point (#156)

### Added

- **Copilot skills** — design-taste, emil-design-eng, review-animations, and code-review-standard skill definitions

## [3.0.0] - 2026-06-28

### Added

- **Sonos library queue actions** — Add to Queue / Replace Queue at folder level for albums, artists, playlists, and genres (#111)
- **Genres sub-tab** — Library tab now includes a genres browser with grid navigation (#96)

### Breaking

- Major version bump for new Sonos library/queue API endpoints

## [2.8.2] - 2026-06-28

### Fixed

- **Stereo pair phantom rooms** — multi-member groups with invisible partners no longer filtered out; coordinator extracted from group ID (#101, #81)
- **Volume slider targets coordinator** — group volume changes apply to the correct player (#99)
- **Now playing marquee** — overflow detection + conditional animation; respects pause state (#110)
- **Room card spacing** — visual separation between speaker groups with rounded cards
- **Active group indicator** — pill badge shows selected group name above album art

## [2.8.1] - 2026-06-28

### Added

- **Route-level code splitting** — React.lazy for all pages; DashboardPage 138KB, SettingsPage 159KB (#132)
- **Adaptive Spotify polling** — 5s playing/visible, 30s paused, disabled when hidden (#86)
- **Pi-hole polling reduction** — 60s interval when tab is hidden (#87)
- **UniFi polling reduction** — 120s interval when tab is hidden (#88)
- **Pi-hole compact layout** — composable sections (controls/system/queries) with configurable layout (#126)

## [2.8.0] - 2026-06-28

### Added

- **Bundled web fonts** — Inter, Roboto, Fira Sans, Fira Code, JetBrains Mono, Poppins, Outfit, Space Grotesk, DM Sans available without network dependency
- **Site-wide body font** — new bodyFont setting applies to entire document
- **13 font choices** — expanded from 7 system stacks to 13 options including monospace and serif

### Fixed

- **Settings save failure** — bodyFont field added to Zod validation schema
- **SF Pro font mapping** — sf-pro key was missing from FONT_STACKS
- **General tab consolidation** — 4 cards → 2 (Account + Dashboard Preferences)

## [2.7.1] - 2026-05-25

### Fixed

- **SSRF hardening** — Sonos art proxy now follows redirects manually with per-hop URL validation; blocks loopback, 0.0.0.0/8, link-local, and IPv6 unspecified addresses (#131)
- **Admin reset script in Docker** — `reset-admin.ts` is now bundled into the container image; run via `docker exec` to reset admin credentials (#133)
- **Backend typecheck** — resolved undici type mismatch in unifi-service (#130)

### Removed

- 8 unused dependencies: next-themes, @fortawesome/\* (3), @vitest/coverage-v8, @radix-ui/react-tooltip, @fastify/csrf-protection, @types/sharp (#128)
- 6 dead code files: MiniCalendarView, DayDetailPanel, EventCard, progress-bar, status-dot, tooltip (#129)

## [2.7.0] - 2026-05-25

### Added

- **Calendar sync button** — sync icon in calendar widget toolbar triggers manual sync with spinning feedback (#105)
- **Last sync indicator** — "Synced Xm ago" label in calendar widget toolbar shows when data was last refreshed (#105)

### Fixed

- **Full-screen calendar shows all events** — no longer limited by widget's daysAhead/sourceIds/maxEvents filters; fetches full month independently (#123)
- **Full-screen calendar respects private events** — honours the showPrivateEvents widget config
- **Calendar sync lookback** — extended from 7 days to 2 months back, so full-screen month view has historical data
- **Fixed 180×180 grid cells** — cells never resize on desktop; container width is dynamic based on layout content (#124)
- **Horizontal scrollbar** — eliminated page-level scrollbar; grid left-aligns with overflow clipped, scrollbar only appears when viewport is narrower than actual content
- **Background image fills viewport** — background moved to full-width wrapper so it covers the entire screen regardless of grid width

### Changed

- **Calendar widget toolbar** — moved expand/sync actions from header injection to inline toolbar (consistent with other widgets)
- **Grid layout engine** — replaced WidthProvider with fixed-width Responsive component for precise 180px cell sizing

## [2.5.0] - 2026-05-19

### Added

- **Aurora Australis header animation** — new header style option with red/magenta/violet flowing gradient, twinkling stars overlay, and glass-effect variant (#106)
- **Aurora Australis widget background** — new placeholder background style with animated southern lights gradient and blur (#106)
- **Background polling fix** — tabs in the background no longer poll the server, reducing unnecessary network requests (#85)

### Changed

- **Header style options** — existing "Aurora" renamed to "Aurora Borealis" for clarity; new "Aurora Australis" added alongside it
- **Theme toggle** — reverted from dropdown ThemePicker back to simple Light/Dark icon toggle (aurora global theme removed as indistinguishable from dark mode)

### Removed

- **Aurora global theme mode** — removed the "Aurora" option from the Light/Dark/Aurora theme picker; aurora effects remain available as header and widget background styles

### Changed

- **GitHub Actions** — upgraded all workflow actions to Node.js 24-compatible versions (checkout v6, buildx v4, login v4, metadata v6, build-push v7, setup-node v6) (#116)
- **pnpm** — upgraded package manager from 8.15.9 to 11.1.3 with corepack activation (#117)
- **Node.js** — minimum engine requirement bumped to >=22.13.0 (required by pnpm 11)
- **Dockerfiles** — both root and deploy Dockerfiles updated to Node 22 with explicit `corepack prepare pnpm@11.1.3`
- **pnpm-workspace.yaml** — migrated to `allowBuilds` map (pnpm 11 build approval mechanism) (#119)

### Fixed

- TS4111 bracket-notation errors in backend integration tests (backup, restore, restorePreview) (#95)
- Docker build failure from incorrect `onlyBuiltDependencies` config — corrected to `allowBuilds` (#119)

### Removed

- `.npmrc` — replaced by `allowBuilds` in pnpm-workspace.yaml (pnpm 11 mechanism)

## [2.4.0] - 2026-05-19

### Added

- **Single-Link widget** — new widget type: prominent clickable tile with icon, label, optional subtitle, and configurable background colour/gradient (#108)
- **Pi-hole composable sections** — independently toggle Controls, System Stats, and Query Stats panels with new `sections` config (#113)
- **Pi-hole stats layout** — choose Auto (responsive), Side by Side, or Stacked arrangement for panels
- **Grid overlay** — visual grid lines shown in edit mode for easier widget placement
- **Responsive icon scaling** — SingleLink icon scales to 60% of widget height; Shortcuts single-icon scales by size setting (S:35%, M:45%, L:55%)
- Backend validation schema for Single-Link widget (HTTP/HTTPS-only URLs)

### Changed

- **Shortcuts widget** — icons wrap via flexbox instead of shrinking; overflow uses hidden scrollbar (`scrollbar-hide`) instead of visible scrollbar (#112, #107)
- **All widgets** — explicit `minW: 1, minH: 1` for full user control over sizing (#114)
- **UniFi & App Shortcuts** — content vertically and horizontally centered in grid cells
- **Pi-hole controls** — always rendered inline as panel card, never injected into placeholder header bar
- **Single-Link & Shortcuts** — hover effects: icon scale-up on hover, brightness boost on SingleLink tiles

### Fixed

- Dashboard background disappearing on scroll in edit mode (`backgroundAttachment: fixed`)
- Pi-hole header bar appearing even when title disabled (removed header action injection entirely)
- Legacy Pi-hole `showBlocklistCount: false` config now correctly hides Blocklist row

## [2.3.2] - 2026-05-11

### Fixed

- Docker build failure: incorrect `env` import in sonos-local-service (`getEnv()` is the correct export)

## [2.3.1] - 2026-05-11

### Added

- Sonos diagnostics endpoint (`GET /api/sonos/diagnostics`) for troubleshooting library/favorites on Docker/NAS deployments
- `LOG_LEVEL`-gated Sonos logging helpers (`sonosDebug`, `sonosWarn`, `sonosError`) — set `LOG_LEVEL=debug` in docker-compose to enable verbose logging

### Fixed

- Sonos favorites endpoint returning 500 when result shape is unexpected (added try/catch with graceful fallback)
- Empty library results now logged as warnings for easier debugging
- About page showing empty changelog in Docker builds (`.dockerignore` excluded `CHANGELOG.md`)
- About page showing "unknown" commit link in Docker builds (git SHA now passed as build arg)

## [2.2.0] - 2026-05-11

### Added

- **Sonos Phase 2 — Service Discovery & Speaker Details**
  - Multi-account Spotify detection with `sn=` serial number tracking
  - Account label management in Settings (assign friendly names like "Dad's Spotify")
  - Enhanced speaker discovery: model name, software version, serial number, hardware version
  - Stereo pair detection with L/R indicators and partner linking
  - Provider badges show account labels across Now Playing, fullscreen, and favorites
  - 21 new unit tests for service detection, account labels, and speaker discovery

- **Sonos Phase 2 — Browse Panel Redesign**
  - Dynamic service selector replacing hardcoded tabs (Spotify, Library, non-browsable services)
  - Library sub-tabs: Folders (default), Artists, Albums, Tracks, Playlists
  - Compact responsive tile grid (3→6 columns) for large libraries (2.5k+ artists, 17k+ tracks)
  - Infinite scroll with IntersectionObserver (50 items/batch)
  - Library search with debounced input

- **Sonos Phase 2 — Queue Management & Library Navigation**
  - PlayActionMenu with 4 queue actions: Play Now, Play Next, Add to End, Replace Queue
  - ObjectID-based library drill-down (Artists → Albums → Tracks, Folders → Subfolders → Files)
  - Breadcrumb navigation for drill-down with back/root navigation
  - Play Next via SOAP AddURIToQueue with EnqueueAsNext
  - `GET /api/sonos/library/browse?objectId=` — ContentDirectory drill-down
  - `GET /api/sonos/library/:type/search?q=` — per-category library search
  - `POST /api/sonos/groups/:groupId/queue/next` — play next API

### Fixed

- Library drill-down using ObjectID-based browsing instead of separator-based paths (fixes nested folder/artist navigation)
- Container vs track detection uses URI prefix instead of artist field presence
- Double scrollbar in Library panel (nested overflow containers)
- Scroll position reset on infinite scroll load (keepPreviousData)
- All Sonos panels now use site-consistent hidden scrollbars

## [2.1.0] - 2026-05-11

### Added

- About tab in Settings showing build info, server details, and changelog
- Build-time metadata injection (version, commit SHA, build date)
- Backend `/api/system/info` endpoint (Node version, uptime, environment)
- Quick-access About link in user dropdown menu
- Version badge in footer linking to About tab
- Inline changelog rendered from CHANGELOG.md at build time

## [2.0.1] - 2026-05-10

### Added

- Sonos tiered adaptive polling (60-70% fewer API calls)
- Radix Slider for touch-friendly volume and progress controls
- Music service detection with themed accent colours (Spotify, Apple Music, YouTube Music, etc.)
- Album art backend proxy with LRU cache
- Fullscreen Sonos player with gesture support
- Refresh buttons on Rooms and Favourites tabs
- Screensaver-aware polling (pauses when screensaver is active)

### Fixed

- Infinite re-render loop on fullscreen toggle
- Marquee text overlapping player controls
- YouTube Music accent colour detection
- Favourites missing album art images
- Service detection for edge-case provider names

## [2.0.0] - 2026-04-28

### Added

- Group-based RBAC (Administrators, Users, Viewers)
- App Shortcuts widget
- Pi-hole DNS Controls widget
- UniFi Network widget
- Stocks market data widget
- Sonos Cloud Control widget
- Docker container management widget
- Photo slideshow widget
- Calendar widget with Microsoft/Google integration
- Backup & Restore system
- Scheduled Jobs framework
- Connected Accounts (OAuth) management
- Screensaver mode with clock and now-playing overlay

### Changed

- Complete frontend redesign with shadcn/ui component library
- Migrated from REST polling to adaptive polling patterns
- Settings reorganised into tabbed layout

## [1.0.0] - 2026-03-15

### Added

- Initial release
- Dashboard grid layout with drag-and-drop
- User authentication with session management
- Admin panel for dashboard and widget management
- Theme switching (light/dark)
- Multi-dashboard support
