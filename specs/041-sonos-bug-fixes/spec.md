# Feature Specification: Sonos Widget Bug Fixes

**Feature Branch**: `041-sonos-bug-fixes`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: Fix three Sonos widget issues: stereo-paired speakers showing as phantom rooms, volume slider controlling all members instead of coordinator, and now-playing text animation improvements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stereo Pairs Display Correctly (Priority: P1)

As a user with stereo-paired Sonos speakers, I see my rooms listed correctly on the dashboard without phantom duplicate entries for invisible stereo pair partners.

**Why this priority**: Phantom rooms confuse users and break the mental model of their home audio layout. This is the most disruptive visual bug as it adds non-functional entries that cannot be controlled.

**Independent Test**: Can be fully tested by configuring a stereo pair and verifying the room list shows only the single logical room, not the invisible partner as a separate entry.

**Acceptance Scenarios**:

1. **Given** a stereo-paired speaker setup (two physical speakers forming one logical room), **When** the dashboard loads the Sonos room list, **Then** only the coordinator room appears — the invisible stereo partner does not appear as a separate room.
2. **Given** a mix of stereo-paired and standalone speakers, **When** viewing all rooms, **Then** the total room count matches the number of logical rooms (not physical devices).
3. **Given** a stereo pair is split back into two standalone speakers, **When** the dashboard refreshes, **Then** both speakers appear as independent rooms.

---

### User Story 2 - Volume Slider Controls Coordinator Only (Priority: P1)

As a user adjusting volume for a multi-room group, I expect the volume slider to control the group coordinator rather than overriding individual volume levels on all members, preserving my relative volume balance between rooms.

**Why this priority**: Overwriting all member volumes destroys user-configured relative balances, which is a data-loss scenario for user preferences. This equally impacts daily use as the phantom room bug.

**Independent Test**: Can be fully tested by creating a multi-room group with different volume levels per room, adjusting the group volume slider, and verifying relative differences are preserved.

**Acceptance Scenarios**:

1. **Given** a multi-room group with rooms at different volume levels (e.g., Kitchen at 40%, Living Room at 60%), **When** I adjust the group volume slider, **Then** the coordinator receives the volume command and relative differences between rooms are preserved.
2. **Given** a stereo pair (single logical room), **When** I adjust its volume, **Then** both speakers in the pair change volume together (handled by the coordinator automatically).
3. **Given** a single standalone speaker, **When** I adjust its volume, **Then** the volume changes as expected with no behaviour change.

---

### User Story 3 - Now Playing Text Animates Only When Needed (Priority: P2)

As a user viewing the Sonos widget, I see smooth marquee animation for long track titles that overflow their container, while short titles remain static. This applies to both the dashboard widget and the fullscreen view.

**Why this priority**: This is a visual polish issue that improves readability but does not block core functionality.

**Independent Test**: Can be tested by playing tracks with varying title lengths and observing animation behaviour in both widget and fullscreen views.

**Acceptance Scenarios**:

1. **Given** a currently playing track with a title that fits within the display container, **When** viewing the widget or fullscreen view, **Then** the title displays statically with no animation.
2. **Given** a currently playing track with a title that overflows the display container, **When** viewing the widget or fullscreen view, **Then** the title scrolls smoothly using a marquee animation.
3. **Given** a track change occurs, **When** the new title appears, **Then** the animation resets and restarts cleanly from the beginning (no jarring mid-scroll transitions).
4. **Given** the fullscreen Sonos view is open with a long track title, **When** viewing the now-playing information, **Then** the title animates with the same marquee behaviour as the dashboard widget.

---

### Edge Cases

- What happens when a stereo pair has no coordinator available (e.g., one speaker is offline)? The remaining speaker should appear as a standalone room.
- What happens when a user drags the volume slider rapidly? Volume commands should debounce and only the final value is sent to the coordinator.
- What happens when a track title is exactly at the boundary of container width? A small tolerance buffer should prevent flickering between animated/static states.
- What happens when playback is paused? The marquee animation should pause or stop (not continue scrolling when nothing is playing).
- What happens when the Sonos group topology changes while the dashboard is open? The room list should update on the next poll/event without requiring a page refresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST filter out zone groups where the only visible member is an invisible stereo pair partner from the room list.
- **FR-002**: System MUST display stereo pairs as a single logical room represented by their coordinator.
- **FR-003**: System MUST send volume commands only to the group coordinator device, not to all individual members.
- **FR-004**: System MUST preserve relative volume differences between group members when group volume is adjusted.
- **FR-005**: System MUST only animate now-playing text when the text content overflows its display container.
- **FR-006**: System MUST display a marquee animation for overflowing track titles in both the dashboard widget and fullscreen view.
- **FR-007**: System MUST reset the marquee animation cleanly when the track changes.
- **FR-008**: System MUST stop or pause the marquee animation when playback is not active.

### Key Entities

- **Zone Group**: A logical grouping of Sonos speakers that play together. Contains a coordinator and zero or more members.
- **Coordinator**: The primary speaker in a zone group that receives commands and propagates them to members.
- **Stereo Pair**: Two physical speakers configured as a single logical unit. One acts as coordinator, the other is invisible.
- **Room**: The user-facing representation of a zone group in the dashboard. Maps 1:1 with visible zone groups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with stereo-paired speakers see the correct number of rooms (no phantom entries) 100% of the time.
- **SC-002**: Adjusting group volume preserves relative volume offsets between members within ±1% tolerance.
- **SC-003**: Now-playing text remains static when title fits within the container (no unnecessary animation).
- **SC-004**: Track title animation in fullscreen view behaves identically to the dashboard widget for the same content.
- **SC-005**: All three bug fixes introduce zero regressions to existing Sonos widget functionality (playback controls, metadata display, speaker discovery).

## Assumptions

- Stereo pair detection logic already exists in the backend service and can be reused for group filtering.
- The Sonos coordinator device handles volume propagation to stereo pair partners automatically (no need to send volume to both speakers in a pair).
- The existing marquee keyframe animation in the Tailwind configuration is suitable for reuse in the fullscreen view.
- The Sonos topology (groups, pairs, members) is polled periodically and updates are reflected without requiring manual user intervention.
- The volume slider already has basic debouncing in place; the fix only changes the target device, not the interaction model.
- These are bug fixes to existing functionality — no new UI components or screens are introduced.
