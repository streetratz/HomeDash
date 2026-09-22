# Quickstart — Sonos Phase 2

**Feature**: 029-sonos-phase2
**Date**: 2025-07-25

---

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 8
- HomeDash dev environment running (`pnpm dev`)
- Sonos speakers on the same LAN (for local mode testing)
- At least one music service playing on Sonos (Spotify, YouTube Music, etc.)

## Development Setup

```bash
# From repo root
git checkout 029-sonos-phase2
pnpm install
pnpm dev
```

## Key Files to Modify

### Backend (Phase 1 — Service Detection)

| File | What Changes |
|------|-------------|
| `backend/src/services/sonos-local-service.ts` | `detectServiceFromUri()` returns `DetectedService` object; `CachedDevice` gets new fields; `getDiscoveredSpeakers()` returns extended data |
| `backend/src/services/sonos-adapter.ts` | Passes `sn` and `accountLabel` through metadata response |
| `backend/src/api/sonos.ts` | New `GET/PUT /api/sonos/service-labels` routes; extended `/discover` response |
| `backend/src/types/sonos.d.ts` | Already has `SonosDeviceDescription` and `SonosZoneInfo` types — no changes needed |

### Backend (Phase 2 — Speaker Details)

| File | What Changes |
|------|-------------|
| `backend/src/services/sonos-local-service.ts` | `discoverDevices()` stores device description fields; stereo pair detection via `getAllGroups()` |

### Frontend (Phase 1 — Provider Badge)

| File | What Changes |
|------|-------------|
| `frontend/src/hooks/useSonos.ts` | `SonosMetadata.track.service` type extended with `sn`, `accountLabel` |
| `frontend/src/components/widgets/SonosWidget.tsx` | Provider badge shows `accountLabel` when present |
| `frontend/src/components/sonos/FullScreenSonos.tsx` | Provider badge shows `accountLabel` when present |

### Frontend (Phase 2 — Speaker Details)

| File | What Changes |
|------|-------------|
| `frontend/src/components/settings/SonosWidgetConfig.tsx` | Speaker card expanded with device details, collapsible section, stereo pair indicator |

### Frontend (Phase 3 — Browse Panel)

| File | What Changes |
|------|-------------|
| `frontend/src/components/sonos/BrowsePanel.tsx` | Dynamic service selector (browsable buttons + non-browsable text), Library sub-tabs |

## Testing

```bash
# Run all tests
pnpm test

# Run backend unit tests only
pnpm --filter backend run test:unit

# Run frontend tests only
pnpm --filter frontend run test:unit

# Type checking
pnpm typecheck

# Lint
pnpm lint
```

## Manual Testing Checklist

### Phase 1–7
1. **Multi-account detection**: Play music from two different Spotify accounts on different groups → verify different `sn` values appear in metadata
2. **Account labelling**: Open Settings → assign labels to detected `sn` values → verify badges update
3. **Speaker details**: Open Settings → verify model, software version, serial, hardware version shown for each speaker
4. **Stereo pairs**: If stereo pair exists → verify L/R indicator and partner link
5. **Browse panel**: Open Browse → verify service buttons (Spotify, Library) → non-browsable text (YouTube Music, Radio) → Library sub-tabs (Folders, Artists, Albums, Tracks, Playlists)
6. **Cloud mode**: Switch to cloud mode → verify speaker details show limited info with "local mode required" note
7. **Favorites**: Verify service color dots with account label tooltips on favorites grid

### Phase 8 — Queue Management & Library Navigation
8. **Queue — Play Now**: Browse Library → click a track → select "Play Now" → verify playback starts immediately
9. **Queue — Play Next**: Select "Play Next" on a track → verify it appears next in queue after current track
10. **Queue — Add to End**: Select "Add to End" on a track → verify it appears at end of queue
11. **Queue — Replace Queue**: Select "Replace Queue" on a track → verify queue is cleared and only this track plays
12. **Folder drill-down**: Library → Folders tab → click a share → navigate subfolders → verify tracks at leaf level
13. **Artist drill-down**: Library → Artists tab → click an artist → verify albums shown → click album → verify tracks shown
14. **Album drill-down**: Library → Albums tab → click an album → verify tracks shown in numbered list
15. **Breadcrumb navigation**: While drilled-down → click breadcrumb segments → verify correct navigation back
16. **Infinite scroll**: Browse a large category (Artists with 2.5k+ items) → scroll down → verify more items load without scroll position resetting
17. **Library search**: Type in search box → verify results filter after debounce → clear search → verify full list returns
18. **Folders default**: Open Library tab → verify Folders is the default sub-tab (not Artists)
