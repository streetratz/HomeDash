# 010 — Spotify Widget: Implementation Plan

## Approach

Build in 4 phases, each independently testable. The backend OAuth + proxy layer comes first since the frontend widget depends on it entirely.

---

## Phase 1: Backend — OAuth & Token Management

**Goal**: User can connect/disconnect Spotify account; tokens stored encrypted.

### Tasks

**T1: Environment config**
- Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` to `backend/src/config/env.ts` (Zod schema, all optional)

**T2: Extend OAuth provider enum**
- Add `'spotify'` to the provider column in `oauth_accounts` schema (`backend/src/db/schema/index.ts`)
- Migration if needed (SQLite text column — may just work without migration)

**T3: Spotify OAuth routes**
- Create `backend/src/api/spotify.ts` with `registerSpotifyRoutes(app)`
- `GET /api/spotify/login` — generate state, build Spotify authorize URL, redirect
- `GET /api/spotify/callback` — exchange code for tokens, encrypt, store in `oauth_accounts`
- `POST /api/spotify/disconnect` — delete Spotify entry from `oauth_accounts`
- `GET /api/spotify/status` — return connected/disconnected + display name
- Register in `backend/src/api/index.ts`

**T4: Spotify token refresh utility**
- Create `backend/src/services/spotify-service.ts`
- `getSpotifyTokens(userId)` — fetch + decrypt from DB
- `refreshIfNeeded(userId)` — check expiry, refresh via Spotify API, update DB
- `spotifyFetch(userId, url, options)` — authenticated fetch wrapper with auto-refresh

### Verification
- Start backend, hit `/api/spotify/login` → redirects to Spotify
- Complete OAuth flow → tokens appear encrypted in DB
- `/api/spotify/status` returns connected with display name

---

## Phase 2: Backend — Playback & Search Proxy

**Goal**: Frontend can control Spotify playback via HomeDash API.

### Tasks

**T5: Playback control routes**
- `GET /api/spotify/now-playing` — proxy to Spotify `GET /v1/me/player/currently-playing`
- `PUT /api/spotify/play` — body: `{ uri?, context_uri?, device_id? }`
- `PUT /api/spotify/pause`
- `POST /api/spotify/next`
- `POST /api/spotify/previous`
- `PUT /api/spotify/volume` — body: `{ volume_percent: 0-100 }`
- All use `spotifyFetch()` wrapper with auto-refresh

**T6: Device routes**
- `GET /api/spotify/devices` — list Spotify Connect devices
- `PUT /api/spotify/transfer` — body: `{ device_id, play?: boolean }`

**T7: Search route**
- `GET /api/spotify/search?q=...&type=track,album,playlist&limit=10`
- Proxy to Spotify search API, return simplified results

### Verification
- Connect Spotify, play music on phone
- `GET /api/spotify/now-playing` returns track info
- `PUT /api/spotify/pause` pauses playback
- `GET /api/spotify/search?q=radiohead` returns results

---

## Phase 3: Frontend — Widget Display & Controls

**Goal**: Spotify widget renders on dashboard with now-playing and controls.

### Tasks

**T8: Spotify hooks**
- Create `frontend/src/hooks/useSpotify.ts`
- `useSpotifyStatus()` — is connected?
- `useNowPlaying(pollMs)` — poll now-playing endpoint (5s interval)
- `useSpotifyDevices()` — fetch device list
- `useSpotifyControls()` — play/pause/next/prev/volume mutations

**T9: SpotifyWidget component**
- Create `frontend/src/components/widgets/SpotifyWidget.tsx`
- States: not-connected → connect button, connected-no-playback → search + device picker, playing → full now-playing UI
- Album art as background (blurred) + foreground
- Track title, artist name
- Progress bar (visual only — updates via polling)
- Transport controls: prev, play/pause, next
- Volume slider
- Device indicator (click to open picker)

**T10: SpotifyConfigForm**
- Create `frontend/src/components/widgets/SpotifyConfigForm.tsx`
- Toggle: show album art background
- Toggle: compact mode
- Default device selector (populated from devices endpoint)
- Connect/disconnect Spotify button

**T11: Register widget**
- Add `'spotify'` entry to `frontend/src/components/widgets/registry.tsx`
- DisplayComponent, ConfigFormComponent, defaultConfig, icon (Music from lucide)

### Verification
- Add Spotify widget to dashboard
- See now-playing, control playback
- Switch devices from widget
- Compact mode works

---

## Phase 4: Frontend — Search & Polish

**Goal**: Search, play from results, visual polish.

### Tasks

**T12: Search UI**
- Search bar (toggleable via icon in widget header)
- Debounced input (300ms)
- Results: track list with album art thumbnails, artist, duration
- Click → play on current device
- Albums / playlists show as cards (optional, tracks first)

**T13: Error states & edge cases**
- Token expired mid-session → auto-refresh + retry
- No Premium → clear error message with link
- No active device → "Select a device" prompt
- Spotify rate limit (429) → backoff + retry indicator
- Empty search results → helpful message

**T14: Visual polish**
- Album art color extraction for dynamic widget tinting (stretch)
- Smooth progress bar animation between polls
- Responsive layout for different widget sizes
- Loading skeletons during API calls

### Verification
- Search "radiohead" → see results → click → plays
- Disconnect Spotify → widget shows connect button
- All error states display correctly

---

## File Inventory

### New Files
| File | Purpose |
|------|---------|
| `backend/src/api/spotify.ts` | OAuth + playback + search routes |
| `backend/src/services/spotify-service.ts` | Token management + Spotify API wrapper |
| `frontend/src/hooks/useSpotify.ts` | React hooks for Spotify state/controls |
| `frontend/src/components/widgets/SpotifyWidget.tsx` | Widget display component |
| `frontend/src/components/widgets/SpotifyConfigForm.tsx` | Widget config form |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/config/env.ts` | Add Spotify env vars |
| `backend/src/db/schema/index.ts` | Extend provider enum (if needed) |
| `backend/src/api/index.ts` | Register Spotify routes |
| `frontend/src/components/widgets/registry.tsx` | Register spotify widget type |

### No Migration Needed
The `oauth_accounts.provider` column is a plain `text()` in SQLite — no enum constraint, so `'spotify'` just works.

---

## Risk & Notes

- **Spotify Premium required** — free accounts get 403 on playback endpoints. Detect early and show clear message.
- **Polling vs WebSocket** — Spotify doesn't offer WebSocket for playback state. We poll every 5s. Good enough for a dashboard.
- **Rate limits** — Spotify allows ~180 requests/minute per user. 5s polling = 12/min, well under limit.
- **Device goes idle** — Spotify devices disappear after ~30min of inactivity. Device picker should refresh on open.
- **No new npm packages** — pure REST via fetch, tokens via existing encryption utils.
