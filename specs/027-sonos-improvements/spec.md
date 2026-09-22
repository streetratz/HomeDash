# Feature Specification: Sonos Widget Improvements

**Feature Branch**: `027-sonos-improvements`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: GitHub Issue #73 — "Widget: Sonos improvements — caching, providers, touch UX, polling"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adaptive Polling (Priority: P1)

As a user with a wall-mounted dashboard showing the Sonos widget, I want the system to intelligently reduce API calls when nothing is playing so my network and Sonos speakers aren't hammered with unnecessary traffic, but resume fast polling when music starts.

**Why this priority**: The polling behaviour is the foundation — every other improvement (image caching, touch UX) relies on having sensible poll rates. Currently the widget polls playback + metadata every 5s regardless of state, generating constant load even when idle.

**Independent Test**: Configure widget, observe that when Sonos is IDLE/PAUSED the backend receives far fewer requests (≥15s intervals). When music starts playing, verify fast polling resumes within one cycle.

**Acceptance Scenarios**:

1. **Given** playback state is IDLE, **When** 30 seconds elapse, **Then** no more than 2 poll requests fire (metadata + playback combined)
2. **Given** playback state is PLAYING, **When** 5 seconds elapse, **Then** poll fires normally (every 5s)
3. **Given** state transitions from IDLE → PLAYING (user presses play), **Then** fast polling resumes within 5s
4. **Given** state transitions from PLAYING → PAUSED, **Then** polling slows after 1 cycle at fast rate

---

### User Story 2 - Server-Side Album Art Proxy & Cache (Priority: P2)

As a user, I want album art images to load instantly and not re-download the same artwork on every poll cycle. The backend should proxy and cache artwork so the frontend uses a stable local URL.

**Why this priority**: Reduces bandwidth (especially on metered/slow connections), avoids CORS issues with direct external URLs, and improves perceived performance. High visual impact for kiosk/wall displays.

**Independent Test**: Play a track, observe that the image URL served to the frontend is a local `/api/sonos/art/:hash` endpoint. Play the same track again later — verify no external fetch occurs (cache hit).

**Acceptance Scenarios**:

1. **Given** metadata contains an external imageUrl, **When** frontend renders, **Then** it uses the proxied `/api/sonos/art/:hash` URL
2. **Given** the same artwork has been fetched before, **When** a new request arrives, **Then** it is served from in-memory/disk cache (no external fetch)
3. **Given** cache reaches TTL (e.g., 24h), **When** art is requested, **Then** it re-fetches from source
4. **Given** artwork fetch fails, **Then** a generic placeholder is served (no broken images)

---

### User Story 3 - Music Provider Display & Accent Colours (Priority: P2)

As a user with multiple music services on my Sonos (Spotify, YouTube Music, Apple Music), I want the widget to clearly show which provider is currently playing and style the UI with provider-appropriate colours.

**Why this priority**: Visual clarity — users need to know at a glance which service is active. The code already has `SERVICE_COLORS` — this story ensures the provider badge/icon is always visible and accurate.

**Independent Test**: Play tracks from different services; verify the provider name and/or icon badge appears in both compact and fullscreen modes with the correct accent colour.

**Acceptance Scenarios**:

1. **Given** a Spotify track is playing, **When** widget renders, **Then** provider badge shows "Spotify" with green accent
2. **Given** a YouTube Music track is playing, **When** widget renders, **Then** provider badge shows "YouTube Music" with red accent
3. **Given** provider is unknown or missing from metadata, **Then** fallback Sonos orange accent is used with no badge
4. **Given** track changes from Spotify → YouTube Music, **Then** badge and accent update within one poll cycle

---

### User Story 4 - Touch-Friendly Controls (Priority: P3)

As a user interacting with a touch-screen wall display, I want larger tap targets, a better volume slider, and optional swipe gestures for next/previous so I can control music without precision clicking.

**Why this priority**: Important for kiosk/wall-mounted use cases but doesn't block other functionality. Currently buttons use standard icon sizes with no touch optimization.

**Independent Test**: On a tablet/touch device (or Chrome DevTools touch simulation), tap play/pause/skip without needing pinpoint accuracy. Swipe left/right on the track area to skip. Drag the volume slider smoothly.

**Acceptance Scenarios**:

1. **Given** a touch-capable viewport, **When** user taps play/pause, **Then** the tap target is ≥44×44px (WCAG 2.5.5 guideline)
2. **Given** fullscreen mode, **When** user swipes left on track art area, **Then** next track is triggered
3. **Given** fullscreen mode, **When** user swipes right on track art area, **Then** previous track is triggered
4. **Given** volume slider in fullscreen, **When** user drags, **Then** the handle is ≥32px wide and responds without lag

---

### User Story 5 - Speaker Group Topology Awareness (Priority: P3)

As a user with stereo pairs and multi-room groups, I want the widget to correctly display group membership, handle topology changes (speakers joining/leaving), and allow basic group management.

