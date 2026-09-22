# Tasks: Sonos Widget Improvements

**Spec**: 027-sonos-improvements  
**Issue**: #73  
**Branch**: `027-sonos-improvements`

---

## Phase 1: Adaptive Polling

- [x] **T001** — Create `useDocumentVisibility` hook in `frontend/src/hooks/`
  - Returns `isVisible: boolean` based on `document.visibilityState`
  - Fires callback on visibility change for immediate refetch

- [x] **T002** — Create `useAdaptivePoll` hook
  - Input: current playback state string
  - Returns: `{ metadataInterval, playbackInterval, groupsInterval }`
  - Logic: PLAYING → 5s/5s/15s, PAUSED → 15s/15s/30s, IDLE → 30s/30s/60s

- [x] **T003** — Wire adaptive polling into hooks and consumers
  - Make `refetchInterval` in `useSonosPlaybackState`, `useSonosMetadata`, `useSonosGroups` accept `number | false`
  - Add `refetchInterval` to `useSonosGroupVolume` (currently missing entirely)
  - When `!isVisible`, return `false` (disable polling)
  - When visible, use interval from `useAdaptivePoll`
  - Integrate in SonosWidget + FullScreenSonos: pass dynamic intervals, force refetch on tab re-focus

---

## Phase 2: Album Art Proxy & Cache

- [x] **T005** — Create `backend/src/services/artCacheService.ts`
  - LRU cache: max 50 entries, 24h TTL
  - `getArt(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }>`
  - Handles external URLs + local-mode relative URLs (prepend device IP)
  - Per-input-type fallback artwork: TV → TV icon, line-in → audio-jack icon, NAS/library → folder icon (not just one generic placeholder)
  - Returns appropriate fallback SVG on fetch failure based on input type

- [x] **T006** — Add `GET /api/sonos/art/:hash` route
  - Hash = URL-safe base64 of source URL (or SHA-256 prefix)
  - Looks up cache, fetches on miss
  - Returns image with correct Content-Type + cache headers

- [x] **T007** — Rewrite metadata imageUrl in adapter response
  - In `sonos-adapter.ts` or API route, replace external URLs with `/api/sonos/art/:hash`
  - Keep original URL in a separate field for debugging

---

## Phase 3: Provider Badge & Accent

- [x] **T008** — Unify accent/theme maps + add provider badge to SonosWidget
  - Extracted shared `frontend/src/components/sonos/sonos-theme.ts` with `ServiceAccent` type, `getServiceAccent()`, `DEFAULT_ACCENT`
  - Removed duplicate `AccentColors`/`SERVICE_COLORS`/`getAccent()` from SonosWidget
  - Added pill badge with `accent.label` in compact view (replaces faint `· serviceName` text)

- [x] **T009** — Verify and enhance FullScreenSonos provider display
  - Removed duplicate `AccentSet`/`SERVICE_ACCENTS`/`getAccent()` from FullScreenSonos
  - Enhanced hero badge to pill style with `accent.bg` background + `accent.label`
  - Updated `btnBg` usage to include separate `btnHover` class (theme splits base/hover)

---

## Phase 4: Touch UX

- [x] **T010** — Increase touch targets for transport controls ✅
- [x] **T011** — Create `useSwipeGesture` hook ✅
- [x] **T012** — Integrate swipe gestures in FullScreenSonos ✅
- [x] **T013** — Enlarge volume slider for touch ✅
- [x] **T025** — Add per-player volume sliders to grouping panel ✅

---

## Phase 5: Topology Resilience

- [x] **T014** — Handle disappearing group gracefully ✅
  - `useEffect` in SonosWidget detects when `selectedGroup` disappears from groups array
  - Auto-resets to null; fallback chain picks playing → first → null
  - Shows toast: "Speaker group changed — switched to another room"

- [x] **T015** — Handle stale group in mutations ✅
  - Enhanced `handleError` in `useSonosControls` to detect 404/NOT_FOUND responses
  - On stale group error: invalidates `sonos-groups` cache, shows toast, triggers T014 fallback
  - Silences DISALLOWED_BY_POLICY and PLAYBACK_NO_CONTENT as before

---

## Phase 6: Validation & Tests

- [x] **T016** — Unit tests for `artCacheService`
  - 7 tests: hash determinism, proxy path, cache hit/miss, fetch failure, non-200 fallback, LRU eviction
  - File: `backend/tests/unit/artCacheService.test.ts`

