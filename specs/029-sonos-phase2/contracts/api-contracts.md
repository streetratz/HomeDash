# API Contracts — Sonos Phase 2

**Feature**: 029-sonos-phase2
**Date**: 2025-07-25

---

## Table of Contents

- [New Endpoints](#new-endpoints)
- [Modified Endpoints](#modified-endpoints)
- [Metadata Response Changes](#metadata-response-changes)

---

## New Endpoints

### GET /api/sonos/service-labels

**Auth**: Required (any authenticated user)
**Description**: Get the account label mappings for multi-account service detection.

**Response** `200`:

```json
{
  "labels": {
    "sn:7": "Dad's Spotify",
    "sn:12": "Kid's Spotify"
  }
}
```

**Response** (no labels configured) `200`:

```json
{
  "labels": {}
}
```

---

### PUT /api/sonos/service-labels

**Auth**: Required (admin only — `requireAdmin`)
**Description**: Save account label mappings. Full replacement (not merge).

**Request body** (Zod validated):

```json
{
  "labels": {
    "sn:7": "Dad's Spotify",
    "sn:12": "Kid's Spotify"
  }
}
```

**Validation rules**:
- `labels`: `z.record(z.string(), z.string().min(1).max(100))`
- Keys must match pattern `sn:<digits>`: `z.string().regex(/^sn:\d+$/)`
- Max 50 entries (reasonable upper bound)

**Response** `200`:

```json
{
  "labels": {
    "sn:7": "Dad's Spotify",
    "sn:12": "Kid's Spotify"
  }
}
```

**Error** `400` (invalid key format):

```json
{
  "error": "Invalid label key format. Expected 'sn:<number>'."
}
```

---

## Modified Endpoints

### GET /api/sonos/discover (extended response)

**Auth**: Required (existing)
**Description**: Extended to include full device details and stereo pair information.

**Current response**:

```json
{
  "speakers": [
    { "uuid": "RINCON_xxx", "name": "Living Room", "ip": "192.168.1.50" }
  ]
}
```

**New response**:

```json
{
  "speakers": [
    {
      "uuid": "RINCON_xxx",
      "name": "Living Room",
      "ip": "192.168.1.50",
      "model": "Sonos One",
      "modelNumber": "S13",
      "softwareVersion": "16.2-78500",
      "serialNumber": "xx-xx-xx-xx-xx:x",
      "hardwareVersion": "1.21.1.8-2",
      "stereoPair": null
    },
    {
      "uuid": "RINCON_yyy",
      "name": "Office Left",
      "ip": "192.168.1.51",
      "model": "Sonos One",
      "modelNumber": "S13",
      "softwareVersion": "16.2-78500",
      "serialNumber": "yy-yy-yy-yy-yy:y",
      "hardwareVersion": "1.21.1.8-2",
      "stereoPair": {
        "role": "left",
        "partnerUuid": "RINCON_zzz"
      }
    }
  ]
}
```

**Backward compatibility**: All new fields are optional (`| undefined` / `null`). Existing consumers that only read `uuid`, `name`, `ip` are unaffected.

---

## Metadata Response Changes

### GET /api/sonos/groups/:groupId/metadata (extended track.service)

**Auth**: Required (existing)
**Description**: The `track.service` object in the metadata response is extended with `sn` and `accountLabel` fields.

**Current `track.service`**:

```json
{
  "service": { "name": "Spotify" }
}
```

**New `track.service`**:

```json
{
  "service": {
    "name": "Spotify",
    "sn": 7,
    "accountLabel": "Dad's Spotify"
  }
}
```

**Field details**:
- `sn` (`number | undefined`): Raw Sonos service number; present only when `sn=` was detected in the track URI.
- `accountLabel` (`string | undefined`): Friendly label from `integration_configs`; present only when a label has been assigned for this `sn` value.

**Backward compatibility**: Both new fields are optional. Frontend code that reads `track.service.name` is unaffected.
