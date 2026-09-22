# Phase 7: Polish & Cross-Cutting Concerns

## Summary

Final polish pass across the spec 029 implementation.

## Changes

### T046 — Type exports
- Re-exported `DetectedService`, `DiscoveredSpeaker`, `StereoPairInfo` from `sonos-adapter.ts`

### T047 — Account labels in favorites
- Backend: `getFavorites()` now includes `sn` in service object (from `detectServiceFromUri`)
- Frontend: `SonosFavorite.service` type extended with optional `sn`
- Favorites grid: service color dot shows account label as tooltip (via `useServiceLabels()`)
- Service legend: now shows per-account entries (e.g. "Dad's Spotify" + "Kids Spotify" separately)

### T048 — Test suite
- All 448 tests passing (21 frontend + 427 backend)

### T049 — TypeScript checks
- Frontend: clean
- Backend: 58 pre-existing TS4111 errors in backup/restore tests (#95) — not introduced by this spec

### T050 — ESLint
- Removed 2 lint errors (unnecessary type assertions in favorites)
- Remaining 57 issues all pre-existing

### T051 — Quickstart validation
- Updated browse panel and manual testing sections to match final implementation

### T052 — Logs finalized
- All phases marked complete

## Known Issues (Not Blocking)
- #95: TS4111 errors in backup/restore tests (pre-existing)
- #97: Music Library empty results after NAS sync (Sonos indexing issue)
- `_offsetX` unused var in FullScreenSonos:436 (pre-existing)
