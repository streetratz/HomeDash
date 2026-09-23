# Feature Specification: Sonos Library and Mobile Fullscreen Fixes

**Feature Branch**: `059-sonos-library-mobile`
**Created**: 2026-09-20
**Status**: In progress
**Issues**: #8, #9 (public follow-up to historical private issues #244 and #245)

## User Scenarios & Testing

### User Story 1 - Browse NAS Music Reliably (Priority: P1)

As an authenticated user in local Sonos mode, I can browse an indexed SMB/NAS music
library even when one discovered speaker cannot answer ContentDirectory requests.

**Independent Test**: Configure two simulated speakers where the first fails a share
browse and the second succeeds, then verify the API returns the second speaker's
folders.

**Acceptance Scenarios**:

1. **Given** multiple discovered speakers, **when** one rejects ObjectID `S:` and
   another succeeds, **then** the configured share roots are returned.
2. **Given** every speaker rejects the browse, **when** the Folders view loads,
   **then** the API returns a safe upstream error and the UI offers Retry.
3. **Given** a successful browse with no configured shares, **when** the Folders view
   loads, **then** the UI shows a genuine empty state.
4. **Given** a CIFS folder URI, **when** the user drills in or queues the folder,
   **then** the request uses the corresponding `S://` ObjectID.

### User Story 2 - Use Sonos Fullscreen on a Phone (Priority: P1)

As a phone user, I can control playback and move among Rooms, Queue, Browse, and
Favorites without several wrapping control rows pushing content out of view.

**Independent Test**: Render the fullscreen controller at 360, 390, 412, and 430 CSS
pixels and verify that the header, player, primary navigation, and selected content
fit without horizontal page overflow.

**Acceptance Scenarios**:

1. **Given** a phone viewport, **when** fullscreen Sonos opens, **then** Now Playing is
   the clear focal point and primary navigation remains directly reachable.
2. **Given** Browse is selected, **when** a service has secondary tabs, **then** only
   compact, horizontally scrollable navigation is shown without clipped labels.
3. **Given** a tablet or desktop viewport, **when** fullscreen Sonos opens, **then**
   the established two-column layout and capabilities remain intact.

### User Story 3 - Follow Active Sonos Playback (Priority: P1)

As a dashboard user, the Sonos widget and screensaver follow the room that is actively
playing instead of opening on an idle or unavailable room.

**Independent Test**: Provide mixed playing, buffering, paused, idle, and unavailable
groups, then verify every automatic selection surface chooses the highest-priority
group while preserving an explicit in-session room selection.

**Acceptance Scenarios**:

1. **Given** one playing group and any number of paused or idle groups, **when** the
   widget chooses a room automatically, **then** it selects the playing group.
2. **Given** no playing group and one paused group, **when** a room is selected
   automatically, **then** it selects the paused group.
3. **Given** only stopped and unavailable groups, **when** a room is selected
   automatically, **then** it selects the first stable stopped group.
4. **Given** the user explicitly selected an existing room in the current session,
   **when** topology refreshes, **then** that selection remains active.

## Edge Cases

- No Sonos devices are discovered.
- The first discovered device is stale or rejects ContentDirectory operations.
- All discovered devices reject the same library request.
- A successful ContentDirectory response contains zero items.
- Folder items use `x-file-cifs://`, `S://`, or `x-rincon-playlist:#...` identifiers.
- A 360 px viewport has long room, provider, track, or album names.
- Browser safe areas reduce the usable mobile height or width.
- The configured default room is paused while another room is playing.
- An unavailable group appears before a stopped group in the topology response.
- A selected group disappears after regrouping.

## Functional Requirements

- **FR-001**: Local library and favorites reads MUST try discovered speakers in a
  deterministic order until one returns a valid response, preferring soundbars and
  fixed speakers ahead of portable speakers.
- **FR-002**: If every available speaker rejects a library browse, the service MUST
  throw a classified safe error rather than return an empty successful response.
- **FR-003**: The API MUST NOT expose raw UPnP errors or speaker network details.
- **FR-004**: The library UI MUST distinguish loading, empty, and error states and
  provide a retry action for errors.
- **FR-005**: CIFS folder URIs MUST normalize to Sonos `S://` ObjectIDs for drill-down
  and container queue operations.
- **FR-006**: Mobile fullscreen MUST present one primary navigation row without
  wrapping and MUST keep touch targets at least 44 CSS pixels.
- **FR-007**: Secondary service and library navigation MUST scroll horizontally rather
  than wrap into additional rows on phones.
- **FR-008**: Mobile content MUST not create horizontal page overflow at 360-430 CSS
  pixels.
- **FR-009**: Desktop and tablet Sonos behavior MUST remain functionally unchanged.
- **FR-010**: Existing playback, grouping, queue, favorites, Spotify, and local/cloud
  behavior MUST remain available.
- **FR-011**: Arc, Beam, Playbar, Playbase, and Ray devices MUST be preferred for
  ContentDirectory reads when model information is available; Roam and Move devices
  MUST be attempted after fixed speakers.
- **FR-012**: Automatic group selection MUST rank playing or buffering groups first,
  paused groups second, stable idle or stopped groups third, and unavailable or
  unknown groups last.
- **FR-013**: A valid in-session user selection MUST be preserved. A configured
  default room MAY break ties between groups with the same playback priority but MUST
  NOT outrank a group with a higher playback priority.
- **FR-014**: The authenticated widget, public widget snapshot, fullscreen controller,
  and screensaver Sonos data source MUST apply the same automatic priority order.

## Success Criteria

- A simulated failing-first/succeeding-second speaker browse returns the successful
  library result.
- An all-speakers-failed browse produces a retryable client error, while a valid empty
  result still produces an empty state.
- Targeted tests cover CIFS ObjectID normalization for browsing and queue actions.
- Responsive checks pass at 360, 390, 412, and 430 CSS pixels with no horizontal page
  overflow and no wrapped primary navigation.
- Mixed-state selection tests prove that playing outranks paused, paused outranks
  stopped, stopped outranks unavailable, and configured defaults only break ties.
- The candidate Docker image starts successfully and can be reviewed locally before
  the PR is opened.

## Out of Scope

- Sonos cloud API changes.
- A new music-library index or cache.
- Redesigning the desktop fullscreen layout.
- Widget settings-only mode from #246.
- Kiosk mode or release promotion.
