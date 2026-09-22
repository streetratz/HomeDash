# 010 — Spotify Widget

## Overview

A Spotify playback widget for HomeDash that lets users authenticate with Spotify, browse/search music, control playback, and select output devices — all from the dashboard. Designed for a wall-mounted home dashboard (think: kitchen speaker controller).

## User Stories

### US1: Spotify Account Connection
As an admin, I can connect my Spotify Premium account via OAuth so the widget can control playback.

### US2: Now Playing Display
As a user, I can see the currently playing track (album art, title, artist, progress) on my dashboard.

### US3: Playback Controls
As a user, I can play, pause, skip next, skip previous, and adjust volume from the widget.

### US4: Device/Speaker Selection
As a user, I can see available Spotify Connect devices and transfer playback to a different speaker.

### US5: Search & Play
As a user, I can search the Spotify catalog and play a track, album, or playlist from search results.

## Requirements

### Authentication
- OAuth2 Authorization Code flow (server-side, not PKCE — we have a backend)
- Scopes needed: `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`, `streaming`
- Tokens stored encrypted in `oauth_accounts` table (reuse existing pattern)
- Auto-refresh expired access tokens via refresh token
- Spotify Premium required (graceful error if free account)

### Backend API Routes
All routes under `/api/spotify/` — require authenticated user.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/spotify/login` | GET | Redirect to Spotify authorization |
| `/api/spotify/callback` | GET | Handle OAuth callback, store tokens |
| `/api/spotify/disconnect` | POST | Remove stored tokens |
| `/api/spotify/now-playing` | GET | Current playback state |
| `/api/spotify/play` | PUT | Resume or play a specific URI |
| `/api/spotify/pause` | PUT | Pause playback |
| `/api/spotify/next` | POST | Skip to next track |
| `/api/spotify/previous` | POST | Skip to previous track |
| `/api/spotify/volume` | PUT | Set volume (0-100) |
| `/api/spotify/devices` | GET | List available Spotify Connect devices |
| `/api/spotify/transfer` | PUT | Transfer playback to a device |
| `/api/spotify/search` | GET | Search tracks/albums/playlists |

### Widget Config Shape
```json
{
  "showAlbumArt": true,
  "defaultDeviceId": "optional-device-id",
  "compactMode": false
}
```

### Widget Display
- **Default view**: Album art (background fill), track title, artist, progress bar, transport controls (prev/play-pause/next), volume slider
- **Compact mode**: Single row — small album art, title/artist, play/pause only
- **No playback state**: Show "Not Playing" with search bar and device picker
- **Not connected**: Show "Connect Spotify" button that triggers OAuth

### Device Picker
- Dropdown/popover listing available Spotify Connect devices
- Show active device with indicator
- Click to transfer playback
- Devices include: speakers, phones, computers, Sonos, Chromecast, etc.

### Search
- Search bar in widget (toggleable)
- Results: tracks, albums, playlists (tabs or combined)
- Click result → plays on current/default device
- Debounced search (300ms)

### Error Handling
- Token expired → auto-refresh, retry once
- No Premium → show clear error message
- No active device → prompt to select one
- Network errors → show inline error, auto-retry
- Rate limiting → respect Spotify 429 + Retry-After header

## Non-Requirements (Out of Scope)
- Sonos direct control (Spotify Connect handles Sonos speakers)
- Queue management
- Playlist creation/editing
- Lyrics display
- Multiple Spotify accounts
- Streaming audio through the browser (we control external devices)

## Environment Variables
```
SPOTIFY_CLIENT_ID=       # From Spotify Developer Dashboard
SPOTIFY_CLIENT_SECRET=   # From Spotify Developer Dashboard
SPOTIFY_REDIRECT_URI=    # e.g., http://homedash.local:3000/api/spotify/callback
```

## Dependencies
- No new npm packages needed — Spotify Web API is simple REST
- Reuses existing: `token-encryption`, `oauth_accounts` table, Fastify route pattern

## Data Model Changes
- Extend `oauth_accounts.provider` to include `'spotify'`
- No new tables needed — widget config goes in `configJson`, tokens in `oauth_accounts`
