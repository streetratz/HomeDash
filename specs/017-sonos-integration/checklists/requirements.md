# 017 — Sonos Integration Requirements Checklist

## Functional Requirements

- [ ] FR-01 — Store Sonos OAuth credentials in integration_configs table
- [ ] FR-02 — Implement Sonos OAuth flow (authorize → callback → token storage)
- [ ] FR-03 — Auto-refresh Sonos access tokens (24h expiry)
- [ ] FR-04 — List Sonos households for authenticated user
- [ ] FR-05 — List groups (rooms) within a household with player details
- [ ] FR-06 — List all players with name, model, and status
- [ ] FR-07 — Play/pause/skip on a Sonos group via Cloud API
- [ ] FR-08 — Set volume on group and individual player level
- [ ] FR-09 — Bridge logic: route commands to Sonos or Spotify API based on active device
- [ ] FR-10 — Map Sonos player names to Spotify device IDs for playback transfer
- [ ] FR-11 — SonosPanel in Settings with credential form + connect/disconnect
- [ ] FR-12 — Show redirect URI guidance matching Spotify pattern
- [ ] FR-13 — Room-first device picker showing Sonos groups
- [ ] FR-14 — Per-player volume sliders within a group
- [ ] FR-15 — Group/ungroup players (create/modify groups)
- [ ] FR-16 — Mute/unmute per player
- [ ] FR-17 — Event subscriptions for real-time state updates (deferred)

## Non-Functional Requirements

- [ ] NFR-01 — Sonos tokens stored encrypted in SQLite
- [ ] NFR-02 — All Sonos API calls proxied through backend
- [ ] NFR-03 — Graceful degradation: Sonos unavailable → Spotify-only mode
- [ ] NFR-04 — API response time < 2s for control commands
- [ ] NFR-05 — Redirect URI must be HTTPS and publicly routable
- [ ] NFR-06 — No new npm dependencies required

## User Stories

- [ ] US-01 — Connect Sonos Account
- [ ] US-02 — View Sonos Rooms and Speakers
- [ ] US-03 — Control Playback on Sonos Speakers
- [ ] US-04 — Transfer Spotify Playback to Sonos Room
- [ ] US-05 — Group/Ungroup Sonos Speakers
