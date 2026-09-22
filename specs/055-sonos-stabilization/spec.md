# Feature Specification: Sonos Experience Stabilization

**Feature Branch**: `055-sonos-stabilization`  
**Created**: 2026-09-20  
**Status**: Draft  
**Issue**: #227

## User Scenarios

### User Story 1 - Stable Sonos states

As a dashboard user, I can distinguish scanning, loading, disconnected, idle, and
unavailable Sonos states without the compact or fullscreen layout collapsing.

**Acceptance criteria**

1. Compact, expanded, fullscreen, authenticated, and public views reserve stable
   media and content space at approximately 360 px and the smallest supported cell.
2. Missing artwork uses an intentional Sonos placeholder.
3. Loading, no-speakers, no-group-selected, nothing-playing, and unavailable states
   are visually distinct.

### User Story 2 - Accurate topology and group reset

As a Sonos administrator, displayed room/group membership matches Sonos and I can
separate removable members back into standalone rooms.

**Acceptance criteria**

1. Local and cloud topology preserve stable player IDs, names, stereo/bonded
   relationships, standalone rooms, and manually grouped rooms.
2. A confirmed reset action removes every removable non-coordinator member without
   attempting to remove the coordinator.
3. Topology refreshes after group actions.
4. Partial failures identify each speaker that failed and never report false success.

### User Story 3 - Clear queue safely

As a local-mode administrator, I can find and confirm Clear Queue, while cloud mode
clearly explains why queue mutation is unavailable.

**Acceptance criteria**

1. Clear Queue is visible in the queue experience and requires destructive
   confirmation.
2. Cloud mode shows an explanatory unavailable state rather than a non-functional
   control.
3. Successful clearing refreshes queue, playback, and metadata queries.

### User Story 4 - Browse the Spotify saved library

As a connected Spotify user, I can browse saved playlists, albums, artists, and tracks
with explicit loading, empty, error, pagination, and authentication-recovery states.

**Acceptance criteria**

1. Supported library sections are discoverable without replacing existing search.
2. Pagination can load additional results without discarding prior results.
3. Selecting playable content uses existing Sonos queue/play actions where supported.
4. Disconnected or expired Spotify authorization provides a direct Settings recovery
   path.

## Functional Requirements

- **FR-001**: Sonos media areas MUST retain stable dimensions when artwork or playback
  data is unavailable.
- **FR-002**: Placeholder treatment MUST be shared across compact and fullscreen views.
- **FR-003**: Topology normalization MUST retain the coordinator and visible room
  identity while correctly representing stereo/bonded members.
- **FR-004**: Group mutation requests MUST use stable player IDs and refresh topology.
- **FR-005**: Reset MUST target only removable non-coordinator members and return
  per-player failures.
- **FR-006**: Group reset and queue clear MUST remain admin-only and CSRF-protected.
- **FR-007**: Queue clearing MUST invalidate queue, playback, and metadata state.
- **FR-008**: Cloud mode MUST not expose local-only queue or grouping mutations.
- **FR-009**: Spotify saved-library reads MUST be authenticated and paginated with
  bounded limits.
- **FR-010**: Spotify tokens MUST remain server-side and expired authorization MUST be
  represented explicitly.
- **FR-011**: Saved albums, artists, tracks, and playlists MUST each have loading,
  empty, error, and pagination states.
- **FR-012**: New controls MUST be keyboard accessible, touch-friendly, and usable at
  approximately 360 px.

## Success Criteria

- **SC-001**: Empty/loading Sonos views do not change the widget's media-frame height.
- **SC-002**: Fixtures cover standalone, stereo/bonded, and manually grouped topology.
- **SC-003**: Reset never sends a leave request for the coordinator and reports each
  failed member.
- **SC-004**: Queue clear requires confirmation and refreshes all dependent query keys.
- **SC-005**: Spotify pagination appends unique items for every supported library type.
- **SC-006**: Existing Sonos playback, discovery, service browsing, and public-view
  tests remain green.

## Out of Scope

- Sonos firmware changes or native music-service credential extraction.
- Cloud-mode queue/group mutations not supported by the Sonos Control API.
- Replacing the existing Spotify OAuth connection model.
- Changes to Docker, release automation, or unrelated widgets.
