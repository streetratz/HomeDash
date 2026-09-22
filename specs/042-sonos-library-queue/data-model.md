# Data Model — Sonos Library Queue Actions & Sub-Navigation

**Feature**: 042-sonos-library-queue
**Date**: 2026-06-22

## Table of Contents

- [Overview](#overview)
- [Entities](#entities)
- [Relationships](#relationships)
- [State Transitions](#state-transitions)
- [Validation Rules](#validation-rules)

---

## Overview

This feature does not introduce any new persisted database entities. All data flows through runtime interactions between the Sonos device (via node-sonos) and the frontend. The entities below describe the runtime data shapes used by the new queue and library APIs.

---

## Entities

### LibraryItem (existing — no changes)

Represents a single item returned from library browsing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | ✅ | Display name of the item |
| uri | string | ✅ | Sonos URI (e.g., `x-rincon-playlist:RINCON_xxx#A:ALBUM/...` or `x-file-cifs://...`) |
| imageUrl | string | ✅ | Album art URL (may be empty string) |
| metadata | string | ❌ | DIDL-Lite XML metadata for queue operations |
| type | `'container' \| 'track'` | ✅ | Whether item can be drilled into or is a playable leaf |
| artist | string | ❌ | Artist name |
| album | string | ❌ | Album name |

### QueueItem (existing — no changes)

Represents a single track in the playback queue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| trackNumber | number | ✅ | 1-based position in queue |
| title | string | ✅ | Track title |
| artist | string | ✅ | Artist name |
| album | string | ✅ | Album name |
| imageUrl | string | ✅ | Album art URL |
| duration | number | ✅ | Duration in seconds |
| uri | string | ✅ | Sonos track URI |

### ContainerQueueRequest (NEW)

Request body for adding a container's tracks to the queue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| uri | string | ✅ | Container URI from the library browser |
| objectId | string | ✅ | UPnP ObjectID for browsing the container's children (extracted from URI fragment) |

### ContainerQueueResponse (NEW)

Response body for container queue operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tracksAdded | number | ✅ | Number of tracks successfully added to queue |
| totalFound | number | ✅ | Total tracks found in the container |
| truncated | boolean | ✅ | Whether results were capped at the maximum limit |
| message | string | ❌ | Human-readable status message (e.g., "Added 42 tracks to queue") |

### ResolvedTrack (NEW — internal)

Internal type used during container resolution. Not exposed via API.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| uri | string | ✅ | Direct track URI for queuing |
| metadata | string | ❌ | DIDL-Lite metadata if available |
| title | string | ✅ | Track title (for logging/debugging) |

---

## Relationships

```
Library Category (top-level type: artists, albums, genres, tracks, playlists, shares)
  └── LibraryItem (type: container)
        ├── LibraryItem (type: container)  ← nested containers (e.g., artist → albums)
        │     └── LibraryItem (type: track)  ← leaf tracks
        └── LibraryItem (type: track)  ← leaf tracks

Queue (per Sonos group)
  └── QueueItem[]  ← ordered list of tracks for playback
```

- A **Container** can hold other Containers or Tracks (recursive tree)
- The **Queue** is a flat ordered list — container resolution flattens the tree to tracks
- **Library Categories** are the entry points for top-level browsing

---

## State Transitions

### Queue Action State Machine

```
                            ┌─────────────┐
                            │    IDLE      │
                            │ (no action)  │
                            └──────┬───────┘
                                   │ user taps "Add to Queue"
                                   │ or "Replace Queue"
                                   ▼
                            ┌─────────────┐
                            │  RESOLVING   │
                            │ (fetching    │
                            │  tracks)     │
                            └──────┬───────┘
                                   │ tracks resolved
                                   ▼
                            ┌─────────────┐
                            │  ENQUEUING   │
                            │ (adding to   │
                            │  Sonos queue)│
                            └──────┬───────┘
                              ┌────┴────┐
                              ▼         ▼
                       ┌──────────┐  ┌──────────┐
                       │ SUCCESS  │  │  ERROR   │
                       │ (toast)  │  │ (toast)  │
                       └──────────┘  └──────────┘
                              │         │
                              └────┬────┘
                                   ▼
                            ┌─────────────┐
                            │    IDLE      │
                            └─────────────┘
```

### Replace Queue State Machine

```
IDLE → CLEARING → ENQUEUING → STARTING_PLAYBACK → SUCCESS
                                                 ↘ ERROR (at any step)
```

---

## Validation Rules

| Rule | Applies To | Description |
|------|-----------|-------------|
| V-01 | ContainerQueueRequest.uri | Must be a non-empty string |
| V-02 | ContainerQueueRequest.objectId | Must be a non-empty string |
| V-03 | groupId (path param) | Must be a non-empty string; must correspond to a valid Sonos group |
| V-04 | Container resolution | Maximum 1,000 tracks per operation. Truncate beyond this limit. |
| V-05 | Empty container | If container resolves to 0 tracks, return 200 with `tracksAdded: 0` and descriptive message |
| V-06 | Group selection | Frontend must disable queue actions when `groupId` is null (FR-009) |
