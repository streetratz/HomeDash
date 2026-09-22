# Phase 3 Log — US1: Service Detection (T011–T020)

## Summary
Refactored `detectServiceFromUri()` from a simple string return to structured `DetectedService` with service name, sid, sn, and account label resolution. Added TDD tests (22 cases), updated metadata pipeline, and wired account labels into provider badges.

## Tasks Completed
- **T011-T013**: 22 TDD unit tests covering all service types, sn=/sid= extraction, accountLabel resolution
- **T014**: Exported `detectServiceFromUri()`, returns `DetectedService | undefined`
- **T015**: Added `getAccountLabels()` helper — reads from `integration_configs`
- **T016**: Updated `getPlaybackMetadata()` to pass structured service info including sn + accountLabel
- **T017**: Verified adapter pass-through is transparent (no changes needed)
- **T018**: Extended frontend `SonosMetadata` type with `sn` and `accountLabel`
- **T019-T020**: Updated provider badges in `FullScreenSonos.tsx` and `SonosWidget.tsx` to display `accountLabel`

## Key Decisions
- Used spread syntax for optional fields to satisfy `exactOptionalPropertyTypes`
- Account labels use `sn:<number>` key format for storage
- Badge shows `accountLabel` when present, falls back to `accent.label`
- Adapter unchanged — transparent pass-through preserves new fields

## Files Changed
- `backend/src/services/sonos-local-service.ts` — core refactor
- `backend/src/services/sonos-service.ts` — extended track.service type
- `backend/tests/unit/detectService.test.ts` — 22 tests (NEW)
- `frontend/src/hooks/useSonos.ts` — extended types
- `frontend/src/components/sonos/FullScreenSonos.tsx` — accountLabel badge
- `frontend/src/components/widgets/SonosWidget.tsx` — accountLabel badge