**Why this priority**: Group management already works in the fullscreen view (existing `modifyGroup` support). This story is about resilience — when topology changes mid-session, the UI shouldn't break or show stale groups.

**Independent Test**: Start with 2 grouped speakers, remove one from the Sonos app — verify the HomeDash widget updates its group display within one polling cycle without errors.

**Acceptance Scenarios**:

1. **Given** speakers are in a stereo pair, **When** groups are fetched, **Then** the pair is shown as a single logical group with member names
2. **Given** a speaker leaves a group externally (via Sonos app), **When** next group poll fires, **Then** UI updates to reflect new topology
3. **Given** the selected group is dissolved, **Then** widget falls back to the next available group (or shows "no groups")

---

### User Story 6 - Per-Player Volume Control Within Groups (Priority: P4)

As a user with multi-room groups (e.g., Kitchen + Lounge playing together), I want to adjust the volume of each individual speaker independently while still having a master group volume slider, so I can balance audio across rooms — for example, keeping the kitchen quieter than the lounge.

**Why this priority**: The backend API, service layer, and frontend hooks already fully support per-player volume (`GET/POST /api/sonos/players/:playerId/volume`, `useSonosPlayerVolume`, `controls.setPlayerVolume`). The only gap is the UI — no per-player sliders are rendered in the grouping panel. This is a low-risk, high-value UX addition.

**How it works**: The existing group volume slider remains the **master** — Sonos scales all member players proportionally when group volume changes. Per-player sliders allow **balancing** individual speakers within the group. Both operate independently and are native Sonos API concepts.

**Independent Test**: Open a RoomCard grouping panel for a multi-speaker group, verify each player shows its own volume slider. Adjust one player — confirm only that player's volume changes. Adjust the group master — confirm all players scale together.

**Acceptance Scenarios**:

1. **Given** a group with 2+ speakers and the grouping panel is open, **When** UI renders, **Then** each player row shows an individual volume slider with current level
2. **Given** a per-player slider is adjusted, **When** the mutation fires, **Then** only that player's volume changes; other players in the group are unaffected
3. **Given** the group master slider is adjusted, **When** the mutation fires, **Then** all players scale proportionally (Sonos-native behaviour)
4. **Given** a single-speaker group, **When** grouping panel is open, **Then** per-player slider is shown but functionally equivalent to the group slider

---

### Edge Cases

- What happens when Sonos speakers are unreachable (network issue)? → Show last known state with "offline" indicator
- What happens when album art URL is an internal Sonos device URL (local mode)? → Proxy must resolve relative to device IP
- What happens when multiple dashboards poll the same Sonos system? → Backend should share a single poll result (debounce)
- How does the system handle extremely long track names? → Truncate with ellipsis, show full on hover/long-press

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement adaptive polling — slow interval (15-30s) when idle/paused, fast (5s) when playing
- **FR-002**: System MUST proxy album art through a backend endpoint `/api/sonos/art/:hash` with in-memory LRU cache
- **FR-003**: System MUST display the active music service name and apply provider-specific accent colours
- **FR-004**: System MUST ensure all interactive controls meet minimum 44×44px touch target on viewports < 1024px
- **FR-005**: System MUST support swipe gestures (left=next, right=prev) in fullscreen mode on touch devices
- **FR-006**: System MUST handle speaker topology changes gracefully without UI errors
- **FR-007**: System MUST serve a placeholder image when art fetch fails or URL is empty
- **FR-008**: System MUST NOT poll Sonos endpoints when the widget is not visible (browser tab hidden / widget off-screen)
- **FR-009**: System MUST distinguish multiple accounts of the same service (e.g. two Spotify accounts) by parsing the `sn=` parameter from the track URI and displaying a user-configurable label
- **FR-010**: System MUST support UPnP event subscriptions in local mode as the primary state-change mechanism, with polling as automatic fallback when events are unavailable
- **FR-011**: System MUST use a client-side timer to increment displayed track position locally, syncing with the server only on play/pause/seek state changes
- **FR-012**: System MUST display per-player volume sliders in the grouping panel for multi-speaker groups, using the existing `playerVolume` API, independent of the group master volume

### Key Entities

- **ArtCache**: Hash-keyed in-memory LRU map of proxied artwork (key: SHA-256 of source URL, value: Buffer + content-type + timestamp)
- **PollState**: Frontend state machine tracking playback state to determine poll interval
- **TouchGesture**: Swipe detection state (startX, threshold, direction)
- **ServiceTheme**: Unified accent colour/badge config shared between SonosWidget and FullScreenSonos (replaces duplicated `SERVICE_COLORS` / `SERVICE_ACCENTS`)
- **UPnPSubscription**: Backend state for an active UPnP event subscription (deviceId, serviceType, subscriptionId, expiresAt, callbackUrl)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Idle polling rate drops by ≥60% compared to current constant 5s polling
- **SC-002**: Album art requests to external services reduced by ≥90% through cache hits
- **SC-003**: Provider badge displays correctly for Spotify, YouTube Music, Apple Music, TuneIn, Tidal
- **SC-004**: All touch targets pass WCAG 2.5.5 (≥44×44px) on mobile viewports
- **SC-005**: Widget recovers from topology changes without user intervention within 15s
- **SC-006**: Multiple Spotify accounts display distinct user-assigned labels in the provider badge
- **SC-007**: In local mode with UPnP events active, state changes reflect in the UI within 1 second
- **SC-008**: Track position display updates every second without server calls while playing

