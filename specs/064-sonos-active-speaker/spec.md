# Feature Specification: Sonos Active Speaker Selection

**Feature Branch**: `064-sonos-active-speaker`
**Created**: 2026-09-24
**Status**: In Progress
**Input**: GitHub issue #9

## User Scenario

As a HomeDash user, I see the Sonos room that is actually playing, or the most
relevant available room when playback is paused or stopped, in both the widget
and screensaver.

## Requirements

- **FR-001**: An explicit user-selected group MUST remain selected while it exists.
- **FR-002**: Automatic selection MUST prefer playing, then paused groups.
- **FR-003**: Automatic fallback MUST exclude unavailable groups and remain stable
  when API ordering changes.
- **FR-004**: The widget and screensaver MUST use the same selection policy.
- **FR-005**: The screensaver MAY show a paused track but MUST NOT show stale track
  metadata for stopped or unavailable groups.

## Success Criteria

- **SC-001**: Focused tests cover explicit, playing, paused, unavailable, stopped,
  and reordered group lists.
- **SC-002**: Frontend unit tests, typecheck, build, lint, E2E, and upgrade gates pass.
