# Data Model — Sonos Widget Bug Fixes

**Branch**: `041-sonos-bug-fixes` | **Date**: 2026-06-22

## Table of Contents

- [Entities](#entities)
- [Relationships](#relationships)
- [State Transitions](#state-transitions)
- [Validation Rules](#validation-rules)

---

## Entities

> No new entities are introduced. This section documents the existing entities affected by the bug fixes and clarifies their correct behavior.

### ZoneGroup (Sonos UPnP)

Raw zone group data from the Sonos network topology.

| Field | Type | Description |
|-------|------|-------------|
| ID | string | Zone group identifier (format: `RINCON_xxx:nnn`) |
| Name | string | Group display name (room name of coordinator) |
| ZoneGroupMember | ZoneGroupMember[] | All physical devices in this group |
| CoordinatorDevice() | Sonos | UPnP device handle for the coordinator |

### ZoneGroupMember (Sonos UPnP)

Individual device within a zone group.

| Field | Type | Description |
|-------|------|-------------|
| UUID | string | Unique device identifier (`RINCON_xxxx`) |
| ZoneName | string | Human-readable room name |
| Invisible | string \| undefined | `"1"` if device is invisible (stereo pair partner) |
| Location | string | UPnP device description URL |

### SonosGroup (Application Model)

Transformed group for REST API and frontend consumption.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Zone group ID |
| name | string | Display name |
| coordinatorId | string | UUID of the coordinator device |
| playerIds | string[] | UUIDs of **visible** members only (BUG FIX: was including invisible) |
| playbackState | string | Current playback state enum |

### SonosPlayer (Application Model)

Player device for frontend display.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Device UUID |
| name | string | Room/zone name |
| capabilities | string[] | Device capabilities |
| deviceIds | string[] | Physical device IDs |

### MarqueeState (Frontend — new concept)

Logical state for conditional text animation.

| Field | Type | Description |
|-------|------|-------------|
| overflows | boolean | Whether text content exceeds container width |
| isPlaying | boolean | Whether playback is active |
| shouldAnimate | boolean | Derived: `overflows && isPlaying` |
| content | string | Current text content (track + artist) |
| tolerance | number | Pixel buffer to prevent flickering (default: 4) |

---

## Relationships

```
ZoneGroup 1 ──── * ZoneGroupMember
    │                    │
    │ maps to            │ filtered by Invisible flag
    ▼                    ▼
SonosGroup 1 ──── * SonosPlayer (visible only)
    │
    │ coordinatorId references
    ▼
SonosPlayer (coordinator)
    │
    │ receives volume commands (BUG FIX)
    ▼
Volume State
```

**Key relationships affected by fixes:**

1. **ZoneGroupMember → SonosPlayer**: Only members where `Invisible !== "1"` should produce a SonosPlayer
2. **SonosGroup → Volume Target**: Group volume commands go to `coordinatorId` device only (not all `playerIds`)
3. **SonosGroup.playerIds**: Must contain only visible member UUIDs

---

## State Transitions

### Stereo Pair Visibility

```
[Speaker Configured as Stereo Pair]
    │
    ├── Invisible="1" → EXCLUDED from playerIds, NOT shown as room
    │
    └── Invisible=undefined → INCLUDED in playerIds, shown as room
```

```
[Stereo Pair Split]
    │
    └── Both speakers: Invisible=undefined → Both appear as independent rooms
```

### Volume Command Flow

```
[User adjusts group volume slider]
    │
    ▼
[Frontend: setGroupVolume mutation]
    │
    ▼
[Backend: setGroupVolume(groupId, volume)]
    │
    ├── BEFORE (bug): getMembersForGroup() → set volume on ALL members
    │
    └── AFTER (fix): getCoordinatorForGroup() → set volume on coordinator ONLY
```

### Marquee Animation State

```
                    ┌─────────────────────┐
                    │      STATIC         │
                    │  (no animation)     │
                    └──────┬──────────────┘
                           │
                    text overflows AND isPlaying
                           │
                           ▼
                    ┌─────────────────────┐
                    │     ANIMATING       │
                    │  (marquee scroll)   │
                    └──────┬──────┬───────┘
                           │      │
              track changes│      │ playback pauses
              (key remount)│      │ OR text fits
                           │      │
                           ▼      ▼
                    ┌──────────┐  ┌──────────┐
                    │  RESET   │  │  PAUSED  │
                    │(restart) │  │ (static) │
                    └──────────┘  └──────────┘
```

---

## Validation Rules

| Rule | Entity | Constraint |
|------|--------|------------|
| VR-01 | SonosGroup.playerIds | Must NOT contain UUIDs where ZoneGroupMember.Invisible === "1" |
| VR-02 | SonosGroup | Groups with zero visible members after filtering must be excluded from response |
| VR-03 | setGroupVolume | Volume value must be clamped to [0, 100] |
| VR-04 | setGroupVolume | Must target coordinator device only |
| VR-05 | MarqueeState.tolerance | Must be > 0 to prevent flickering (default: 4px) |
| VR-06 | MarqueeState.shouldAnimate | Must be false when isPlaying is false (FR-008) |
