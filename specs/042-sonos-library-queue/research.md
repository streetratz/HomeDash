# Research — Sonos Library Queue Actions & Sub-Navigation

**Feature**: 042-sonos-library-queue
**Date**: 2026-06-22

## Table of Contents

- [R-01: Container Track Resolution Strategy](#r-01-container-track-resolution-strategy)
- [R-02: node-sonos Queue API Capabilities](#r-02-node-sonos-queue-api-capabilities)
- [R-03: Replace Queue Atomicity](#r-03-replace-queue-atomicity)
- [R-04: Genres Sub-Tab Support](#r-04-genres-sub-tab-support)
- [R-05: Debounce and Concurrency Control](#r-05-debounce-and-concurrency-control)
- [R-06: Large Container Performance](#r-06-large-container-performance)

---

## R-01: Container Track Resolution Strategy

**Question**: How should the system resolve all tracks within a container (artist, album, folder) before adding them to the queue? The existing `addToQueue()` takes a single URI — can it accept a container URI directly, or must we recursively resolve to individual tracks?

**Decision**: Use a two-strategy approach — try container URI first, fall back to recursive resolution.

**Rationale**: The node-sonos `queue()` method wraps the UPnP `AddURIToQueue` action. Sonos devices natively support queuing container URIs (e.g., `x-rincon-playlist:RINCON_xxx#A:ALBUM/...`) — the device itself resolves the container to its tracks. This is the fast path and handles most cases. However, for deeply nested folder structures or mixed container types, the device may not recursively resolve sub-containers. In those cases, the backend should recursively browse the container using `browseContainer()` to collect all leaf-track URIs, then enqueue them sequentially.

**Alternatives considered**:
- **Always resolve server-side**: Reliable but slow for large containers and adds unnecessary network roundtrips when the device can do it natively.
- **Always pass container URI**: Fastest but unreliable for nested folders — Sonos may only add direct children.

**Implementation approach**:
1. New backend function `resolveContainerTracks(objectId)` — recursively browses a container and returns all leaf-track URIs with metadata.
2. New backend function `addContainerToQueue(groupId, containerUri, objectId)` — attempts `device.queue(containerUri)` first. If the container URI is a folder (`S://...`), fall back to resolving + sequential add.
3. New endpoint `POST /api/sonos/groups/:groupId/queue/add-container` — accepts `{ uri, objectId }`, resolves tracks, and batch-enqueues.

---

## R-02: node-sonos Queue API Capabilities

**Question**: What are the exact capabilities and limitations of the node-sonos queue-related methods?

**Decision**: Leverage existing `device.queue()`, `device.flush()`, `device.selectTrack()`, and `device.play()` methods.

**Rationale**: Code inspection of `sonos-local-service.ts` confirms:
- `device.queue(uri)` / `device.queue({ uri, metadata })` — adds a single item to the end of the queue. Accepts both track URIs and some container URIs.
- `device.flush()` — clears the entire queue.
- `device.selectTrack(n)` — selects track by 1-based index.
- `device.play()` — starts playback.
- `svc.AddURIToQueue({ ... DesiredFirstTrackNumberEnqueued })` — lower-level UPnP call that allows inserting at a specific position (used by `playNext`).

These are sufficient for all required operations. No additional node-sonos methods or external libraries needed.

**Alternatives considered**:
- **sonos2mqtt or Sonos HTTP API**: External services that provide higher-level queue operations. Rejected — adds deployment complexity for a feature achievable with node-sonos directly.

---

## R-03: Replace Queue Atomicity

**Question**: How to implement "Replace Queue" (clear → add → play) atomically from the user's perspective, with proper error handling if any step fails?

**Decision**: Implement as a sequential backend operation with rollback on failure.

**Rationale**: The Sonos UPnP protocol does not support transactional queue operations. The "replace queue" action must be a three-step sequence: `flush()` → `queue(tracks)` → `selectTrack(1)` + `play()`. If the add step fails after clearing, the queue is empty — this is acceptable because the user explicitly chose to replace. The error message should clearly indicate what happened.

**Implementation approach**:
1. New backend function `replaceQueueAndPlay(groupId, containerUri, objectId)`:
   - Step 1: `flush()` to clear queue
   - Step 2: Resolve and enqueue tracks (same as add-container logic)
   - Step 3: `selectTrack(1)` + `play()` to start playback
   - Error handling: If step 2 fails, return error "Failed to add tracks after clearing queue". If step 3 fails, tracks are in queue but not playing — return warning.
2. New endpoint `POST /api/sonos/groups/:groupId/queue/replace` — accepts `{ uri, objectId }`.

**Alternatives considered**:
- **Save and restore on failure**: Snapshot the queue before clearing, restore on error. Rejected — adds complexity, and a failed "replace" leaving an empty queue is a reasonable failure mode. The user can retry.
- **Client-side orchestration**: Frontend calls clear → add → play separately. Rejected — race conditions, network failures between steps, and violates the "atomic from user's perspective" requirement (FR-011).

---

## R-04: Genres Sub-Tab Support

**Question**: Does the backend support a "genres" library type, and should it be added as a sub-tab?

**Decision**: Add a "Genres" sub-tab to the library browser.

**Rationale**: The backend's `isValidLibraryType()` already accepts `'genres'` as a valid type (confirmed in `sonos.ts:530`). The `browseLibrary('genres')` call works with node-sonos's `getMusicLibrary()`. The spec explicitly includes genres in FR-006. The current frontend `LIBRARY_SUB_TABS` array is missing genres — it only has `share`, `artists`, `albums`, `tracks`, `playlists`.

**Implementation**: Add `{ id: 'genres', label: 'Genres', icon: Tag }` to the `LIBRARY_SUB_TABS` array in `BrowsePanel.tsx`. No backend changes needed.

**Alternatives considered**: None — straightforward addition.

---

## R-05: Debounce and Concurrency Control

**Question**: How to prevent duplicate queue operations from rapid repeated user interactions (FR-010)?

**Decision**: Disable the action button during mutation + use TanStack Query's built-in mutation state.

**Rationale**: TanStack Query's `useMutation` provides `isPending` state that can be used to disable buttons during an active mutation. Combined with the `PlayActionMenu` closing after action selection, this effectively prevents rapid duplicate clicks. Adding explicit debounce timers adds complexity without meaningful benefit since the mutation state already provides the guard.

**Implementation**:
1. Pass `isLoading` prop to `PlayActionMenu` to disable all actions when a mutation is in flight.
2. In `LibraryTab`, track mutation states from `useAddContainerToQueue` and `useReplaceQueueAndPlay`.
3. Show loading spinner on the button that triggered the action.

**Alternatives considered**:
- **lodash.debounce on click handler**: Adds a dependency and doesn't prevent the visual feedback gap. Rejected.
- **Backend-side deduplication**: Adds backend state management for a UI concern. Rejected.

---

## R-06: Large Container Performance

**Question**: How to handle large containers (100+ tracks) without timeout or UI freeze (SC-006)?

**Decision**: Server-side batch processing with progress indication.

**Rationale**: Resolving a large container involves recursive `browseContainer()` calls (50 items per batch). For a container with 500 tracks across 5 folders, that's ~15 API calls to the Sonos device. Each call takes ~100-500ms on LAN, so total resolution time is 1.5-7.5 seconds. This is within acceptable limits for a single HTTP request with a generous timeout.

**Implementation**:
- Backend: Set a 30-second timeout on the container resolution endpoint. Process batches of 50 from `browseContainer` until all leaf tracks are collected, then enqueue them sequentially.
- Frontend: Show a loading spinner with "Adding tracks..." text on the button/menu that triggered the action. The `isPending` state from TanStack Query handles this automatically.
- Edge case: Cap maximum tracks at 1,000 per container add to prevent runaway operations. Return a warning if truncated.

**Alternatives considered**:
- **Streaming/SSE for progress**: Over-engineered for a LAN app with <10 second operations. Rejected.
- **Background job queue**: Adds infrastructure complexity. Rejected for the same reason.
