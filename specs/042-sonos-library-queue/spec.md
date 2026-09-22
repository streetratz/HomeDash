# Feature Specification: Sonos Library Queue Actions & Sub-Navigation

**Feature Branch**: `042-sonos-library-queue`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: GitHub issues #111 (Add to Queue / Replace Queue at folder level) and #96 (Library tab sub-navigation)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Add All Tracks from a Container to Queue (Priority: P1)

A user is browsing the Sonos music library within HomeDash and navigates to an artist, album, or folder. They want to add all tracks from that container to the current playback queue without leaving the browse view, so music keeps flowing without interruption.

**Why this priority**: This is the primary feature request (#111). Users currently have no way to enqueue entire albums or folders from the library browser — they must use the native Sonos app. This is the single most impactful improvement for daily music listening workflows.

**Independent Test**: Can be fully tested by browsing to any album or folder in the library, tapping "Add to Queue", and confirming that all tracks from that container appear appended at the end of the current queue.

**Acceptance Scenarios**:

1. **Given** the user is browsing the music library and viewing a list of albums, **When** the user selects "Add to Queue" on an album, **Then** all tracks in that album are appended to the end of the current playback queue without interrupting the currently playing track.
2. **Given** the user is browsing a nested folder structure, **When** the user selects "Add to Queue" on a folder container, **Then** all tracks within that folder (including subfolders) are appended to the queue.
3. **Given** the queue is empty and no music is playing, **When** the user selects "Add to Queue" on an album, **Then** the tracks are added to the queue (playback does not automatically start).
4. **Given** a container is being added to the queue, **When** the operation is in progress, **Then** the user sees a brief visual confirmation (e.g., a toast notification or button state change) indicating the action succeeded or failed.

---

### User Story 2 — Replace Queue and Start Playback (Priority: P1)

A user finds an album or folder they want to listen to right now. They want to replace whatever is currently in the queue with this container's tracks and immediately start playback — the equivalent of "Play Now" for an entire collection.

**Why this priority**: Equally critical as Story 1 — together they represent the two fundamental queue operations users expect. "Replace and play" is the most natural action when a user decides what to listen to next.

**Independent Test**: Can be fully tested by having music playing, selecting "Replace Queue" on a different album, and confirming the old queue is cleared, new tracks are loaded, and playback begins from the first track.

**Acceptance Scenarios**:

1. **Given** music is currently playing from a queue, **When** the user selects "Replace Queue" on an album, **Then** the current queue is cleared, all tracks from the selected album are enqueued, and playback starts from the first track.
2. **Given** no music is playing and the queue is empty, **When** the user selects "Replace Queue" on a folder, **Then** all tracks from that folder are enqueued and playback starts automatically.
3. **Given** the user triggers "Replace Queue", **When** the clear + enqueue + play sequence encounters an error at any step, **Then** the user sees an error message and the system does not leave the queue in a partially modified state if possible.

---

### User Story 3 — Browse All Library Categories (Priority: P2)

A user opens the Sonos music library tab and expects to browse by different categories — artists, albums, genres, tracks, playlists, and Sonos playlists. Each sub-tab should load and display the correct content, support drill-down navigation, and allow searching within that category.

**Why this priority**: The browse infrastructure already exists (#96) but may not be fully functional for all categories. Ensuring all sub-tabs work correctly is essential for users to discover and navigate their full music library, which directly enables the queue actions from Stories 1 and 2.

**Independent Test**: Can be fully tested by clicking each sub-tab (artists, albums, genres, tracks, playlists, shares) and confirming that each loads the appropriate content from the music library, supports scrolling, and allows drill-down into containers.

**Acceptance Scenarios**:

1. **Given** the user is on the Library tab, **When** the user selects the "Artists" sub-tab, **Then** a list of all artists from the music library is displayed.
2. **Given** the user is on the Library tab, **When** the user selects the "Albums" sub-tab, **Then** a list of all albums is displayed with album artwork where available.
3. **Given** the user is on any sub-tab, **When** the user selects a container item (e.g., an artist), **Then** the view drills down to show the contents of that container (e.g., the artist's albums) with breadcrumb navigation to go back.
4. **Given** any sub-tab is active, **When** the user scrolls to the bottom of the list, **Then** additional items are loaded automatically (infinite scroll) if more items exist.
5. **Given** a sub-tab is active, **When** the user enters a search term, **Then** results are filtered to match within that library category.

---

### User Story 4 — Queue Actions on Nested Content (Priority: P3)

A user has drilled down from an artist into a specific album within the library browser. The queue action buttons ("Add to Queue" and "Replace Queue") should be available at every level of navigation — on top-level containers and on items revealed through drill-down.

**Why this priority**: This extends the core queue functionality to work consistently throughout the browsing experience. Without it, users could only queue items at the top level, which limits the usefulness of drill-down navigation.

**Independent Test**: Can be tested by browsing to Artists → selecting an artist → seeing their albums → selecting "Add to Queue" on one of the displayed albums, and confirming it works the same as from the top-level albums view.

**Acceptance Scenarios**:

1. **Given** the user has drilled down from Artists into a specific artist's albums, **When** the user selects "Add to Queue" on one of the albums, **Then** that album's tracks are appended to the queue.
2. **Given** the user is viewing the contents of a playlist, **When** the user selects "Replace Queue" on that playlist, **Then** the queue is replaced with the playlist's tracks and playback begins.

---

### Edge Cases

- What happens when a container has no tracks (empty folder or artist with no indexed music)? The system should display a message indicating no tracks were found and not modify the queue.
- What happens when the Sonos system is unreachable or the selected group is unavailable? The system should show a clear error message and not modify the queue.
- What happens when the user rapidly taps "Add to Queue" multiple times on the same container? The system should either debounce the action or queue the requests sequentially, avoiding duplicate additions.
- What happens when a very large container (hundreds of tracks) is added to the queue? The action should complete without timeout, and the user should see a progress or success indicator.
- What happens when the user has no Sonos group selected? Queue actions should be disabled or hidden, with guidance to select a group first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display "Add to Queue" and "Replace Queue" action controls on every container item (artist, album, folder, playlist) in the library browse view.
- **FR-002**: The "Add to Queue" action MUST append all tracks from the selected container to the end of the active Sonos group's playback queue without interrupting current playback.
- **FR-003**: The "Replace Queue" action MUST clear the current queue, enqueue all tracks from the selected container, and automatically start playback from the first track.
- **FR-004**: Queue action controls MUST be available on container items at every level of drill-down navigation, not only at the top-level browse view.
- **FR-005**: The system MUST provide visual feedback when a queue action is initiated (loading state) and when it completes (success or error notification).
- **FR-006**: All library sub-tabs (artists, albums, genres, tracks, playlists, shares) MUST load and display content from the corresponding music library category.
- **FR-007**: Each library sub-tab MUST support drill-down navigation into container items with breadcrumb-based back navigation.
- **FR-008**: Each library sub-tab MUST support infinite scroll for progressively loading large collections.
- **FR-009**: Queue action controls MUST be disabled or hidden when no Sonos group is currently selected.
- **FR-010**: The system MUST prevent duplicate queue operations from rapid repeated user interactions (debounce or disable during processing).
- **FR-011**: The "Replace Queue" operation MUST handle the multi-step sequence (clear → add → play) atomically from the user's perspective — if any step fails, the user should receive a clear error message.

### Key Entities

- **Container**: A browsable item in the music library that holds other items (artist, album, folder, genre, playlist). Identified by a unique URI. Can contain tracks or other nested containers.
- **Track**: An individual playable audio file within the library. Always a leaf item — cannot be drilled into further.
- **Queue**: The ordered list of tracks scheduled for playback on a Sonos group. Supports append (add) and replace (clear + add) operations.
- **Library Category**: A top-level classification for browsing the music library (artists, albums, genres, tracks, playlists, shares). Each maps to a distinct data source on the Sonos system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add an entire album or folder to the playback queue in a single action (one tap/click) from anywhere in the library browser.
- **SC-002**: Users can replace the current queue and start playing a new album or folder in a single action from anywhere in the library browser.
- **SC-003**: All library sub-tabs (artists, albums, genres, tracks, playlists, shares) display content when selected — zero sub-tabs return empty or error states when the library contains data.
- **SC-004**: Queue action feedback (success or error) is visible to the user within 3 seconds of initiating the action.
- **SC-005**: Users can browse from a top-level category through at least two levels of drill-down and back using breadcrumbs without losing their scroll position or context.
- **SC-006**: Large containers (100+ tracks) can be added to the queue without the operation timing out or the interface becoming unresponsive.

## Assumptions

- The Sonos system is on the same local network as the HomeDash backend and is reachable via the existing service layer.
- The backend queue and library browsing endpoints are functional and do not require modification for this feature (only frontend changes and possible endpoint verification are needed).
- Container URIs returned by the library browse functionality are compatible with the queue add operation (i.e., passing a container URI to "add to queue" enqueues all tracks within it).
- The existing breadcrumb navigation and infinite scroll mechanisms in the Library tab are functional and only need to be connected to all sub-tab categories.
- A Sonos group must be selected before queue actions are available — group selection is handled by existing functionality outside this feature's scope.
- Individual track-level queue actions (adding a single track) are out of scope for this feature — only container-level actions are included.
- The "genres" category is included in sub-tab navigation since the backend supports it, even though it was not explicitly listed in the original issue.
