# Phase 4 Log — US4: Speaker Details (T021–T029)

## Summary
Extended speaker discovery to return full device metadata (model, version, serial) and stereo pair detection. Updated frontend speaker card with collapsible details and stereo pair indicators.

## Tasks Completed

| Task | Description | Status |
|------|------------|--------|
| T021 | Unit tests for extended device fields on DiscoveredSpeaker | ✅ |
| T022 | Unit tests for stereo pair detection (StereoPairInfo) | ✅ |
| T023 | Extend `discoverDevices()` to extract model/version/serial from `deviceDescription()` and `getZoneInfo()` | ✅ |
| T024 | Stereo pair detection via `getAllGroups()` zone topology (invisible members) | ✅ |
| T025 | Return all extended fields in `getDiscoveredSpeakers()` | ✅ |
| T026 | Update frontend `DiscoveredSpeaker` type with extended fields | ✅ |
| T027 | Collapsible speaker card with model/version/serial details | ✅ |
| T028 | Stereo pair indicator (🔗 L/R) on speaker card | ✅ |
| T029 | Cloud mode note: "Switch to local mode for full speaker details" | ✅ |

## Files Changed

### Backend
- `backend/src/services/sonos-local-service.ts`
  - `discoverDevices()`: Extract `modelName`, `modelNumber`, `SoftwareVersion`, `SerialNumber`, `HardwareVersion` from device description and zone info
  - `getDiscoveredSpeakers()`: Pass through all extended fields + detect stereo pairs from zone topology
- `backend/tests/unit/sonosDiscovery.test.ts` — 6 TDD tests (type contracts + stereo pair)

### Frontend
- `frontend/src/hooks/useSonos.ts` — Extended `DiscoveredSpeaker` interface (removed stale `host`/`port`, added extended fields + `stereoPair`)
- `frontend/src/components/settings/IntegrationsTab.tsx`
  - Speaker card: collapsible `<details>` with model/version/serial
  - Stereo pair badge (🔗 L/R)
  - Cloud mode hint about local mode for full details
  - Fixed `host:port` → `ip` to match backend API response

## Technical Decisions
- Stereo pair detection: Sonos stereo pairs appear as 2-member groups where one member has `Invisible=true`. The visible member is "left", invisible is "right"
- Used `exactOptionalPropertyTypes`-safe spread pattern for all optional fields
- Best-effort stereo pair detection — failure doesn't block discovery
- Fixed frontend `DiscoveredSpeaker.host`/`port` → `ip` to match actual backend response shape

## Test Results
- 6 new tests in `sonosDiscovery.test.ts` — all passing
- 22 existing tests in `detectService.test.ts` — all passing
- Typecheck clean (only pre-existing errors in restore/backup tests)
