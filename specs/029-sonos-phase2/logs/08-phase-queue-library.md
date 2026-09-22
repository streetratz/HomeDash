# Phase 8 — Queue Management & Library Navigation

## Summary
Phase 8 implements queue management actions (Play Now / Play Next / Add to End / Replace Queue), container drill-down navigation for the music library, a scalable compact tile grid, infinite scroll, and search/filter capabilities.

## Changes

### Backend
- **sonos-local-service.ts**: Added `playNext()` (insert after current track via SOAP AddURIToQueue), `browseContainer()` (ObjectID-based ContentDirectory browsing), `searchLibrary()` (per-category search), `mapLibraryItem()` helper with artist/album extraction
- **sonos-adapter.ts**: Added adapter wrappers for `playNext()`, `browseContainer()`, `searchLibrary()`
- **sonos.ts**: Added 3 new API routes:
  - `POST /api/sonos/groups/:groupId/queue/next` — play next
  - `GET /api/sonos/library/browse?objectId=...&start=&total=` — ObjectID-based container drill-down
  - `GET /api/sonos/library/:type/search?q=...` — library search
- **sonos.d.ts**: Extended `SonosFavoriteItem` with optional `artist`, `creator`, `album` fields

### Frontend
- **PlayActionMenu.tsx** (new): Dropdown component with 4 queue actions
- **BrowsePanel.tsx**: Complete rewrite of LibraryTab:
  - Folders (share) as default sub-tab
  - Compact responsive tile grid (3→6 columns)
  - Breadcrumb navigation with ObjectID-based drill-down
  - Search input with `useDeferredValue` debounce
  - Infinite scroll via IntersectionObserver (50 items/batch)
  - Track list view for leaf nodes with numbered rows
  - PlayActionMenu on hover for tracks and containers
- **useSonos.ts**: Added hooks:
  - `usePlayNext()` — mutation for play next
  - `useBrowseContainer()` — query hook for ObjectID-based container drill-down
  - `useSearchLibrary()` — query hook for library search
  - Extended `LibraryItem` with `artist` and `album` fields
  - Added `keepPreviousData` to all library hooks for scroll position preservation

## Key Technical Decisions

### ObjectID-based browsing (commit 0bd2b87)
Initial implementation used `searchMusicLibrary()` with separator-based paths, but this double-encoded nested paths and used wrong URI prefixes for shares. Switched to calling `contentDirectoryService().GetResult()` directly with ObjectID extracted from the URI fragment (`uri.split('#')[1]`). This is how sonos-web does it and correctly handles arbitrary nesting depth.

### Container vs Track detection
Changed from checking `artist` field presence (wrong — albums also have artist metadata) to checking URI prefix: `x-rincon-playlist:` = container (browseable), everything else = track (playable).

### Scrollbar consistency (commit 5291f04)
LibraryTab had its own `overflow-y-auto` + `max-h` inside the parent's scroll container, creating double scrollbars. Removed inner container and switched all Sonos panels from `scrollbar-thin scrollbar-thumb-white/10` to `scrollbar-hide` to match the rest of HomeDash.

### Infinite scroll position (commit f988c5c)
When `loadedCount` changed, TanStack Query treated it as a new query key, briefly showing loading state and resetting scroll position. Fixed with `placeholderData: keepPreviousData` on all library hooks.

## API Patterns
- Container drill-down uses `contentDirectoryService().GetResult({ ObjectID, BrowseFlag: 'BrowseDirectChildren' })` directly
- ObjectID extracted from URI fragment: `x-rincon-playlist:RINCON_xxx#A:ARTIST/Name` → `A:ARTIST/Name`
- `StartingIndex` and `RequestedCount` must be strings for the SOAP call
- `playNext()` uses raw SOAP with `EnqueueAsNext: 1` and inserts at `currentTrack + 1`

## Testing
- All 427 backend tests pass
- All 21 frontend tests pass
- Backend + frontend typecheck clean (pre-existing TS4111 in backend #95)
- Frontend builds successfully
