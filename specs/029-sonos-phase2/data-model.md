# Data Model — Sonos Phase 2

**Feature**: 029-sonos-phase2
**Date**: 2025-07-25

---

## Table of Contents

- [Entities](#entities)
- [Storage Format](#storage-format)
- [Type Definitions](#type-definitions)

---

## Entities

### DetectedService (new structured return)

Replaces the current `string | undefined` return from `detectServiceFromUri()`.

| Field        | Type                 | Description                                            |
|--------------|----------------------|--------------------------------------------------------|
| service      | `string`             | Service display name (e.g., "Spotify", "YouTube Music")|
| sid          | `number \| undefined`| Sonos service ID from `sid=` parameter                 |
| sn           | `number \| undefined`| Sonos service number from `sn=` parameter              |
| accountLabel | `string \| undefined`| Friendly label from config (e.g., "Dad's Spotify")     |

### AccountLabel (persisted in integration_configs)

Stored as JSON in `integration_configs` where `provider='sonos'`, `key='account_labels'`.

| Field       | Type     | Description                                           |
|-------------|----------|-------------------------------------------------------|
| snKey       | `string` | Key format: `"sn:<number>"` (e.g., `"sn:7"`)         |
| label       | `string` | User-assigned friendly name (e.g., "Dad's Spotify")   |

**JSON shape**: `Record<string, string>` — e.g., `{"sn:7": "Dad's Spotify", "sn:12": "Kid's Spotify"}`

### DiscoveredSpeaker (extended)

Extends the existing `DiscoveredSpeaker` interface at `sonos-local-service.ts:727-731`.

| Field           | Type                          | Description                              |
|-----------------|-------------------------------|------------------------------------------|
| uuid            | `string`                      | Sonos device UUID (existing)             |
| name            | `string`                      | Room name (existing)                     |
| ip              | `string`                      | IP address (existing)                    |
| model           | `string \| undefined`         | Model name (e.g., "Sonos One")           |
| modelNumber     | `string \| undefined`         | Model number (e.g., "S13")              |
| softwareVersion | `string \| undefined`         | Software version string                  |
| serialNumber    | `string \| undefined`         | Hardware serial number                   |
| hardwareVersion | `string \| undefined`         | Hardware revision                        |
| stereoPair      | `StereoPairInfo \| undefined` | Stereo pair details if paired            |

### StereoPairInfo (new)

| Field       | Type                   | Description                            |
|-------------|------------------------|----------------------------------------|
| role        | `'left' \| 'right'`   | Channel role in stereo pair            |
| partnerUuid | `string`               | UUID of the paired partner speaker     |

### BrowseService (new, frontend-only)

Represents a service option in the Browse panel service selector.

| Field       | Type      | Description                                          |
|-------------|-----------|------------------------------------------------------|
| id          | `string`  | Unique key (e.g., `"spotify"`, `"favorites"`)        |
| label       | `string`  | Display name (e.g., `"Spotify"`, `"Sonos Favorites"`)|
| available   | `boolean` | Whether this service can currently browse             |
| hasSubTabs  | `boolean` | Whether the service has sub-tab navigation            |

---

## Storage Format

### integration_configs row

No new tables. Uses the existing `integration_configs` table:

```
provider: 'sonos'
key:      'account_labels'
value:    '{"sn:7":"Dad'\''s Spotify","sn:12":"Kid'\''s Spotify"}'
updatedAt: ISO 8601 timestamp
```

### CachedDevice extension (in-memory)

The existing `CachedDevice` interface (in-memory `Map<string, CachedDevice>`) is extended with additional fields from `deviceDescription()` and `getZoneInfo()`:

```typescript
interface CachedDevice {
  device: Sonos;           // existing
  ip: string;              // existing
  name: string;            // existing
  uuid: string;            // existing
  // New fields:
  model?: string;
  modelNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  hardwareVersion?: string;
}
```

---

## Type Definitions

### Backend — DetectedService

```typescript
// sonos-local-service.ts
interface DetectedService {
  service: string;
  sid?: number;
  sn?: number;
  accountLabel?: string;
}
```

### Backend — Extended DiscoveredSpeaker

```typescript
// sonos-local-service.ts
export interface DiscoveredSpeaker {
  uuid: string;
  name: string;
  ip: string;
  model?: string;
  modelNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  hardwareVersion?: string;
  stereoPair?: {
    role: 'left' | 'right';
    partnerUuid: string;
  };
}
```

### Frontend — Service metadata extension

```typescript
// useSonos.ts — track.service extended
service?: {
  name?: string;
  id?: string;
  sn?: number;           // new
  accountLabel?: string;  // new
}
```

### Frontend — BrowseService

```typescript
// BrowsePanel.tsx
interface BrowseService {
  id: string;
  label: string;
  available: boolean;
  hasSubTabs: boolean;
}
```
