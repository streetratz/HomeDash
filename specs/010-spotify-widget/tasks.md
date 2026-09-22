# Tasks: Spotify Widget

**Input**: Design documents from `/specs/010-spotify-widget/`
**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: Backend integration tests (TDD — tests before implementation). Manual verification for OAuth flow and Spotify API interaction.

**Organization**: Tasks grouped by phase. Phase 1 is foundational (env + OAuth + service). Phase 2 is backend API proxy. Phase 3 is frontend widget + hooks. Phase 4 is search + polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `backend/src/`, `frontend/src/`, `backend/tests/`, `frontend/tests/`

---

## Phase 1: OAuth & Token Management

**Purpose**: Add Spotify environment config, extend the OAuth provider support, implement the full OAuth2 Authorization Code flow, and create a Spotify API wrapper service with auto-refresh. This is the foundation for all Spotify features.

### Environment & Schema

- [ ] T001 [P] [US1] Add Spotify environment variables to `backend/src/config/env.ts`: Add `SPOTIFY_CLIENT_ID` (z.string().optional()), `SPOTIFY_CLIENT_SECRET` (z.string().optional()), `SPOTIFY_REDIRECT_URI` (z.string().optional()) to the Zod `EnvSchema`. These follow the exact pattern used by `MICROSOFT_CLIENT_ID` / `GOOGLE_CLIENT_ID`.

- [ ] T002 [P] [US1] Extend OAuth provider support for Spotify in `backend/src/db/schema/index.ts`: Update the `oauthAccounts.provider` column enum from `['microsoft', 'google']` to `['microsoft', 'google', 'spotify']`. Update the `OAuthAccount` and `OAuthAccountView` interfaces in `backend/src/services/oauth-service.ts` to include `'spotify'` in the provider union type. Update `getAvailableProviders()` to include `spotify: Boolean(env.SPOTIFY_CLIENT_ID)`. No DB migration needed — SQLite text column has no runtime enum constraint.

### Spotify Service

- [ ] T003 [US1] Create Spotify service in `backend/src/services/spotify-service.ts`:
  - `getSpotifyAccount(userId: string): OAuthAccount | null` — find the spotify-provider row in oauth_accounts for the user
  - `getAccessToken(userId: string): Promise<string>` — get account, check expiry, auto-refresh if needed, return decrypted access token
  - `refreshSpotifyToken(accountId: string): Promise<string>` — POST to `https://accounts.spotify.com/api/token` with grant_type=refresh_token, client_id, client_secret; encrypt and update DB; return new access token
  - `spotifyFetch<T>(userId: string, path: string, options?: RequestInit): Promise<T>` — prepend `https://api.spotify.com/v1` to path, set Authorization header, auto-refresh on 401 and retry once, parse JSON response, throw on non-2xx
  - `exchangeSpotifyCode(code: string, userId: string): Promise<OAuthAccount>` — POST to `https://accounts.spotify.com/api/token` with grant_type=authorization_code; fetch profile from `/v1/me`; encrypt tokens; upsert into oauth_accounts using existing `upsertAccount` pattern (but NO auto-create calendar source — Spotify is not a calendar)
  - `deleteSpotifyAccount(userId: string): void` — find and delete the spotify oauth_account row

### OAuth Routes

- [ ] T004 [US1] Create Spotify API routes in `backend/src/api/spotify.ts` with `registerSpotifyRoutes(app)`:
  - `GET /api/spotify/login` — requireAuth; validate SPOTIFY_CLIENT_ID is configured; generate cryptographic state (32 bytes hex) and store in in-memory pendingStates map (same pattern as auth-oauth.ts); redirect to `https://accounts.spotify.com/authorize` with params: client_id, response_type=code, redirect_uri, scope=`user-read-playback-state user-modify-playback-state user-read-currently-playing`, state, show_dialog=true
  - `GET /api/spotify/callback` — validate state from pendingStates; exchange code via `exchangeSpotifyCode`; redirect to frontend `/settings?connected=spotify`
  - `POST /api/spotify/disconnect` — requireAuth + assertCsrf; call `deleteSpotifyAccount(userId)`; return 204
  - `GET /api/spotify/status` — requireAuth; return `{ connected: boolean, displayName?: string, email?: string }`
  - Register in `backend/src/api/index.ts` by importing and calling `registerSpotifyRoutes(app)`

