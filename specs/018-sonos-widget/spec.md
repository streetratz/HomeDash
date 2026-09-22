# 018 — Sonos Music Widget

## Problem

The current Spotify widget contains deeply embedded Sonos code that tries to bridge two different APIs (Sonos Cloud + Spotify Web API). This creates unreliable behavior — Spotify blocks transfers to restricted Sonos speakers, each Sonos group has its own queue, and the error handling is fragile. Users who primarily use Sonos for home audio need a first-class Sonos experience.

## Solution

Create a **standalone Sonos Music Widget** that uses the Sonos Cloud Control API as the sole control surface. Simultaneously, strip all Sonos code from the existing Spotify widget to establish a clean separation.

## Scope

### In Scope
- New `sonos_music` widget type registered in the widget system
- Room picker (group selector) — switch which Sonos group to control
- Now-playing display: album art, track name, artist, album (from Sonos metadata API)
- Transport controls: play, pause, skip forward, skip back
- Volume control: slider + mute toggle (group volume)
- Playback state indicators: playing, paused, idle, buffering
- Mini-player compact view (similar to current Spotify mini-player)
- Room grouping: add/remove speakers from a group
- Config form: household selector (for multi-household setups)
- Remove all Sonos code from SpotifyWidget.tsx

### Out of Scope
- Sonos favorites / playlist browsing (future enhancement)
- Music service launching from Sonos (requires Sonos Cloud Queue API — complex)
- Sonos events / WebSocket push (deferred, tracked in existing issue)
- Individual player volume (group volume is sufficient for MVP)
- Sonos setup / speaker configuration

## Existing Infrastructure

All backend APIs are already built (spec 017):

| Endpoint | Purpose |
|---|---|
| `GET /api/sonos/status` | Connection status |
| `GET /api/sonos/households` | List households |
| `GET /api/sonos/households/:id/groups` | List groups + players |
| `GET /api/sonos/groups/:id/playback` | Playback state |
| `GET /api/sonos/groups/:id/metadata` | Now-playing metadata |
| `POST /api/sonos/groups/:id/play` | Play |
| `POST /api/sonos/groups/:id/pause` | Pause |
| `POST /api/sonos/groups/:id/next` | Skip next |
| `POST /api/sonos/groups/:id/previous` | Skip previous |
| `GET /api/sonos/groups/:id/volume` | Get group volume |
| `POST /api/sonos/groups/:id/volume` | Set group volume |
| `POST /api/sonos/groups/:id/mute` | Mute/unmute |
| `POST /api/sonos/groups/modify` | Add/remove players |

All TanStack Query hooks exist in `frontend/src/hooks/useSonos.ts`:
- `useSonosStatus`, `useSonosHouseholds`, `useSonosGroups`
- `useSonosPlaybackState`, `useSonosMetadata`, `useSonosGroupVolume`
- `useSonosControls` (play, pause, next, previous, volume, mute mutations)

## UI Design

### Full View (≥ 2×2 grid cells)
```
┌──────────────────────────────────────────┐
│ 🔊 Office          ▾  [🔊] [⊕ Group]    │
├──────────────────────────────────────────┤
│                                          │
│   ┌──────┐  Track Name                   │
│   │ Art  │  Artist Name                  │
│   │      │  Album Name                   │
│   └──────┘                               │
│                                          │
│       ⏮    ▶/⏸    ⏭                     │
│                                          │
│   🔈 ━━━━━━━━━━━●━━━━━━ 🔊  65%         │
└──────────────────────────────────────────┘
```

### Compact/Mini View (1-column)
```
┌──────────────────────────────┐
│ ┌────┐ Track  ⏮ ▶ ⏭  🔊 ▾  │
│ │Art │ Artist               │
│ └────┘                      │
└──────────────────────────────┘
```

### States
- **Not connected**: "Connect Sonos in Settings" CTA
- **Connected, idle**: Room picker visible, "Nothing playing" message
- **Connected, playing**: Full now-playing display
- **Connected, paused**: Same as playing but with ⏸ indicator

## Implementation Plan

### Phase 1: Widget Skeleton & Registration
1. Create `frontend/src/components/widgets/SonosWidget.tsx`
2. Create `frontend/src/components/widgets/SonosWidgetConfig.tsx`
3. Register `sonos_music` in widget registry (`registry.tsx`)
4. Add config schema to `backend/src/lib/validation.ts`

### Phase 2: Core Widget UI
1. Room picker dropdown (reuse existing SonosRoomPicker pattern)
2. Now-playing display using `useSonosMetadata` hook
3. Transport controls using `useSonosControls` hook
4. Volume slider using `useSonosGroupVolume` hook
5. Playback state polling (reuse existing 5s interval)

### Phase 3: Room Grouping
1. Group management UI — show speakers in current group
2. Add/remove speakers using `POST /api/sonos/groups/modify`
3. Visual indicator for grouped speakers

### Phase 4: Clean Up Spotify Widget
1. Remove all Sonos imports, state, and logic from `SpotifyWidget.tsx`
2. Remove `SonosRoomPicker` component from SpotifyWidget
3. Remove Sonos transport fallback logic (`isSonosFallbackError`, etc.)
4. Remove `useSonos.ts` imports from SpotifyWidget
5. Spotify widget becomes purely Spotify Connect focused

### Phase 5: Screensaver Integration
1. Update screensaver now-playing to source from Sonos widget when active
2. Falls back to Spotify when no Sonos playback

## Config Schema

```typescript
// Widget config — stored in app_widget_instances.configJson
interface SonosWidgetConfig {
  householdId?: string;  // auto-detect if only one household
  defaultGroupId?: string;  // remember last selected room
  showGrouping?: boolean;  // show room grouping controls (default: true)
  compactMode?: boolean;  // force compact layout
}
```

## Error Handling

| Error | Behavior |
|---|---|
| Not connected | Show "Connect Sonos" CTA |
| `PLAYBACK_NO_CONTENT` | Show "Nothing playing" — no error toast |
| `DISALLOWED_BY_POLICY` | Suppress — Spotify owns session, controls may not work |
| Network error | Toast "Sonos unreachable" |
| Group not found | Auto-refresh groups |
| Rate limit | Toast "Please wait" + back off polling |