- [x] **T017** — Unit tests for adaptive polling logic
  - 7 tests: PLAYING/BUFFERING/PAUSED/IDLE intervals, undefined state, visibility=false disables all
  - File: `frontend/src/hooks/__tests__/useAdaptivePoll.test.ts`

- [x] **T018** — Frontend typecheck + lint + build verification
  - Fixed lint: replaced useEffect setState with useMemo + eslint-disable for topology reset
  - All clean: tsc ✓, eslint ✓, vite build ✓

- [ ] **T019** — Manual test checklist sign-off

---

## Phase 1 Additions

- [x] **T020** — Client-side track position timer
  - Create `usePositionTimer` hook — `setInterval(1000)` while playback state is PLAYING
  - Increment displayed position locally; reset/sync when playback state changes (play/pause/seek)
  - Eliminates polling for position updates — display updates every second with zero server calls
  - Wire into both SonosWidget and FullScreenSonos progress display

---

## Phase 3 Additions

- [ ] **T021** — Multi-Spotify `sn=` account detection
  - Parse `sn=` parameter from Spotify track URIs in metadata response
  - Map `sn` values to user-configurable account labels in widget config
  - Display label in provider badge (e.g., "Spotify · Alice" vs "Spotify · Bob")
  - Config UI: simple sn → name mapping table in widget settings

- [ ] **T022** — Verify and add missing service ID mappings
  - Map Sonos `service.id` values to display names for all discovered services
  - Include: Spotify (9), YouTube Music (305), TuneIn (254), Apple Music (204), Tidal (44551), Amazon Music (203)
  - Ensure `sonos-theme.ts` covers all known services with accent colours

---

## Phase 7: UPnP Event Subscriptions (Local Mode)

- [ ] **T023** — Create `backend/src/services/upnpEventService.ts`
  - Manage SUBSCRIBE/RENEW/UNSUBSCRIBE lifecycle for AVTransport + RenderingControl services
  - Start lightweight HTTP callback server to receive UPnP NOTIFY events
  - Parse event XML into normalised state objects
  - Auto-renew subscriptions before expiry (default 1800s), re-subscribe on device reboot/reconnect

- [ ] **T024** — WebSocket endpoint for real-time state push
  - Add `GET /ws/sonos` WebSocket route using `@fastify/websocket`
  - Broadcast normalised state events to connected frontend clients
  - Support per-group filtering so clients only receive events for their active group
  - Handle connection lifecycle (auth check, reconnect)

- [ ] **T025** — Frontend `useSonosEvents` hook
  - Connect to `/ws/sonos` WebSocket endpoint
  - Update TanStack Query cache directly on events (optimistic, no refetch)
  - Automatic fallback: if no events received within 2× expected interval, resume adaptive polling
  - Reconnect on disconnect with exponential backoff

---

## Phase 8: Browse Panel Service Selector (#83)

- [ ] **T026** — Refactor BrowsePanel from hardcoded tabs to service selector
  - Replace 4 fixed tabs (Search, Playlists, Radio, Library) with a dropdown/radio selector at the top
  - Available services populated from: currently-playing service, Sonos favorites metadata
  - Default to currently-playing service, fall back to first available
  - Below selector: contextual Search + Browse panes for the selected service

- [ ] **T027** — Per-service search and browse
  - Spotify (if connected): use existing Spotify API search + playlists
  - Sonos Library: use existing `browseLibrary()` UPnP call
  - TuneIn/Radio: use existing `getRadioStations()` UPnP call
  - Other services: search within Sonos Favorites matching that service
  - Long-term: Sonos SMAPI for native per-service search

- [ ] **T028** — Default service logic and persistence
  - Determine default service: currently-playing → user preference → first available
  - Store last-used service per user in widget config or local storage
  - Handle gracefully when selected service has no search capability (show browse-only)

---

## Phase 9: Sonos Settings Speaker Details (#84)

- [ ] **T029** — Fetch extended speaker info from UPnP device description
  - Query each discovered speaker's UPnP device description XML
  - Extract: software version, serial number, full model name, hardware version
  - Cache results (speakers don't change info frequently)

- [ ] **T030** — Display extended speaker details in Settings panel
  - Expand each speaker card to show: software version, serial number, full model name, IP address
  - Add collapsible/expandable detail section per speaker
  - Show stereo pair status when available (relates to #81)
  - Show linked services when available (relates to #82)
