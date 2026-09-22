# Feature Specification: Sonos Phase 2 — Service Discovery, Browse & Speaker Details

**Feature Branch**: `029-sonos-phase2`  
**Created**: 2025-05-11  
**Status**: Complete  
**Input**: GitHub Issues #82, #83, #84 — Sonos widget improvements  
**Research**: `027-sonos-research.md` (session files)

---

## Overview

Three related enhancements to the Sonos widget:

1. **Service Discovery** (#82) — Detect linked music services and multi-account Spotify
2. **Browse Panel Redesign** (#83) — Replace hardcoded Spotify-only tabs with dynamic service selector
3. **Speaker Details** (#84) — Show software version, serial number, model, and stereo pair status in Settings

---

## User Scenarios & Testing

### User Story 1 — Service Detection & Multi-Account Spotify (Priority: P1)

As a HomeDash user with multiple Spotify accounts linked to my Sonos system, I want to see which account is currently playing so I know whose music is on.

**Acceptance Scenarios**:

1. **Given** Spotify is playing on a group, **When** I view the Now Playing card, **Then** the provider badge shows "Spotify" with the account label (e.g. "Dad's Spotify")
2. **Given** two different Spotify accounts are playing on different groups, **Then** each group shows its own account label
3. **Given** YouTube Music is playing, **Then** the provider badge shows "YouTube Music" with correct accent colour
4. **Given** Apple Music / Amazon / Deezer / Tidal is playing, **Then** the correct provider badge and accent colour are shown
5. **Given** a service is detected for the first time with an unknown `sn=` value, **Then** the provider badge shows "Spotify (Account #N)" — i.e. service name with parenthetical fallback label — until the user assigns a friendly name in Settings

### User Story 2 — Account Label Management (Priority: P2)

As a HomeDash admin, I want to assign friendly names to Spotify account serial numbers so my family can tell whose music is playing.

**Acceptance Scenarios**:

1. **Given** I open Sonos Settings, **When** I see detected `sn=` values, **Then** I can assign friendly labels
2. **Given** I save a label for `sn=7` as "Dad's Spotify", **Then** all groups playing from `sn=7` show "Dad's Spotify"
3. **Given** no `sn=` values have been observed yet, **Then** the label section shows "Play music from different accounts to discover them"

### User Story 3 — Dynamic Browse Panel (Priority: P1)

As a HomeDash user, I want to browse and search music from whichever service is currently playing (not just Spotify).

**Acceptance Scenarios**:

1. **Given** I open the Browse panel, **Then** I see browsable services as buttons (Spotify, Library) and non-browsable services as dimmed text (YouTube Music, Radio — "Sonos app only")
2. **Given** Spotify is connected and selected, **Then** I see Search + Playlists sub-tabs (existing behaviour)
3. **Given** "Library" is selected, **Then** I see sub-tabs for Artists, Albums, Tracks, and Playlists browsing local/NAS music library
4. **Given** I open Browse while YouTube Music or Radio is playing, **Then** the service selector defaults to "Library" (since YT Music and Radio have no browse API)
5. **Given** no Spotify is connected, **Then** the Spotify option is not available in the selector

> **API Limitations Discovered (Phase 6)**:
> - **YouTube Music**: Sonos treats as cast-only; no browse/search API available via `node-sonos`
> - **Radio (TuneIn)**: `getFavoritesRadioStations()` only returns user-favorited stations (already shown in Favorites tab); no radio directory/browse/search API exists
> - **Music Library** (#97): ~~`getMusicLibrary()` returns empty results after NAS sync~~ **RESOLVED** — NAS sync completed, library now returns data (2,598 artists, 3,654 albums, 17,649 tracks)

### User Story 4 — Speaker Details in Settings (Priority: P1)

As a HomeDash admin, I want to see detailed speaker information in Settings to help diagnose issues.

**Acceptance Scenarios**:

1. **Given** I open Sonos Settings in local mode, **Then** each speaker shows: model name, software version, serial number, IP address
2. **Given** a stereo pair exists, **Then** the paired speakers are shown with a stereo pair indicator
3. **Given** I'm in cloud mode, **Then** speaker details show what's available from the cloud API (name, model) with a note that full details require local mode

---

## Current State (What Exists)

### Provider Detection (`sonos-local-service.ts:316-333`)
- URI string matching for: Spotify, YouTube Music, Apple Music, Amazon, TuneIn, Deezer, Tidal, SoundCloud
- Fallback `sid=` / `sn=` parsing with a `SN_MAP`
- `sonos-theme.ts` maps service names → accent colours

### Browse Panel (`BrowsePanel.tsx`)
- 4 hardcoded tabs: Search (Spotify API), Playlists (Spotify API), Radio (TuneIn), Library (local)
- Search + Playlists disabled when Spotify not connected
- No way to browse other services

### Speaker Discovery
- `GET /api/sonos/discover` returns: name, host, port, uuid, model (optional)
- Settings UI shows: name, host:port, model, green status dot
- No software version, serial number, or stereo pair info

### Database
- No Sonos-specific tables; uses `oauth_accounts` (provider=sonos) and `integration_configs`

---

## Technical Design

### Phase 1: Enhanced Service Detection & Provider Badge

**Backend changes** (`sonos-local-service.ts`):
- Enhance `detectServiceFromUri()` to return structured `{ service, sid, sn, accountLabel? }` instead of just a string
- Add `sn=` extraction for multi-Spotify account detection
- Store discovered `sn=` → label mappings in `integration_configs` (key: `sonos_account_labels`, JSON value)

**API additions**:
- `GET /api/sonos/service-labels` — get `sn=` to friendly-name mappings
- `PUT /api/sonos/service-labels` — admin; save mappings

**Frontend changes**:
- Update provider badge in `SonosWidget.tsx` and `FullScreenSonos.tsx` to show account label when available
- Add auto-discovery: when a new `sn=` is seen in metadata, surface it in settings

### Phase 2: Speaker Details

**Backend changes** (`sonos-local-service.ts`):
- Enhance speaker discovery to fetch UPnP device description XML (`/xml/device_description.xml`)
- Extract: `modelName`, `modelNumber`, `softwareVersion`, `serialNum`, `hardwareVersion`
- Detect stereo pairs from zone topology (paired speakers share a group with `Visible=false`)

**API changes**:
- Extend `GET /api/sonos/discover` response to include full device details
- Add `stereoPair?: { role: 'left' | 'right', partnerUuid: string }` to speaker data

**Frontend changes** (`IntegrationsTab.tsx`):
- Expand speaker card in settings to show all new fields
- Show stereo pair indicator with L/R labels
- Collapsible detail section to keep the UI clean

### Phase 3: Browse Panel Redesign

**Frontend changes** (`BrowsePanel.tsx`):
- Replace 4 hardcoded tabs with a two-tier service selector:
  - **Browsable services** (button row): Spotify (if OAuth'd), Library
  - **Non-browsable services** (dimmed text): YouTube Music · Radio — "Sonos app only"
- Service options derived from:
  - Currently playing service (auto-detected)
  - Connected services (Spotify if OAuth'd)
  - Static options: Library (always available)
- Sub-tabs within each service:
  - **Spotify**: Search, Playlists (existing)
  - **Library**: Artists, Albums, Tracks, Playlists sub-navigation (via `getMusicLibrary()`)
- Default selection logic:
  1. Currently playing service (if it has browse capability)
  2. Spotify (if connected)
  3. Library (fallback)

> **Design Decision**: Sonos Favorites removed from browse panel to avoid duplicating the existing Favorites tab in the right panel. Radio and YouTube Music marked non-browsable due to API limitations.

---

## Scope Boundaries

### In Scope
- Multi-Spotify `sn=` detection and labelling
- Enhanced provider badges for all detected services
- Browse panel restructure with service selector
- Speaker details from UPnP device description
- Stereo pair detection and display

### User Story 5 — Queue Management (Priority: P1)

As a HomeDash user, I want to control how music is added to my queue so I can build playlists without interrupting playback.

**Acceptance Scenarios**:

1. **Given** I'm browsing the Library, **When** I click on a track/album/artist, **Then** I see options: "Play Now", "Play Next", "Add to End of Queue", "Replace Queue"
2. **Given** I choose "Add to End of Queue" on an album, **Then** the album's tracks are appended to the current queue without interrupting the currently playing track
3. **Given** I choose "Play Now" on a track, **Then** the queue is cleared and the track starts playing immediately
4. **Given** I choose "Play Next" on a track, **Then** the track is inserted after the currently playing track in the queue
5. **Given** I'm playing Spotify and add a NAS track to the queue, **Then** cross-service queueing works (Spotify + NAS coexist in the same queue)

### User Story 6 — Library Drill-Down Navigation (Priority: P1)

As a HomeDash user, I want to browse into artists, albums, and folders to find specific tracks in my music library.

**Acceptance Scenarios**:

1. **Given** I open Library with Folders tab active, **Then** I see my NAS share root folders
2. **Given** I click a folder, **Then** I see its subfolders/files with a breadcrumb trail showing the navigation path
3. **Given** I click an Artist, **Then** I see that artist's albums
4. **Given** I click an Album, **Then** I see the album's track listing with play/queue actions
5. **Given** a folder contains only leaf tracks (no sub-containers), **Then** it renders as a track list with play/queue actions
6. **Given** I'm deep in a folder hierarchy, **Then** I can click any breadcrumb segment to navigate back

### User Story 7 — Scalable Library UI (Priority: P1)

As a HomeDash user with a large music library (2,500+ artists, 17,000+ tracks), I want a fast and navigable UI that doesn't overwhelm me.

**Acceptance Scenarios**:

1. **Given** I open the Artists tab, **Then** items load progressively via infinite scroll (not all at once)
2. **Given** I type in the search/filter input, **Then** results are debounced (500ms) and filtered in real-time
3. **Given** I'm viewing a long list, **Then** album art images are lazy-loaded (only when scrolled into view)
4. **Given** the Library has thousands of items, **Then** items render as a compact responsive grid (not large click buttons)
5. **Given** I'm on a collection view (artist/album), **Then** I see a "Play" dropdown button with all 4 queue actions

---

## Phase 4: Queue Management & Library Navigation (US5, US6, US7)

> **Research**: Inspired by [sonos-web/sonos-web](https://github.com/sonos-web/sonos-web) patterns

### Backend Changes

**Queue management** (`sonos-local-service.ts`):
- `addToQueue(groupId, uri, asNext?)` — appends or inserts after current track
  - Uses `device.queue(uri)` (SOAP `AddURIToQueue`) — no flush
  - `asNext` uses `DesiredFirstTrackNumberEnqueued` to insert after current position
- `replaceQueueAndPlay(groupId, uri)` — existing `playUri()` behaviour (flush → queue → play)

**Container drill-down** (`sonos-local-service.ts`):
- Extend `browseLibrary()` to accept a `searchTerm` parameter
- Key insight from sonos-web: the **separator character** controls behaviour:
  - `':'` (colon) = **search/prefix match**: `A:ARTIST:Metallica`
  - `'/'` (slash) = **browse into container**: `A:ARTIST/Metallica` → returns albums
  - Trailing `/` goes deeper: `A:ALBUMARTIST/Metallica/` → all songs across albums
- Share paths: strip `x-file-cifs:` prefix, use `S:` ObjectID with colon separator

**New API routes** (`sonos.ts`):
- `POST /api/sonos/groups/:groupId/queue/add` — add to end of queue
- `POST /api/sonos/groups/:groupId/queue/next` — play next (insert after current)
- `POST /api/sonos/groups/:groupId/queue/replace` — replace queue and play
- `GET /api/sonos/library/:type/browse?term=<base64>&start=&total=` — drill-down browse
- `GET /api/sonos/library/search?term=<query>&start=&total=` — cross-category search

### Frontend Changes

**Compact responsive grid** (`BrowsePanel.tsx`):
- Replace large click buttons with responsive tile grid (2 cols mobile → 6 cols desktop)
- Lazy-loaded album art images via `loading="lazy"` or intersection observer
- Compact item cards: album art thumbnail + title (2-line clamp) + subtle play icon
- `LibraryItemCount` showing total (e.g., "2,598 Artists")

**Infinite scroll pagination**:
- Load 50 items per batch, preload at 2× viewport height
- Deduplicate guard to prevent double-fetching on rapid scroll
- Loading skeleton while fetching

**Drill-down navigation**:
- Breadcrumb trail: `Library > Artists > Metallica > ...And Justice for All`
- Click artist → shows albums grid; click album → shows track list
- Click folder → shows subfolders/tracks; auto-detect leaf vs container
- Back navigation via breadcrumbs (any segment clickable)

**Queue action menu**:
- Collection-level: "Play ▼" dropdown button with 4 actions (Play Now / Play Next / Add to End / Replace Queue)
- Track-level: hover-revealed action icons (▶ play, + add to queue)
- Double-click track = Play Now

**Search/filter**:
- Debounced (500ms) search input at top of library views
- Parallel search across categories (artists, albums, tracks)
- Top results overview with "See All" links per category

**Folders as default Library sub-tab**:
- Reorder `LIBRARY_SUB_TABS`: Folders first, then Artists, Albums, Tracks, Playlists

### Out of Scope (deferred)
- SMAPI browsing for YouTube Music, Apple Music, etc. (undocumented auth)
- Spotify Web API browsing beyond current Search + Playlists
- Plex / Jellyfin service browsing
- UPnP event subscriptions (replacing polling)
- Client-side track position timer
- Queue drag-and-drop reordering
- Queue view panel (showing current queue contents)

---

## Dependencies
- No new npm packages expected
- `react-virtuoso` or similar for virtual scrolling (evaluate; infinite scroll may suffice)
- UPnP device description XML parsing: use existing `xml2js` or lightweight parser
- No database migrations needed (using `integration_configs` for label storage)

---

## Implementation Order

1. **Phase 1** — Service Detection & Labels (~PR 1) ✅
2. **Phase 2** — Speaker Details (~PR 1 or 2, independent of Phase 1) ✅
3. **Phase 3** — Browse Panel Redesign (~PR 2 or 3, benefits from Phase 1 service data) ✅
4. **Phase 4** — Queue Management & Library Navigation (US5, US6, US7)

Phases 1–3 complete. Phase 4 builds on the Library sub-tab infrastructure from Phase 3.
