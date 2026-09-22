# Tasks: Sonos Service Discovery and Browse

## Phase 01 — Research and contract

- [x] T001 Audit #82, #83, #84 and prior spec 027 implementation.
- [x] T002 Validate the pinned `sonos` MusicServices API and firmware account behavior.
- [x] T003 Define safe discovery fallbacks and explicit SMAPI scope boundary.
- [x] T004 Create spec, plan, tasks, changelog, and logging structure.

## Phase 02 — Backend discovery

- [x] T005 Add typed MusicServices access and safe XML parsing helpers.
- [x] T006 Aggregate catalog, firmware accounts, favorites, active playback, and labels.
- [x] T007 Add adapter behavior for local and cloud modes.
- [x] T008 Add authenticated `/api/sonos/services` route with bounded query validation.
- [x] T009 Add parser, aggregation, auth, and degraded-source tests.

## Phase 03 — Browse experience

- [x] T010 Add Sonos service/account query types and hook.
- [x] T011 Replace hardcoded browse choices with discovered provider/account choices.
- [x] T012 Add Radio and service/account-filtered Favorites content surfaces.
- [x] T013 Preserve Spotify search/playlists and local library behavior.
- [x] T014 Add browse/default-selection unit and browser coverage.

## Phase 04 — Speaker details

- [x] T015 Resolve stereo partner names and present complete labelled device fields.
- [x] T016 Display household service/account context in local speaker details.
- [x] T017 Add responsive and accessibility coverage for speaker details.

## Phase 05 — Validation and delivery

- [x] T018 Run targeted backend/frontend tests, typecheck, and builds.
- [x] T019 Complete code, security, design, upgrade, and lint gates.
- [x] T020 Commit, push, and open PR #221 closing #82, #83, and #84.
