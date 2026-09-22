# API Contracts — Sonos Library Queue Actions

**Feature**: 042-sonos-library-queue
**Date**: 2026-06-22

## Table of Contents

- [New Endpoints](#new-endpoints)
  - [POST /api/sonos/groups/:groupId/queue/add-container](#post-apisonosgroupsgroupidqueueadd-container)
  - [POST /api/sonos/groups/:groupId/queue/replace](#post-apisonosgroupsgroupidqueuereplace)
- [Modified Behaviour](#modified-behaviour)
  - [Library Sub-Tabs](#library-sub-tabs)
- [Existing Endpoints (unchanged)](#existing-endpoints-unchanged)

---

## New Endpoints

### POST /api/sonos/groups/:groupId/queue/add-container

Add all tracks from a library container to the end of the playback queue.

**Auth**: Required (session cookie + CSRF token)

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| groupId | string | Sonos group identifier |

**Request Body** (`application/json`):

```json
{
  "uri": "x-rincon-playlist:RINCON_xxx#A:ALBUM/Album%20Name",
  "objectId": "A:ALBUM/Album%20Name"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| uri | string | ✅ | Container URI from library browse response |
| objectId | string | ✅ | UPnP ObjectID extracted from URI fragment (used for recursive track resolution) |

**Response** (`200 OK`):

```json
{
  "tracksAdded": 12,
  "totalFound": 12,
  "truncated": false,
  "message": "Added 12 tracks to queue"
}
```

**Error Responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing `uri` or `objectId` | `{ "error": "uri and objectId are required" }` |
| 404 | Group not found | `{ "error": "Group not found" }` |
| 500 | Sonos device error | `{ "error": "Failed to add tracks to queue", "detail": "..." }` |

**Behaviour**:
1. Recursively browse the container via `browseContainer(objectId)` to collect all leaf tracks (type !== container)
2. Enqueue each track to the group's queue in order using `device.queue()`
3. Does NOT interrupt current playback
4. Maximum 1,000 tracks per operation (truncates if exceeded, sets `truncated: true`)

---

### POST /api/sonos/groups/:groupId/queue/replace

Clear the current queue, add all tracks from a container, and start playback.

**Auth**: Required (session cookie + CSRF token)

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| groupId | string | Sonos group identifier |

**Request Body** (`application/json`):

```json
{
  "uri": "x-rincon-playlist:RINCON_xxx#A:ALBUM/Album%20Name",
  "objectId": "A:ALBUM/Album%20Name"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| uri | string | ✅ | Container URI from library browse response |
| objectId | string | ✅ | UPnP ObjectID extracted from URI fragment |

**Response** (`200 OK`):

```json
{
  "tracksAdded": 12,
  "totalFound": 12,
  "truncated": false,
  "message": "Now playing: 12 tracks"
}
```

**Error Responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing `uri` or `objectId` | `{ "error": "uri and objectId are required" }` |
| 404 | Group not found | `{ "error": "Group not found" }` |
| 500 | Clear succeeded but add failed | `{ "error": "Failed to add tracks after clearing queue", "detail": "..." }` |
| 500 | Add succeeded but play failed | `{ "error": "Tracks added but playback failed to start", "detail": "..." }` |
| 500 | General Sonos error | `{ "error": "Failed to replace queue", "detail": "..." }` |

**Behaviour**:
1. Clear the current queue (`device.flush()`)
2. Recursively resolve container tracks (same as add-container)
3. Enqueue all tracks in order
4. Select track 1 and start playback (`device.selectTrack(1)` + `device.play()`)
5. Maximum 1,000 tracks per operation

---

## Modified Behaviour

### Library Sub-Tabs

The library browser now supports 6 sub-tabs (previously 5):

| Sub-Tab | API Type | New? |
|---------|----------|------|
| Folders | `share` | No |
| Artists | `artists` | No |
| Albums | `albums` | No |
| **Genres** | **`genres`** | **Yes** |
| Tracks | `tracks` | No |
| Playlists | `sonos_playlists` | No |

The "Genres" sub-tab uses the existing `GET /api/sonos/library/genres` endpoint which is already functional.

### Container Queue Actions

Container items in the library grid now show the `PlayActionMenu` on hover (previously only tracks had this). The action mapping for containers:

| Action | Endpoint Called |
|--------|---------------|
| Play Now | `POST .../queue/replace` |
| Play Next | N/A — not applicable for containers (hidden) |
| Add to End | `POST .../queue/add-container` |
| Replace Queue | `POST .../queue/replace` |

For tracks, the existing behaviour is unchanged (single-track `queue/add` and `queue/next` endpoints).

---

## Existing Endpoints (unchanged)

These endpoints are used by the feature but require no modifications:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sonos/groups/:groupId/queue` | Read current queue |
| DELETE | `/api/sonos/groups/:groupId/queue` | Clear queue |
| POST | `/api/sonos/groups/:groupId/queue/play` | Jump to track in queue |
| POST | `/api/sonos/groups/:groupId/queue/add` | Add single track |
| POST | `/api/sonos/groups/:groupId/queue/next` | Insert track as "play next" |
| GET | `/api/sonos/library/:type` | Browse library by category |
| GET | `/api/sonos/library/browse` | Browse container contents |
| GET | `/api/sonos/library/:type/search` | Search within category |
| GET | `/api/sonos/playlists` | Get Sonos playlists |
