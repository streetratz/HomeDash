# Tasks: Mobile Widget Data Management

## Phase 01 — Mobile backgrounds

- [x] T001 Add shared widget panel/header surface tokens.
- [x] T002 Replace hard-coded black readability panels in affected widgets.
- [x] T003 Contain mobile placeholder child painting without clipping pill titles.
- [x] T004 Add regression coverage for semantic panel classes.

## Phase 02 — Stocks editing

- [x] T005 Extract shared Stocks config types and validation helpers.
- [x] T006 Add expandable ticker details and lot add/edit/remove controls.
- [x] T007 Make group controls responsive and accessible.
- [x] T008 Add component/helper tests for lot editing and validation.

## Phase 03 — Static ICS import

- [x] T009 Add `ical_file` schema columns and generate migration.
- [x] T010 Extract and test `parseIcalBody`.
- [x] T011 Add create/re-import routes with auth, CSRF, ownership, and size validation.
- [x] T012 Exclude file sources from scheduled polling.
- [x] T013 Add upload/re-upload UI and query mutations.
- [x] T014 Add backend integration and frontend component coverage.

## Phase 04 — Verification

- [x] T015 Run targeted tests and typechecks.
- [x] T016 Run UI review and full lint gate.
- [x] T017 Update phase logs and issue status.

## Phase 05 — Portable restore recovery

- [x] T018 File #216 and #217 from Docker restore failures.
- [x] T019 Preserve the authenticated bootstrap administrator during restore.
- [x] T020 Disable other restored passwords and sanitize integration credentials.
- [x] T021 Correct parent-first insertion and child-first deletion ordering.
- [x] T022 Add real export/restore regression coverage and operator documentation.
- [x] T023 Re-run full gates and validate the supplied backup in Docker.
- [x] T024 Upgrade a populated `main` Docker volume through migration 0029 and compare
  normalized configuration hashes.

## Phase 06 — Final review hardening

- [x] T025 Strip Pi-hole, UniFi, and integration client secrets from portable backups
  and force safe reconfiguration state during restore.
- [x] T026 Make uploaded ICS replacement transactional and reject VEVENT records without
  a UID.
- [x] T027 Add JSON body-limit headroom for base64-expanded 5 MiB ICS uploads.
- [x] T028 Preserve Yahoo CSV date compatibility while rejecting invalid purchase lots.
- [x] T029 Add a reusable Docker pre-PR upgrade gate for all future migrations.
- [x] T030 Re-run mandatory review, upgrade, build, test, and lint gates.
- [x] T031 Reprocess uploaded calendars locally so future recurring events advance.
- [x] T032 Validate every VEVENT UID before date-window filtering.
- [x] T033 Reject malformed Stock trade dates while preserving valid legacy Yahoo formats.
