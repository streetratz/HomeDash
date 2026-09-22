# Implementation Plan: Sonos Widget Improvements

**Spec**: `specs/027-sonos-improvements/spec.md`  
**Issue**: #73  
**Branch**: `027-sonos-improvements`

## Architecture Overview

The improvements span backend (art proxy, polling optimization) and frontend (adaptive polling, touch UX, provider display, topology resilience).

### Current Architecture

```
Frontend                         Backend                      Sonos
─────────                        ───────                      ─────
useSonos.ts hooks ──(5s poll)──▶ /api/sonos/* routes ──────▶ sonos-adapter.ts
  ├─ playbackState                 ├─ cloud (OAuth API)        ├─ Cloud API
  ├─ metadata                      └─ local (UPnP/node-sonos)  └─ LAN devices
  ├─ groupVolume
  └─ groups (15s)
SonosWidget.tsx ──(img src)────▶ External CDN (Spotify/YTM/etc.)
```

### Target Architecture

```
Frontend                         Backend                       Sonos
─────────                        ───────                       ─────
useSonos.ts hooks ──(adaptive)─▶ /api/sonos/* routes ───────▶ sonos-adapter.ts
  ├─ playbackState (5s|15-30s)    ├─ cloud / local
  ├─ metadata (5s|15-30s)         ├─ NEW: /api/sonos/art/:hash
  ├─ groupVolume                  │     └─ LRU cache (50 items, 24h TTL)
  └─ groups (15s|60s)             └─ NEW: UPnP event subscriptions (local)
                                        ├─ AVTransport events
                                        ├─ RenderingControl events
                                        └─ WebSocket push ──▶ Frontend
SonosWidget.tsx ──(img src)────▶ /api/sonos/art/:hash (local proxy)
  + touch gesture layer
  + provider badge (multi-account aware)
  + visibility-aware polling / WS events
  + client-side position timer
```

## Phases

### Phase 1: Adaptive Polling (FR-001, FR-008, FR-011)
- Modify `useSonosPlaybackState` / `useSonosMetadata` to accept dynamic `refetchInterval`
- Create `useAdaptivePoll` hook that returns interval based on current playback state
- Add `useDocumentVisibility` hook — disable polling when tab is hidden
- Wire into SonosWidget + FullScreenSonos, force refetch on tab re-focus
- Add client-side track position timer (1s `setInterval` while playing, sync on state change)

### Phase 2: Album Art Proxy & Cache (FR-002, FR-007)
- Create `backend/src/services/artCacheService.ts` — LRU cache (max 50 entries, 24h TTL)
- Add `GET /api/sonos/art/:hash` route — looks up cache, fetches on miss, serves Buffer
- Modify metadata response to rewrite `imageUrl` → proxied URL
- Handle local-mode relative URLs (prepend device IP)
- Serve fallback SVG placeholder on failure

### Phase 3: Provider Badge & Accent (FR-003, FR-009)
- Extract `SERVICE_COLORS` (SonosWidget) and `SERVICE_ACCENTS` (FullScreenSonos) into a shared `sonos-theme.ts` module with unified types
- Add provider badge component (icon + name) to SonosWidget compact view
- Ensure FullScreenSonos uses shared theme and has visible badge placement
- Map additional service IDs from Sonos metadata to display names
- Parse `sn=` from Spotify track URIs to distinguish multiple accounts
- Add user-configurable account labels in widget config (sn → friendly name mapping)

### Phase 4: Touch UX (FR-004, FR-005)
- Increase touch targets on play/pause/skip buttons (min-w-11 min-h-11 for touch viewports)
- Add `useSwipeGesture` hook (pointer events, configurable threshold)
- Integrate swipe in FullScreenSonos track art area (left=next, right=prev)
- Enlarge volume slider drag handle on touch viewports
- Ensure no hover-only interactions (use focus-visible fallbacks)

### Phase 5: Topology Resilience (FR-006)
- Handle `useSonosGroups` returning a group list that no longer includes `activeGroupId`
- Add fallback logic: if selected group disappears, auto-select next playing group or first available
- Show brief toast on group topology change ("Groups updated")
- Verify modifyGroup mutation handles stale group IDs gracefully

### Phase 6: Validation & Tests
- Unit tests for `artCacheService` (cache hit/miss/TTL/eviction)
- Unit tests for `useAdaptivePoll` logic
- Frontend typecheck + lint + build
- Manual test checklist

### Phase 7: UPnP Event Subscriptions — Local Mode (FR-010)
- Create `backend/src/services/upnpEventService.ts` — manages SUBSCRIBE/RENEW/UNSUBSCRIBE lifecycle
- Start lightweight HTTP callback server to receive UPnP NOTIFY events from Sonos devices
- Parse AVTransport + RenderingControl event XML into normalised state objects
- Add WebSocket endpoint (`/ws/sonos`) to push state changes to connected frontends
- Create `useSonosEvents` hook — connects to WS, updates TanStack Query cache on events
- Implement automatic fallback: if no events received within expected window, resume polling
- Handle subscription renewal (default 1800s expiry) and re-subscribe on device reboot/network change

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Art cache | In-memory LRU Map | Simple, no external dep, 50 items ~25MB max |
| Swipe detection | Pointer Events API | No library needed, works on all modern browsers |
| Adaptive poll | Dynamic `refetchInterval` | TanStack Query supports function-based intervals |
| Touch targets | Tailwind responsive classes | `min-w-11 min-h-11 sm:min-w-8 sm:min-h-8` |
| Visibility | `document.visibilityState` | Built-in, no library |
| UPnP events | `node-sonos` `.on()` + custom HTTP callback | Zero-polling for local mode |
| WebSocket | Fastify `@fastify/websocket` | Already available in ecosystem, lightweight |
| Position timer | Client-side `setInterval(1000)` | Eliminates server calls for position |
| Theme sharing | Extracted `sonos-theme.ts` module | Eliminates duplicated colour maps |

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | T001–T003, T020 | Adaptive polling, visibility, position timer |
| 2 | T005–T007 | Album art proxy & cache with per-type fallbacks |
| 3 | T008–T009, T021–T022 | Unified theme, provider badge, multi-account |
| 4 | T010–T013 | Touch UX (targets, swipe, volume slider) |
| 5 | T014–T015 | Topology resilience |
| 6 | T016–T019 | Validation & tests |
| 7 | T023–T025 | UPnP event subscriptions + WebSocket (local mode) |

**Note**: T004 merged into T003 (hooks + consumer wiring is one task).

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LRU cache memory usage | High if images are large | Cap at 50 entries, store compressed, evict on TTL |
| Swipe conflicts with scroll | UX confusion | Only activate swipe on explicit track art area, require >50px horizontal threshold |
| Provider name inconsistency across modes | Wrong badge | Normalize service name in adapter layer before returning to frontend |
| Stale poll data after sleep/resume | Outdated UI | Visibility hook forces immediate refetch on tab re-focus |
