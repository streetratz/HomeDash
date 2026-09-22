# Spec 029 — Sonos Phase 2: Requirements Checklist

## Phase 1: Service Detection & Provider Badge
- [ ] Enhanced `detectServiceFromUri()` returns structured object `{ service, sid, sn, accountLabel? }`
- [ ] `sn=` extraction from Spotify track URIs for multi-account detection
- [ ] `GET /api/sonos/service-labels` endpoint
- [ ] `PUT /api/sonos/service-labels` endpoint (admin only)
- [ ] Label storage in `integration_configs` (key: `sonos_account_labels`)
- [ ] Provider badge shows account label when available (widget + fullscreen)
- [ ] Auto-discovery surfaces new `sn=` values in settings UI
- [ ] Default label "Account #N" for unlabelled `sn=` values
- [ ] Settings UI for assigning friendly names to `sn=` values

## Phase 2: Speaker Details
- [ ] Fetch UPnP device description XML on discovery
- [ ] Extract: modelName, modelNumber, softwareVersion, serialNum, hardwareVersion
- [ ] Detect stereo pairs from zone topology
- [ ] Extend `GET /api/sonos/discover` response with full device details
- [ ] Speaker card in settings shows all new fields
- [ ] Stereo pair indicator with L/R labels
- [ ] Collapsible detail section in speaker card
- [ ] Cloud mode shows available data with "local mode required" note

## Phase 3: Browse Panel Redesign
- [ ] Service selector dropdown replaces hardcoded tabs
- [ ] Service options derived from: playing service, connected services, static options
- [ ] Spotify sub-tabs: Search + Playlists (existing behaviour preserved)
- [ ] Sonos Favorites view with service badges
- [ ] Optional service filter chips on Favorites
- [ ] Radio tab preserved (TuneIn stations)
- [ ] Library tab preserved (local music)
- [ ] Default selection logic: playing service → Spotify → Favorites
- [ ] Spotify option hidden when not connected
