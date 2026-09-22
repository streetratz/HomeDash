# Phase 6: US3 — Browse Panel Redesign

**Status**: ✅ Complete  
**Tasks**: T038–T045, T053–T054  
**Branch**: `029-sonos-phase2`

---

## Summary

Redesigned the Sonos browse panel from hardcoded tabs to a dynamic service selector with browsable/non-browsable classification. Added Library sub-tab navigation for full music library browsing.

## Key Design Decisions

### Favorites Removed from Browse
The original spec included "Sonos Favorites" as a browse service. During implementation, the user identified this duplicates the existing Favorites tab in the right panel. Removed to avoid confusion.

### Radio & YouTube Music → Non-Browsable
- **Radio (TuneIn)**: `getFavoritesRadioStations()` only returns user-favorited stations — these already appear in the Favorites tab. No radio directory/browse/search API exists in `node-sonos`.
- **YouTube Music**: Sonos treats as cast-only with no browse/search API available.
- Both rendered as plain dimmed text: `"YouTube Music · Radio — Sonos app only"` instead of disabled buttons.

### Service Selector: Buttons, Not Dropdown
User preferred inline buttons over a dropdown. Browsable services (Spotify, Library) render as toggle buttons. Non-browsable services render as a subtle text line below.

### Library Sub-Tabs
Added Artists/Albums/Tracks/Playlists sub-navigation using existing `useMusicLibrary(type)` hook and `GET /api/sonos/library/:type` endpoint. Backend already supported all types.

### Default Service Fallback
Changed from `'favorites'` → `'library'` as the default fallback when no browsable service is currently playing.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/sonos/BrowsePanel.tsx` | Major refactor: removed RadioTab, added Library sub-tabs, split service selector into browsable/non-browsable |
| `frontend/tests/unit/browseServices.test.ts` | Updated 12 tests for new service logic (browsable flags, library default) |

## Test Results

- 12/12 browse service unit tests passing
- TypeScript typecheck clean (excluding pre-existing TS4111 in test files — #95)
- Frontend build succeeds
- ESLint clean (excluding pre-existing `_offsetX` unused var)

## Known Issues

- **#97**: Music Library API returns empty results after NAS sync — needs investigation (likely NAS indexing not complete or `node-sonos` `getMusicLibrary()` parsing issue)