## Research Findings

> Research completed 2026-05-11. See `files/027-sonos-research.md` for full details.

### Service Detection Map

The following URI patterns are used to identify the active music service from Sonos track metadata:

```
URI prefix / pattern              → Service
──────────────────────────────────────────────
x-file-cifs://                    → NAS/SMB local file
x-rincon-playlist                 → NAS/local playlist
x-sonos-spotify:                  → Spotify
x-rincon-cpcontainer:...?sid=9    → Spotify container
x-sonosapi-radio:spotify:         → Spotify artist radio
x-sonos-http:...?sid=2            → Deezer
x-sonos-http:...?sid=204          → Apple Music
x-sonos-http:...?sid=284          → YouTube Music
x-sonos-http:...?sid=212          → Plex
x-sonosapi-stream:                → Radio stream
x-sonos-htastream:                → TV input (HDMI ARC)
x-rincon-stream:                  → Line-in input
x-rincon:                         → Group audio (following coordinator)
```

### Multiple Spotify Accounts

- Accounts are linked at **household** level; different groups can play different accounts simultaneously
- Account identity is encoded in the track URI as `sn=` parameter: e.g. `x-sonos-spotify:spotify%3atrack%3a{id}?sid=9&flags=8224&sn=7`
- `sn=` values are opaque integers — **no API** exists to list or switch accounts
- Values must be discovered by observing what's playing, then labeled by the user
- **Recommendation**: Parse `sn=` when Spotify is detected, let users map values to friendly names in widget config

### YouTube Music

- Playback control (play/pause/skip/seek) works generically via both cloud and local APIs
- Metadata (title, artist, album, albumArtURI) is returned correctly
- Detected via `sid=284` in track URI, or `service.name: "YouTube Music"` in cloud mode
- **Browsing is not feasible**: SMAPI auth for YT Music is undocumented; no open-source library supports it
- **Recommendation**: Display badge, rely on Sonos Favorites for content selection

### Local NAS Music

- **Already functional** in HomeDash via `GET /api/sonos/library/:type` and ContentDirectory UPnP service
- `x-file-cifs://` URIs for SMB shares; Sonos indexes these natively
- Plex (sid=212) and Jellyfin possible via SMAPI but complex auth — **deferred**

### UPnP Event Subscriptions (from sonos-web reference)

The [sonos-web](https://github.com/sonos-web/sonos-web) project (unmaintained since Sep 2022) uses **UPnP SUBSCRIBE** instead of polling:

1. Backend subscribes to device events via SOAP (`/MediaRenderer/AVTransport/Event`, `/MediaRenderer/RenderingControl/Event`)
2. Sonos pushes state changes to a callback URL on the backend
3. Backend forwards events to frontend via WebSocket (Socket.io)
4. **Result: zero polling** — updates arrive in real-time only when state actually changes

**Key advantages over our current approach:**
- Eliminates all polling traffic (currently: 3 requests every 5s per group when playing)
- Sub-second latency for state changes (vs up to 5s with polling)
- Zero load when nothing changes (vs constant background traffic)

**Complexity tradeoffs:**
- Requires the backend to maintain a persistent HTTP callback server for UPnP NOTIFY
- Subscriptions expire (default 1800s) and must be renewed
- WebSocket layer needed for frontend push
- Only works in **local mode** — cloud API has its own event mechanism (webhooks)
- Device reboots / network changes require re-subscription

**Recommendation**: Add as a new Phase 7 — implement UPnP event subscriptions for local mode, with polling as automatic fallback. This is the single biggest improvement for responsiveness and efficiency.

### Client-Side Track Position Timer

sonos-web uses a client-side `setInterval(1000)` to increment displayed track position locally, only syncing with the server on play/pause/seek events. This reduces server calls for position updates significantly.

**Recommendation**: Fold into Phase 1 (Adaptive Polling) — use local timer for position display, sync on state change.

## Assumptions

- Sonos metadata already reports `track.service.name` — no new API integration needed for provider detection
- Local mode album art URLs are relative to the Sonos device IP and can be proxied server-side
- Swipe gesture detection can be implemented with pointer events (no external gesture library needed)
- The existing `refetchInterval` parameter in TanStack Query hooks supports dynamic values
- Wall-mounted displays are the primary touch use case (large screens, not mobile phones)
- The `node-sonos` library's `Sonos` device class exposes `.on('AVTransport', cb)` for UPnP event subscriptions (verified in `sonos` npm package)
- Multiple Spotify account `sn=` values are stable per linked account — they don't change between sessions
- YouTube Music SMAPI browsing will **not** be implemented; users manage YT Music content via the Sonos app
