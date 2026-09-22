# 017 — Sonos Integration

## Overview

Integrate the **official Sonos Cloud Control API** (developer.sonos.com) into HomeDash to enable full control of Sonos speakers — volume, playback, room grouping — bypassing the Spotify Connect "restricted device" limitation (403 errors on Sonos speakers via Spotify Web API).

## Problem Statement

HomeDash has a working Spotify integration for browsing music, viewing now-playing, and controlling playback. However, Sonos speakers appear as "restricted" devices in the Spotify Web API — all control commands (play/pause/skip/volume) return HTTP 403. This blocks the primary use case: controlling music on Sonos speakers throughout the house from a wall-mounted touch dashboard.

## Solution: Dual-API Bridge Architecture

Use **Spotify** for music intelligence (track selection, playlists, search, now-playing metadata) and the **official Sonos Cloud API** for speaker control (volume, transport, grouping). A bridge layer in the backend routes commands to the correct API based on whether the active device is a Sonos speaker.

```
[Dashboard UI]
      ↓
[HomeDash Backend]
   ↓                  ↓
Spotify Web API       Sonos Cloud Control API
   ↓                  (api.ws.sonos.com/control/api/v1)
Track/Playlist        ↓
Selection +           Volume, Play/Pause, Grouping,
Now-Playing           Room Control, Households
```

### Smart Routing Logic

```
User action (e.g., Play, Volume) →
  Is active device a Sonos speaker?
    YES → route through Sonos Cloud API ✅ (bypasses 403)
    NO  → route through Spotify API (works for non-restricted devices)
```

## User Stories

### US-01: Connect Sonos Account
**As a** HomeDash admin, **I want to** connect my Sonos account via OAuth, **so that** the dashboard can control my Sonos speakers.

**Acceptance Criteria:**
- Admin enters Sonos Client ID + Secret in Settings → Integrations
- Clicking "Connect" initiates OAuth flow to Sonos login service
- After authorization, tokens are stored securely in the database
- Connection status shows household name and player count
- Admin can disconnect at any time

### US-02: View Sonos Rooms and Speakers
**As a** user, **I want to** see all my Sonos rooms/groups and individual speakers, **so that** I can choose where to play music.