**Checkpoint**: Spotify OAuth flow works end-to-end. User can log in via Spotify, tokens are stored encrypted. `/api/spotify/status` returns connected state.

---

## Phase 2: Playback & Search Proxy

**Purpose**: Proxy Spotify Web API endpoints through HomeDash backend. All routes require authenticated user with connected Spotify account. Token refresh is handled transparently by `spotifyFetch()`.

### Playback Routes

- [ ] T005 [US2/US3] Add playback routes to `backend/src/api/spotify.ts`:
  - `GET /api/spotify/now-playing` — requireAuth; `spotifyFetch(userId, '/me/player/currently-playing')`; return simplified response: `{ isPlaying, trackName, artistName, albumName, albumArtUrl, progressMs, durationMs, deviceName }` or `{ isPlaying: false }` if nothing playing (204 from Spotify)
  - `PUT /api/spotify/play` — requireAuth + assertCsrf; body: `{ uri?, context_uri?, device_id? }`; PUT to `/me/player/play` with optional device_id query param
  - `PUT /api/spotify/pause` — requireAuth + assertCsrf; PUT to `/me/player/pause`
  - `POST /api/spotify/next` — requireAuth + assertCsrf; POST to `/me/player/next`
  - `POST /api/spotify/previous` — requireAuth + assertCsrf; POST to `/me/player/previous`
  - `PUT /api/spotify/volume` — requireAuth + assertCsrf; body: `{ volume_percent: number }`; PUT to `/me/player/volume?volume_percent={n}`

### Device Routes

- [ ] T006 [US4] Add device routes to `backend/src/api/spotify.ts`:
  - `GET /api/spotify/devices` — requireAuth; GET `/me/player/devices`; return `{ devices: Array<{ id, name, type, isActive, volumePercent }> }`
  - `PUT /api/spotify/transfer` — requireAuth + assertCsrf; body: `{ device_id: string, play?: boolean }`; PUT to `/me/player` with body `{ device_ids: [device_id], play }`

### Search Route

- [ ] T007 [US5] Add search route to `backend/src/api/spotify.ts`:
  - `GET /api/spotify/search` — requireAuth; query params: `q` (required), `type` (default: 'track'), `limit` (default: 10, max 20); GET `/search?q={q}&type={type}&limit={limit}`; return simplified results: tracks as `Array<{ uri, name, artist, album, albumArtUrl, durationMs }>`, albums as `Array<{ uri, name, artist, imageUrl }>`, playlists as `Array<{ uri, name, owner, imageUrl, trackCount }>`

**Checkpoint**: All Spotify playback, device, and search APIs work via HomeDash proxy. Test by connecting Spotify, playing music, and using curl to hit endpoints.

---

## Phase 3: Frontend Widget & Controls

**Purpose**: Build the React widget components and hooks. Widget supports three states: not connected, connected but idle, and now-playing with full controls.

### React Hooks

- [ ] T008 [P] [US1/US2/US3/US4/US5] Create `frontend/src/hooks/useSpotify.ts`:
  - `useSpotifyStatus()` — useQuery for `GET /api/spotify/status`; returns `{ connected, displayName, isLoading }`
  - `useNowPlaying(enabled: boolean)` — useQuery for `GET /api/spotify/now-playing` with `refetchInterval: 5000` when enabled; returns playback state or null
  - `useSpotifyDevices()` — useQuery for `GET /api/spotify/devices`; returns `{ devices, isLoading }`
  - `useSpotifyControls()` — useMutation hooks for play, pause, next, previous, volume, transfer; all invalidate now-playing query on success
  - `useSpotifySearch(query: string, enabled: boolean)` — useQuery for `GET /api/spotify/search?q={query}` with debounced query (300ms); returns `{ tracks, albums, playlists, isLoading }`

### Widget Components

- [ ] T009 [US2/US3/US4] Create `frontend/src/components/widgets/SpotifyWidget.tsx`:
  - **Not connected state**: "Connect Spotify" button that navigates to `/api/spotify/login`
  - **Connected, not playing**: Display user name, device picker, search trigger
  - **Now playing state**: Album art as blurred background fill; foreground: album art thumbnail (rounded), track title (bold), artist name, album name (muted); progress bar (visual, updates with polling); transport controls bar: previous (SkipBack icon), play/pause toggle (Play/Pause icons), next (SkipForward icon); volume slider (Volume2 icon + range input); device indicator showing current device name (click opens device picker popover)
  - Use `useNowPlaying`, `useSpotifyControls`, `useSpotifyDevices` hooks
  - All controls call mutation hooks (no direct fetch)
  - Responsive: adapts to widget container size (compact if < 300px wide)

- [ ] T010 [P] [US1] Create `frontend/src/components/widgets/SpotifyConfigForm.tsx`:
  - Config fields: `showAlbumArt` (boolean toggle, default true), `compactMode` (boolean toggle, default false), `defaultDeviceId` (select from devices list, optional)
  - Show Spotify connection status (green dot + display name if connected, red + "Not connected")
  - "Connect Spotify" / "Disconnect" button (connect opens `/api/spotify/login` in popup; disconnect calls `POST /api/spotify/disconnect`)
  - Follows existing config form pattern: receives `config`, `onChange` props

- [ ] T011 [US2] Register widget in `frontend/src/components/widgets/registry.tsx`:
  - Add `spotify` entry: `type: 'spotify'`, `displayName: 'Spotify'`, `description: 'Music playback controls'`, `icon: Music` (from lucide-react), `defaultConfig: { showAlbumArt: true, compactMode: false }`, `DisplayComponent: SpotifyWidget`, `ConfigFormComponent: SpotifyConfigForm`

**Checkpoint**: Spotify widget can be added to dashboard, shows now-playing, controls playback, switches devices. Config form allows connect/disconnect and display options.

---

## Phase 4: Search & Polish

**Purpose**: Add in-widget search, handle all error states gracefully, and polish the visual experience.

### Search UI

- [ ] T012 [US5] Add search functionality to `SpotifyWidget.tsx`:
  - Search icon in widget header bar (toggles search panel)
  - Search input with debounce (300ms), auto-focus on open
  - Results list: track rows with small album art, title, artist, duration; click row → calls play mutation with track URI
  - Empty state: "Search Spotify…" placeholder
  - No results: "No results found" message
  - Loading: skeleton rows while searching

### Error Handling

- [ ] T013 [US1/US2/US3] Add error handling across Spotify widget:
  - **Token expired mid-session**: `spotifyFetch` auto-refreshes; if refresh fails, show "Reconnect Spotify" button
  - **No Premium account**: Spotify returns 403 with `reason: "PREMIUM_REQUIRED"`; detect and show "Spotify Premium required for playback control"
  - **No active device**: When play/pause fails with "No active device", show device picker prompt
  - **Network errors**: Show inline error toast, auto-retry on next poll cycle
  - **Rate limited (429)**: Respect `Retry-After` header; show temporary "Rate limited, retrying…" indicator

### Visual Polish

- [ ] T014 [US2] Polish SpotifyWidget visuals:
  - Smooth progress bar animation (CSS transition between poll intervals)
  - Loading skeleton while fetching initial playback state
  - Album art dominant color extraction for subtle widget background tinting (optional stretch — CSS blur fallback is fine)
  - Hover states on all interactive controls
  - Transitions when switching between states (not-connected → connected → playing)

**Checkpoint**: Full Spotify widget with search, robust error handling, and polished visuals. Ready for PR review.

---

## Summary

| Phase | Tasks | Key Files |
|-------|-------|-----------|
| 1: OAuth | T001–T004 | `env.ts`, `schema/index.ts`, `spotify-service.ts`, `spotify.ts`, `index.ts` |
| 2: API Proxy | T005–T007 | `spotify.ts` (additional routes) |
| 3: Frontend | T008–T011 | `useSpotify.ts`, `SpotifyWidget.tsx`, `SpotifyConfigForm.tsx`, `registry.tsx` |
| 4: Polish | T012–T014 | Updates to `SpotifyWidget.tsx` |