**Acceptance Criteria:**
- Dashboard shows all Sonos groups (rooms) with their players
- Idle speakers are visible (unlike Spotify's device list)
- Each room shows current volume level
- Groups with multiple players show per-player volume

### US-03: Control Playback on Sonos Speakers
**As a** user, **I want to** play/pause/skip tracks on any Sonos room, **so that** I can control music without the 403 restriction.

**Acceptance Criteria:**
- Play/pause/next/previous work on any Sonos group
- Commands route through Sonos API (not Spotify) when target is Sonos
- Volume control works per-group and per-player
- No "restricted device" errors

### US-04: Transfer Spotify Playback to Sonos Room
**As a** user, **I want to** select a Sonos room and have Spotify start playing there, **so that** I get a "room-first" experience.

**Acceptance Criteria:**
- Tapping a Sonos room transfers Spotify playback to that speaker
- Bridge maps Sonos player names ↔ Spotify device IDs
- If Sonos speaker isn't visible in Spotify devices list, show guidance
- Subsequent controls route through Sonos API

### US-05: Group/Ungroup Sonos Speakers
**As a** user, **I want to** add or remove speakers from a group, **so that** I can play music in multiple rooms simultaneously.

**Acceptance Criteria:**
- UI shows group membership for each room
- Can add a player to an existing group
- Can remove a player from a group (creates its own group)
- Volume adjusts independently per player within a group

## Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-01 | Store Sonos OAuth credentials (client_id, client_secret) in integration_configs table | P1 |
| FR-02 | Implement Sonos OAuth flow (authorize → callback → token storage) | P1 |
| FR-03 | Auto-refresh Sonos access tokens (24h expiry) | P1 |
| FR-04 | List Sonos households for authenticated user | P1 |
| FR-05 | List groups (rooms) within a household with player details | P1 |
| FR-06 | List all players with name, model, and status | P1 |
| FR-07 | Play/pause/skip on a Sonos group via Cloud API | P1 |
| FR-08 | Set volume on group and individual player level | P1 |
| FR-09 | Bridge logic: route commands to Sonos or Spotify API based on active device | P1 |
| FR-10 | Map Sonos player names to Spotify device IDs for playback transfer | P1 |
| FR-11 | SonosPanel in Settings with credential form + connect/disconnect | P1 |
| FR-12 | Show redirect URI guidance matching Spotify pattern | P1 |
| FR-13 | Room-first device picker showing Sonos groups | P2 |
| FR-14 | Per-player volume sliders within a group | P2 |
| FR-15 | Group/ungroup players (create/modify groups) | P2 |
| FR-16 | Mute/unmute per player | P2 |
| FR-17 | Event subscriptions for real-time state updates | P3 |

## Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NFR-01 | Sonos tokens stored encrypted in SQLite (same as Spotify) |
| NFR-02 | All Sonos API calls proxied through backend (no client-side secrets) |
| NFR-03 | Graceful degradation: Sonos unavailable → Spotify-only mode still works |
| NFR-04 | API response time < 2s for control commands |
| NFR-05 | Redirect URI must be HTTPS and publicly routable |
| NFR-06 | No new npm dependencies required (standard HTTP client) |

## Sonos Cloud API Reference

### Authentication
- **Auth URL**: `https://api.sonos.com/login/v3/oauth`
- **Token URL**: `https://api.sonos.com/login/v3/oauth/access`
- **Scope**: `playback-control-all`
- **Auth header**: `Basic {base64(client_id:client_secret)}`
- **Token expiry**: 24 hours
- **Refresh**: `grant_type=refresh_token`

### Control API Base URL
`https://api.ws.sonos.com/control/api/v1`

### Key Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/households` | GET | List user's households |
| `/households/{id}/groups` | GET | List groups + players |
| `/groups/{id}/playback/play` | POST | Start playback |
| `/groups/{id}/playback/pause` | POST | Pause playback |
| `/groups/{id}/playback/skipToNextTrack` | POST | Next track |
| `/groups/{id}/playback/skipToPreviousTrack` | POST | Previous track |
| `/groups/{id}/groupVolume` | GET/POST | Group volume |
| `/players/{id}/playerVolume` | GET/POST | Player volume |
| `/households/{id}/groups/createGroup` | POST | Create group |
| `/groups/{id}/groups/modifyGroupMembers` | POST | Add/remove players |

### Key Concepts
- **Household**: `householdId` — stable unless players move networks
- **Group**: `groupId` — ephemeral, changes when players regroup
- **Player**: `playerId` — permanent, tied to MAC address
- Playback commands target **groups**, not individual players
- Volume can be set per-group or per-player

## Implementation Phases

### Phase 1: Backend Service + OAuth
- `sonos-service.ts` — OAuth flow, token management, API wrappers
- Reuse `integrationConfigs` table for credential + token storage
- Token auto-refresh on 401 responses

### Phase 2: API Routes
- `backend/src/api/sonos.ts` — REST endpoints matching above table
- Same auth guards as Spotify routes (requireAuth + CSRF)

### Phase 3: Spotify↔Sonos Bridge
- Device name mapping logic
- Smart routing: Sonos API for Sonos devices, Spotify API for others
- Playback transfer via Spotify `PUT /me/player`

### Phase 4: Settings Panel
- SonosPanel component (mirrors SpotifyPanel)
- Credential config, redirect URI guidance, connect/disconnect

### Phase 5: Room-First Widget UI
- RoomPicker replacing DevicePicker when Sonos connected
- Per-group and per-player volume
- Group management UI

### Phase 6: Event Subscriptions (Deferred)
- Real-time updates via Sonos event system
- Requires publicly routable callback URL

## Out of Scope
- Local/LAN Sonos control (UPnP/SOAP) — using official Cloud API instead
- Sonos favorites/playlists browsing — using Spotify for music selection
- Multi-household support — single household assumed for MVP
- Sonos alarm/sleep timer management
