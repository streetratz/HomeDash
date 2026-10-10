# Tasks: Custom Calendar Events

**Input**: Design documents from `specs/065-bin-collection-calendar/`  
**Prerequisites**: `plan.md`, `spec.md` (CH-04), `research.md`, `data-model.md`,
`contracts/collection-api.md`, `contracts/calendar-ui.md`, `quickstart.md`;
root/scoped `AGENTS.md` and `.specify/memory/constitution.md` v2.4.0.  
**Status**: **Custom event refactor implemented and independently reviewed;
local owner validation pending.** R001-R015 below track the current scope.
Original T tasks retain historical implementation and outstanding acceptance
evidence; unchecked human-validation and PR tasks are not claimed complete.
**Tests**: Required by the specification, requested behavior coverage and
constitution. Write focused tests before the corresponding implementation,
observe meaningful failing assertions, then make them green; infrastructure
failures alone are not useful red evidence.

**Organization**: Setup → foundation → US1 (P1) → US2 (P1) → US4 (P1) →
US3 (P2) → polish. Story numbers retain their original spec identities.
US4's security/date/durability minimum is a foundation/US1 delivery prerequisite,
not work deferred until after publishing an unsafe MVP.

## Format: `[ID] [P?] [Story] Description`

- Every task uses `- [ ] TNNN`, an exact repository-relative file path and
  explicit prerequisites. Story labels occur only in story phases.
- `[P]` means runnable in the named dependency batch on different files; it
  never overrides prerequisites or permits concurrent edits to shared files.
- New paths below are deliberate implementation targets, not claims of existing
  files. Never hand-edit generated Drizzle SQL, journals or snapshots.
- Implementation and local phase commits are authorized. Do not push, open a
  PR, prepare versions or touch deferred dependency PRs #2/#18.
  The original planning-only restriction is superseded.

## Path Conventions and Execution Rules

Use the existing `backend/src/`, `backend/tests/`, `frontend/src/` and
`frontend/tests/e2e/` workspaces; no new package, runtime service or dependencies.
Node 24/pinned pnpm 11 are mandatory for execution. Read local
`.agent-environment.md` privately before installation or network access.
Use isolated temporary databases/data directories, never the live household DB.

Every execution phase starts a fresh globally numbered log, with TOC, backlink,
Commands Run, Errors & Fixes and Phase Checkpoint; update
`specs/065-bin-collection-calendar/logs/readme.md` immediately. Capture stdout
and stderr into the matching phase sidecar directory with five audit headers,
record exact commands/exits and retain failed attempts. The phase filenames
below reserve 05–11 if no intervening work occurs; if analysis consumes a number,
allocate the next free global number instead. Do not overwrite phases 01–04.
Do not mark a phase complete with known failing tests. Log synthetic counts/
request IDs, not private labels, bodies, credentials, SQL bind values or local
environment contents. No spec edit is expected; any necessary later spec edit
requires contemporaneous CH-03 (or next available CH-NN).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish isolated fixtures and an auditable execution baseline in
the existing project, without reinitializing it or installing new dependencies.

 in `specs/065-bin-collection-calendar/logs/06-phase-setup.md` and index it in `specs/065-bin-collection-calendar/logs/readme.md`, preserving branch065 dirty artifacts and recording implementation authorization/scope exclusions (Prerequisites: separate implementation authorization).
- [X] T001 Open the execution audit in `specs/065-bin-collection-calendar/logs/06-phase-setup.md` and index it in `specs/065-bin-collection-calendar/logs/readme.md`, preserving branch065 dirty artifacts and recording implementation authorization/scope exclusions (Prerequisites: separate implementation authorization).
- [X] T002 Record Node 24/pnpm 11, current scripts, scoped instructions, baseline focused calendar/backup tests and known formatter findings in `specs/065-bin-collection-calendar/logs/06-phase-setup.md`; consult `frontend/playwright.config.ts` and its managed E2E server rather than the stale “server commented out” note, and leave PRs #2/#18 unchanged (Prerequisites: T001).
- [X] T003 [P] Create synthetic isolated household/provider/birthday/widget/public-web/mobile fixtures with independent expected dates in `backend/tests/helpers/collectionFixtures.ts`, using existing test DB helpers and stable UUIDs without live data (Prerequisites: T002).
- [X] T004 [P] Create deterministic admin/resident/public collection setup helpers in `frontend/tests/e2e/helpers/collections.ts`, using the existing auth setup and local E2E server with no external accounts (Prerequisites: T002).

**Checkpoint**: Environment/baseline understood; test helpers isolated; no
unrelated dependency changes or household database access.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared strict models, date engine, transaction semantics,
backup/restore and safe read boundaries. **Complete T005–T023 before any story.**
Full engine safety is shared infrastructure even when US3's editor ships later.

### Tests first

- [X] T005 Start `specs/065-bin-collection-calendar/logs/07-phase-foundational.md` and its index/sidecars; define red/green evidence for schema/date/transaction/backup/projection work (Prerequisites: T001–T004).
- [X] T006 [P] Write an independently enumerated 24-month oracle and rejection tests in `backend/tests/unit/collectionDates.test.ts` for intervals 1/2/4/52, weekday sets 1/3/7, all seven weekly versus alternate-week, Monday/Sunday, anchors before/after ranges, 53-week/year crossings, 2028-02-29 and strict 1900–2199 date bounds (Prerequisites: T005).
- [X] T007 [P] Add empty/populated-main/repeated-start migration tests in `backend/tests/integration/collectionMigration.test.ts`, comparing original calendars/birthdays/users/widgets/config and FK checks, no preset seed, singleton/CHECK/PK/cascade behavior and preservation when the setup admin is deleted (Prerequisites: T005).
- [X] T008 [P] Write draft/limit/transaction red tests in `backend/tests/unit/collectionService.test.ts` for strict unions, unknown fields/coercions, timezone/colour/text validation, disabled-stream validation, complete-set collisions, valid two-exception destination swaps with stable IDs/timestamps, digest/revision/epoch, destructive confirmations, atomic rollback and other-stream isolation (Prerequisites: T005).
- [X] T009 [P] Write v2 exact roundtrip/v1 compatibility and malicious-restore tests in `backend/tests/integration/collectionBackup.test.ts`, including missing v2 arrays, collection-bearing v1 rejection, invalid FK/mode/selection/order/limits/collisions and insertion failure without destructive loss; capture restore logs/responses and assert no synthetic private label, SQL bind parameters or backup content is exposed (Prerequisites: T005).

### Shared implementation

- [X] T010 Define `collectionHousehold`, `collectionStreams`, `collectionExplicitDates` and `collectionExceptions` in `backend/src/db/schema/index.ts` with the data-model singleton, mode/shape/interval/mask/order CHECKs, stable UUIDs, child cascade FKs and origin/destination indexes; do not add a sortOrder UNIQUE index or alter provider tables (Prerequisites: T007).
- [X] T011 Run `pnpm --filter backend db:generate` from the edited schema; retain only its newly emitted SQL in `backend/drizzle/` and corresponding `backend/drizzle/meta/` journal/snapshot, recording the exact tool-returned filenames in `specs/065-bin-collection-calendar/logs/07-phase-foundational.md`; prove it is additive, unseeded and repeat-safe without inventing filenames or editing generated/released SQL or the migration runner (Prerequisites: T010).
- [X] T012 Implement pure strict Gregorian ordinal parsing, Monday–Sunday signed active-week modulo and bounded range generation in `backend/src/services/collectionDates.ts`; validate normal anchors, emit before/after-anchor occurrences, apply skip/replace/add without phase shifts and include moved-in targets whose origins are outside range; never use annual week parity or real 24-hour timestamp iteration (Prerequisites: T006).
- [X] T013 Implement strict aggregate/draft/display-window schemas and reusable semantic validation in `backend/src/services/collectionService.ts`: 32 streams, 2,048 explicit dates/stream, 512 exceptions/regular stream, 8,192 total entries, 2 MiB admin input, ≤731 inclusive range days, daysAhead 1–90, bounded texts/UUIDs/timezones; validate all disabled schedules and all exception origins/destinations globally, rejecting same-stream duplicates but allowing different streams on one date (Prerequisites: T008, T010, T012).
- [X] T014 Test then extend only Calendar config validation in `backend/src/lib/validation.ts` and `backend/tests/unit/collectionWidgetConfig.test.ts` with optional default-empty `collectionStreamIds`/`publicCollectionStreamIds`, ≤32 unique UUIDs, public-subset enforcement and old-source/config preservation; require existing admin/CSRF widget mutation protections (Prerequisites: T013).
- [X] T015 Implement private aggregate reads, read-only preview/digest and immediate transactional diff/save in `backend/src/services/collectionService.ts`; recheck revision/runtime epoch inside the transaction, validate final state then delete removed/changed exceptions before reinserting changed rows with stable IDs/createdAt and changed-only updatedAt, leaving unchanged rows untouched to permit valid destination swaps; verify exact destructive differences, prune only deleted IDs from valid Calendar selections and safely ignore malformed unrelated JSON; roll back SQLite busy/IO/constraint failures with no await/outbound work (Prerequisites: T013, T014).
- [X] T016 Add strict four-table arrays, export inclusions and version-discriminated validation in `backend/src/services/backupTypes.ts`; set portable BACKUP_VERSION=2, require all arrays in v2, accept collection-free v1 with empty defaults and reject collection-bearing v1 rather than silently stripping fields (Prerequisites: T009, T013).
- [X] T017 Integrate collection table maps/export and household→streams→children insert/reverse-delete order in `backend/src/services/backupService.ts`; perform aggregate/FK/selection validation before deletion, preserve IDs/revision/date keys/private label exactly, retain existing exclusions/reauth, invalidate the process-only collection epoch only after successful restore, sanitize caught restore failures before the existing logger can expose SQL/private values, and roll back every failed full replacement (Prerequisites: T015, T016).
- [X] T018 Test then display the v1 full-replacement/no-collections warning and v2 incompatibility guidance through `frontend/src/components/settings/BackupRestoreSection.tsx`, `frontend/src/state/backupHooks.ts` and `frontend/tests/unit/collectionRestoreWarning.test.tsx`; reuse existing warning/session-reset flow and invalidate the agreed `collections` query-key prefix after successful restore without importing not-yet-created collection hooks (Prerequisites: T017).
- [X] T019 Implement authenticated selected-widget read projection in `backend/src/services/collectionService.ts` and collection-specific designated-web/mobile-dashboard/widget resolver in `backend/src/services/publicVisibility.ts`; join actual Calendar membership, never accept caller stream/principal IDs or reuse legacy source/event reads, return allowlisted complete date groups and context with private/authenticated versus generic public empty states (Prerequisites: T014, T015).
- [X] T020 Test then restrict Calendar public bootstrap/dashboard projection in `backend/src/services/publicVisibility.ts` and `backend/tests/integration/publicBootstrapProjection.test.ts` to the saved public subset as `collectionStreamIds`, omitting the public-selection field and hidden IDs; preserve intrinsic legacy Calendar/provider visibility and do not add Calendar to the unrelated snapshot loader (Prerequisites: T019).
- [X] T021 Add fake-server-time unit tests in `frontend/tests/unit/collectionDates.test.ts` and implement `frontend/src/lib/collectionDates.ts` for serverNow plus monotonic elapsed household Today/Tomorrow, named Intl Gregorian timezone parts and civil-key weekday/date formatting; cover Sydney/Auckland/Los Angeles visitors, DST/leap/year/midnight and timezone edits preserving keys, without legacy provider date helpers (Prerequisites: T012, T019).
- [X] T022 Add sanitizer/rollback assertions to `backend/tests/unit/collectionService.test.ts` and `backend/tests/integration/collectionBackup.test.ts`; implement safe reason-code/count/duration diagnostics in `backend/src/services/collectionService.ts` and at the catch/logger boundary in `backend/src/services/backupService.ts`, proving injected restore failures do not leak labels/bind values/backup content before rethrowing; use existing error envelopes and request correlation, preserving rollback/reauth and distinguishing conflict/validation/transient failure without payload echo (Prerequisites: T015, T017, T019).
- [X] T023 Run focused date/service/config/migration/backup/projection/restore-warning tests, including `PRAGMA foreign_key_check`, then backend/frontend typechecks under Node 24; record raw outcomes and resolve failures in `specs/065-bin-collection-calendar/logs/07-phase-foundational.md` before closing the foundation (Prerequisites: T011–T022).

**Checkpoint**: No read/preview writes or provider materialization; strict
collision semantics, privacy, generated additive schema and lossless v2/warned
v1 restore proven. US1 may now build its safe end-to-end slice.

---

## Phase 3: User Story 1 — Set Up the Household Preset (Priority: P1) 🎯 MVP

**Goal**: Admin confirms household timezone/weekday/normal Recycling date,
previews four weeks and saves stable red weekly General waste/yellow A/green B
streams; selected existing Calendar agenda/fullscreen renders them safely.

**Independent Test**: Wednesday, `Australia/Sydney`, 2026-10-14 produces red+
yellow on Oct 14/28 and red+green on Oct 21/Nov 4; Thursday anchor is rejected.
Save, select in a collections-only Calendar, reload/restart and inspect all four
dates offline as admin/resident; unpublished content is inaccessible publicly.

### Tests first

- [X] T024 [US1] Start `specs/065-bin-collection-calendar/logs/08-phase-preset.md` with US1 red/green, role/privacy/date and durability evidence requirements (Prerequisites: T023).
- [X] T025 [P] [US1] Write private GET/POST preview/PUT save and authenticated widget display contract tests in `backend/tests/contract/collections.test.ts`; cover admin allow, anonymous/expired-session/non-admin including settings:manage deny, missing/wrong CSRF deny, read-only preview, strict queries, 401/403/409/422/413/429/safe500, and no partial write on error (Prerequisites: T024).
- [X] T026 [P] [US1] Write designated web/mobile public route matrix tests in `backend/tests/integration/collectionPublic.test.ts` for selected subset allow, wrong widget/type/dashboard/context/hidden/guessed/revoked deny, malformed config fail-closed, no private keys/catalogue, no-store/rate limit and POST/PUT/PATCH/DELETE not mutating (Prerequisites: T024).
- [X] T027 [P] [US1] Write preset/draft/preview-invalidated/retained-error/cancel tests in `frontend/tests/unit/CollectionManager.test.tsx`, asserting timezone confirmation, four weeks, correct A/B phase, weekday mismatch and no implicit reseed on reload (Prerequisites: T024).
- [X] T028 [P] [US1] Write initial collection-only and mixed agenda/fullscreen rendering tests in `frontend/tests/unit/collectionCalendar.test.tsx` for visible icon+name/date/timezone, complete next group, escaped untrusted text names, foreground midnight refresh, provider isolation and zero selected source IDs despite existing provider/birthday sources; assert mixed mode reads only selected providers and legacy non-collection behavior remains unchanged (Prerequisites: T024).
- [ ] T029 [P] [US1] Write desktop Chromium preset/select/read/reload/unauthorized-direct-attempt critical paths in `frontend/tests/e2e/collections-preset.spec.ts` and matching WebKit/mobile keyboard/light-dark/360px paths in `frontend/tests/e2e/collections-preset.mobile.spec.ts`; use synthetic local data and meaningful pre-implementation failures (Prerequisites: T024).

### Implementation

- [X] T030 [US1] Register private GET `/api/admin/calendar/collections`, POST `/preview`, PUT save and GET `/api/user/calendar/widgets/:widgetId/collections` in `backend/src/api/admin-collections.ts` and `backend/src/api/index.ts`; reuse requireAdmin/requireAuth/assertCsrf, explicit auth-first validation, scoped 2 MiB body-limit→413 handling and safe service errors (Prerequisites: T025, T015, T019, T022).
- [X] T031 [US1] Register only GET `/api/public/calendar/widgets/:widgetId/collections` in `backend/src/api/public.ts`, using collection-specific resolver before detailed range diagnostics, no-store and existing per-IP widget limiting; expose no mutation/admin catalogue and never fall back to loose legacy Calendar routes/snapshot cache (Prerequisites: T026, T019, T020, T030).
- [X] T032 [US1] Test query separation first in `frontend/tests/unit/collectionHooks.test.tsx`, then implement typed admin/config/preview/save and auth/public widget display hooks in `frontend/src/state/collectionHooks.ts` via `frontend/src/lib/apiClient.ts`; use `collections` prefix plus mode/session/widget/window, invalidate after edits/restore, clear denied 401/403/404 data, never reuse privileged cache after logout/account change, and provide active-only 30s refresh plus immediate focus/visibility/resume refetch (Prerequisites: T030, T031).
- [X] T033 [US1] Implement household preset/custom-entry draft builder and preset form in `frontend/src/components/settings/CollectionManager.tsx`: explicit timezone, weekday and normal Recycling anchor, red weekly/yellow fortnightly A/green B anchor+7 civil days, private optional provider label, “customisable, verify provider” copy and ≥four-week preview (Prerequisites: T027, T032, T021).
- [X] T034 [US1] Wire preview/digest invalidation, Save/Cancel, field/conflict/transient error retention and deliberate stale-draft refetch/rebase in `frontend/src/components/settings/CollectionManager.tsx`; no save without current valid preview, no automatic preset reseeding or silent timezone change (Prerequisites: T033).
- [X] T035 [US1] Mount/load the manager only for administrators inside the existing CalendarsPanel of `frontend/src/components/settings/IntegrationsTab.tsx`; preserve provider management and deny generic manage-granted non-admins any private fetch/control (Prerequisites: T034).
- [X] T036 [US1] Extend `frontend/src/components/widgets/CalendarConfigForm.tsx` with normal stream and separately labelled public-subset selections, public dashboard-context guidance and default-empty parsing; remove the zero-provider early return for collections, uncheck public IDs when normal IDs are removed, preserve all provider controls/IDs and use existing admin widget save flow (Prerequisites: T032, T035, T014).
- [X] T037 [US1] Implement shared semantic date-group rendering in `frontend/src/components/calendar/CollectionGroup.tsx` with configured-colour decorative bin icons plus visible wrapped names, actual weekday/date, explicit household Today/Tomorrow/timezone, all next-date streams and quieter later groups; use existing tokens, ≥44px actions and no new widget/motion library (Prerequisites: T028, T021).
- [X] T038 [US1] Compose provider rows and separate collection subgroups by civil date in `frontend/src/components/calendar/AgendaView.tsx`; preserve browser-local timed/provider headers and maxEvents, never slice collections by provider 200/maxEvents limits, and show independent loading/empty/error/retry states without hiding the successful branch (Prerequisites: T037).
- [X] T039 [US1] Connect widget-scoped collection hooks/visibility and server-derived daysAhead to `frontend/src/components/widgets/CalendarWidget.tsx`; support collections-only widgets, refresh foreground household midnight labels/range within 60s using server context, retain clearly marked transient stale data versus denied-content removal, and pass originating widget/context into fullscreen without admin config fetches (Prerequisites: T032, T036, T038).
- [X] T040 [US1] Add typed bounded collection month-grid and complete day-detail groups to `frontend/src/components/calendar/FullScreenCalendar.tsx` and pass exact provider scope from `frontend/src/components/widgets/CalendarWidget.tsx`; for collection-enabled widgets an empty sourceIds means no providers, bypassing the legacy all-sources fallback, while mixed mode reads only selected providers and widgets without collections retain legacy behavior; use originating widget scope/fullscreen active-query signal, initialize month from householdToday, label separate Today controls, and preserve provider navigation/overlay focus patterns (Prerequisites: T039).
- [X] T041 [US1] Add save/reload/restart equality and provider/birthday/source-selection regression cases in `backend/tests/integration/collectionPreset.test.ts`; verify the exact Sydney four-Wednesday preset, 2026-10-15 rejection, read/preview purity and unchanged IDs/rules/selection after restart (Prerequisites: T030–T040).
- [ ] T042 [US1] Run focused US1 unit/contract/integration and both preset Playwright files using the existing Chromium/mobile-safari projects, plus baseline provider/birthday/public-bootstrap/backup regressions; record raw results and offline setup/read smoke in `specs/065-bin-collection-calendar/logs/08-phase-preset.md`, resolving all failures before MVP checkpoint (Prerequisites: T029, T041).

**Checkpoint**: Safe functional MVP; persistence, roles, public opt-in,
date-only labels and existing Calendar/fullscreen integration are included.
Release still requires final cross-cutting gates, not merely this checkpoint.

---

## Phase 4: User Story 2 — Match a Different Local Service (Priority: P1)

**Goal**: Start custom without accepting preset; manage stable independent named/
coloured streams, every selected weekday in a 1–52-week active cycle, disable/
re-enable and confirmed removal without changing other streams.

**Independent Test**: Custom weekly Rubbish Monday+Thursday, weekly FOGO,
fortnightly Monday Recycling and Tuesday Glass match an independent calendar.
Test all-seven/three-weekday patterns and 2026-12-31 fortnightly → Jan 14/28.
Rename/recolour leaves dates intact; disable/re-enable preserves phase; removal
prunes only the removed stream's children and widget selections.

### Tests first

- [X] T043 [US2] Start `specs/065-bin-collection-calendar/logs/09-phase-custom-streams.md`, recording the custom-without-preset and identity/isolation acceptance matrix (Prerequisites: T042).
- [ ] T044 [P] [US2] Write independent custom CRUD/reorder/disable/removal tests in `backend/tests/integration/collectionCustom.test.ts`, including same names/colours, one-to-seven weekday sets, 1/52-week limits, year-boundary phase, confirmations, malformed unrelated widget JSON and preservation of all other streams/provider config (Prerequisites: T043).
- [X] T045 [P] [US2] Write custom-first regular editor and bounded validation tests in `frontend/tests/unit/CollectionStreamEditor.test.tsx` for empty weekday/invalid interval/normal anchor/name/colour/timezone/limits, no forced alternation, disabled draft retention and removal confirmation (Prerequisites: T043).
- [X] T046 [P] [US2] Write desktop custom/setup/edit/select and WebKit mobile keyboard paths in `frontend/tests/e2e/collections-custom.spec.ts` and `frontend/tests/e2e/collections-custom.mobile.spec.ts`, covering same-colour long names, multiweekday preview, disable/re-enable and confirmed removal (Prerequisites: T043).

### Implementation

- [X] T047 [US2] Implement regular stream fields in `frontend/src/components/settings/CollectionStreamEditor.tsx` with Monday–Sunday checkboxes, integer 1–52-week interval, selected-weekday normal anchor, name/hex colour/enabled, labelled “Every 4 weeks” not “Monthly”, 360px stacking and field-linked semantic errors (Prerequisites: T045).
- [X] T048 [US2] Integrate custom-first add/edit/reorder/disable/re-enable and confirmed removal into `frontend/src/components/settings/CollectionManager.tsx` using the regular editor and aggregate preview/save, keeping stable UUIDs and never auto-publishing/selecting new streams (Prerequisites: T047).
- [X] T049 [US2] Verify/fix aggregate diff and destructive-confirmation behavior in `backend/src/services/collectionService.ts` against T044, including identity-preserving renames/recolours, consecutive ordering, disabled schedule validation, transactional selection pruning and exact child-only deletion (Prerequisites: T044, T048).
- [X] T050 [US2] Refresh labels/enabled availability after custom saves in `frontend/src/state/collectionHooks.ts` and `frontend/src/components/widgets/CalendarConfigForm.tsx`; prune removed IDs without resetting provider fields or broadening public selection, and retain selection across rename/recolour (Prerequisites: T049).
- [X] T051 [US2] Add hand-enumerated weekly/fortnightly/four-week/52-week and seven/three/one-weekday custom preview fixtures to `backend/tests/integration/collectionCustom.test.ts`, verifying no editing action reschedules another stream and interval labels do not imply monthly inference (Prerequisites: T050).
- [X] T052 [US2] Verify custom manager loading/configured-zero-streams/disabled/error states and actionable input limits in `frontend/src/components/settings/CollectionManager.tsx`; preserve failed drafts/cancel behavior and private provider label, without adding import/lookup/property scope (Prerequisites: T051).
- [X] T053 [US2] Run focused custom/backend/frontend tests and both custom Playwright files plus preset/provider regressions; record raw outputs and fix failures in `specs/065-bin-collection-calendar/logs/09-phase-custom-streams.md` (Prerequisites: T046, T052).

**Checkpoint**: Custom regular services independently usable; no mandatory
preset, shared-colour identity confusion or implicit new public content.

---

## Phase 5: User Story 4 — Read Correct Dates Safely on Any Device (Priority: P1)

**Goal**: Complete date-context/refresh, responsive accessible presentation,
public revocation/cache isolation and all permitted state semantics. Base
authorization and safe display already exist in foundation/US1.

**Independent Test**: Sydney/Auckland households, UTC/Los Angeles visitors and
fake server instants spanning DST/midnight yield identical civil collection
dates; open foreground range/labels update within 60 seconds and resume
refetches immediately. At 360px/desktop light/dark, every next-date name is
accessible via keyboard and grouped detail. Revoked public selection clears
the next fetch's previously rendered content without leaking private metadata.

### Tests first

- [X] T054 [US4] Start `specs/065-bin-collection-calendar/logs/10-phase-safe-reading.md` with timezone/visibility/cache/permission/accessibility matrix and provider/browser Today non-regression obligations (Prerequisites: T053).
- [ ] T055 [P] [US4] Write fake-time/visibility/query lifecycle tests in `frontend/tests/unit/collectionRefresh.test.tsx` for server-clock context, Sydney/Auckland DST, ≤60s midnight range+label rollover, delayed background timers/immediate resume, fullscreen activity, no offscreen polls and no duplicate raw per-widget intervals (Prerequisites: T054).
- [ ] T056 [P] [US4] Extend `backend/tests/integration/collectionPublic.test.ts` for forged context headers, no-designation/malformed/removed subset, authorization-before-diagnostics, read-only unauth methods, rate/size bounds and exact no-leak DTO/bootstrap assertions on every public path (Prerequisites: T054).
- [X] T057 [P] [US4] Write logout/account-switch/revocation/transient failure cache tests in `frontend/tests/unit/collectionVisibility.test.tsx`; require denied data removal, public/auth key separation, explicitly stale last-good display only for transient failures and preservation of successful provider content (Prerequisites: T054).
- [ ] T058 [P] [US4] Write Chromium timezone/midnight/public and mobile-safari keyboard/responsive critical paths in `frontend/tests/e2e/collections-reading.spec.ts` and `frontend/tests/e2e/collections-reading.mobile.spec.ts`, covering same-colour/80-char names, 32 due streams, crowded complete detail, all relevant empty/error states and overlay focus restoration (Prerequisites: T054).

### Implementation

- [X] T059 [US4] Complete visibility-gated TanStack Query refresh in `frontend/src/state/collectionHooks.ts`: visible collection requests at 30s or a faster justified bounded cadence satisfying the plan, no hidden/background polls, immediate focus/visibility/resume refetch, fullscreen active independently of offscreen widget, and new server-derived range at household midnight; avoid raw intervals/Sonos-specific polling (Prerequisites: T055).
- [X] T060 [US4] Complete denied-cache removal, session/public invalidation and safe transient stale handling in `frontend/src/state/collectionHooks.ts` and `frontend/src/state/queryClient.tsx`, using existing session/restore reset signals without clearing unrelated successful provider state (Prerequisites: T057, T059).
- [X] T061 [US4] Complete household day-state updates in `frontend/src/lib/collectionDates.ts` and `frontend/src/components/widgets/CalendarWidget.tsx`, using serverNow plus elapsed time rather than inaccurate initial visitor wall clock; all-day Today lasts the whole household date, timezone changes preserve entered keys, no guessed collection time or outside-range “next” (Prerequisites: T059, T060).
- [X] T062 [US4] Complete distinct permitted unconfigured/not-selected/disabled/no-range/exhausted/loading/error states in `frontend/src/components/calendar/AgendaView.tsx`; public empty stays generic no_dates and non-admin setup copy never mounts private management; preserve separate provider and household Today meanings (Prerequisites: T061).
- [X] T063 [US4] Refine semantic headings/list rows, wrapped visible names, colour-independent text, complete scrollable next group and light/dark focus/touch treatment in `frontend/src/components/calendar/CollectionGroup.tsx`; prevent provider maxEvents truncation and horizontal overflow at ~360px (Prerequisites: T062).
- [X] T064 [US4] Complete fullscreen midnight/current-date context, month-range fetch, separately labelled household/provider Today, crowded-cell “+N more” accessible complete day detail, Escape/keyboard navigation and trigger focus restoration in `frontend/src/components/calendar/FullScreenCalendar.tsx`; retain provider ISO-fetch semantics (Prerequisites: T063).
- [X] T065 [US4] Address expanded policy matrix findings in `backend/src/api/public.ts`, `backend/src/services/publicVisibility.ts` and `backend/src/services/collectionService.ts`, strictly within the collection branch; preserve legacy provider visibility, non-enumerate denied widgets and catch private-input errors before logger exposure (Prerequisites: T056, T064).
- [ ] T066 [US4] Add regression fixtures/results to `backend/tests/integration/calendar-phase7.test.ts`, `backend/tests/integration/birthdayCalendar.test.ts` and `frontend/tests/unit/collectionCalendar.test.tsx` for mixed provider/timed/birthday/source colour/selection behavior with differing household/browser dates and collections-only mode (Prerequisites: T065).
- [ ] T067 [US4] Run focused clock/cache/public tests across UTC, Australia/Sydney, Pacific/Auckland and America/Los_Angeles process/browser contexts plus both reading Playwright files under Chromium/mobile-safari; record raw red/green outcomes in `specs/065-bin-collection-calendar/logs/10-phase-safe-reading.md` and resolve failures (Prerequisites: T058, T066).
- [ ] T068 [US4] Record manual semantic screen-reader, keyboard, touch, 360px/desktop/light-dark and reduced-motion checks in `specs/065-bin-collection-calendar/logs/10-phase-safe-reading.md`, checking names/date/context/error announcements, dialog focus, ≥44px actions and no clipping; do not substitute screenshots for accessible behavior (Prerequisites: T067).
- [ ] T069 [US4] Close safe-reading only after midnight ≤60s, resume/no-unnecessary-polls, revoke-next-fetch, permission/privacy and provider regression evidence is green in `specs/065-bin-collection-calendar/logs/10-phase-safe-reading.md`; record any unavailable manual tooling as a blocker, not a pass (Prerequisites: T068).

**Checkpoint**: Read behavior is date-correct, bounded, private by selection,
accessible and stable across visitor timezones. Human SC-005 evidence remains a
separate final validation obligation.

---

## Phase 6: User Story 3 — Handle Holidays and Irregular Calendars (Priority: P2)

**Goal**: Edit finite explicit dates and reversible per-stream skip/move/add
exceptions with preview, complete collision validation and safe mode transitions.
No automatic holiday/monthly/seasonal inference.

**Independent Test**: Weekly Friday 2026-12-25→26 leaves Jan 1; fortnightly
Dec 25→24 leaves Jan 8. Skip/add/remove in a twice-weekly stream changes only
those occurrences. A different explicit stream shows only 2026-12-14,
2027-01-18, 2027-02-15, then exhausted. Same-stream collisions/orphans/stale
drafts cause no partial changes; resolving all conflicts together saves atomically.

### Tests first

- [X] T070 [US3] Start `specs/065-bin-collection-calendar/logs/11-phase-irregular-dates.md` with moved-in/out-of-range, restoration collision, orphan/mode/destructive-confirmation and backup-durability coverage (Prerequisites: T069).
- [ ] T071 [P] [US3] Write full save/preview exception and explicit-mode acceptance tests in `backend/tests/integration/collectionExceptions.test.ts`, covering earlier/later/outside-origin targets, duplicate base/add/replace destinations, suppressed-base legitimate target, removing skip restoring collision, atomic multi-edit resolution, disabled validation and stable unaffected cycles (Prerequisites: T070).
- [ ] T072 [P] [US3] Write explicit editor tests in `frontend/tests/unit/CollectionExplicitDatesEditor.test.tsx` for strict unique bounded dates, no extrapolation, past-only/exhausted distinction, field errors and explicit→regular confirmation (Prerequisites: T070).
- [ ] T073 [P] [US3] Write exception editor tests in `frontend/tests/unit/CollectionExceptionEditor.test.tsx` for origin/actual labelling, skip/move/add/removal, conflict/orphan feedback, confirmation lists, preview invalidation and retained stale/error drafts (Prerequisites: T070).
- [ ] T074 [P] [US3] Write Chromium irregular/edit/preview/conflict/retry and WebKit/mobile keyboard paths in `frontend/tests/e2e/collections-irregular.spec.ts` and `frontend/tests/e2e/collections-irregular.mobile.spec.ts`, including exhausted lists, safe mode switches and concurrent admin changes (Prerequisites: T070).

### Implementation

- [X] T075 [US3] Implement `frontend/src/components/settings/CollectionExplicitDatesEditor.tsx` with unique date-only list add/edit/remove, supported bounds and remaining-future-date copy, no inferred continuation/monthly/seasonal algorithm, retained field errors and accessible mobile controls (Prerequisites: T072).
- [X] T076 [US3] Implement `frontend/src/components/settings/CollectionExceptionEditor.tsx` with stable exception IDs, base-origin picker/actual-date fields, Skip/Move/Add, reversible remove confirmation and concise impact/blocker display without modifying base anchors/weekday sets (Prerequisites: T073).
- [X] T077 [US3] Integrate regular/explicit modes and exception editor into `frontend/src/components/settings/CollectionStreamEditor.tsx`; explicitly confirm cleared dates/removed incompatible exception IDs, report orphan origins for resolution and never silently retarget/discard exceptions (Prerequisites: T075, T076).
- [X] T078 [US3] Extend manager preview/save/rebase feedback in `frontend/src/components/settings/CollectionManager.tsx` for unsaveable semantic preview blockers, deliberate confirmation and atomic multi-conflict resolution; preserve all unsaved fields on 409/422/500 and require a new digest after any edit (Prerequisites: T077).
- [X] T079 [US3] Address T071 acceptance gaps in `backend/src/services/collectionDates.ts` and `backend/src/services/collectionService.ts`; validate the entire exception set outside preview, suppress origins before target collision checks, reject removal-induced collisions and stale epoch/revision, and never silently deduplicate or mutate other streams (Prerequisites: T071, T078).
- [X] T080 [US3] Extend v2 roundtrip/v1 full-replacement/invalid-restore tests in `backend/tests/integration/collectionBackup.test.ts` with disabled exceptions, explicit lists, moved dates, widget public selections and pre-restore draft whose persisted revision equals restored revision; assert process epoch rejects it and every authoritative value/FK survives (Prerequisites: T079).
- [X] T081 [US3] Extend `frontend/tests/unit/collectionCalendar.test.tsx` for actual-date grouping of moved cross-month dates, no origin duplicate, explicit-only/exhausted/no-range states and complete same-date different-stream detail in agenda/fullscreen (Prerequisites: T079, T080).
- [X] T082 [US3] Run focused exception/editor/backup/date tests and both irregular Playwright files, then all prior story regressions and isolated offline setup/edit/preview/read smoke; capture raw outputs and fixes in `specs/065-bin-collection-calendar/logs/11-phase-irregular-dates.md` (Prerequisites: T074, T081).
- [ ] T083 [US3] Close irregular-date phase after SC-003/SC-008 automated cases and backup/data-isolation evidence pass in `specs/065-bin-collection-calendar/logs/11-phase-irregular-dates.md`; retain unavailable human/offline evidence as blockers rather than claiming completion (Prerequisites: T082).

**Checkpoint**: All stories implemented as independently verifiable increments;
exceptions preserve cycles, explicit calendars never extrapolate, all edits
and restores are bounded/atomic.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Operational documentation, success evidence and mandatory final
candidate gates. These tasks do not authorize a commit, PR or release.

- [X] T084 Start `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md`, indexing every final gate and recording candidate revision/dirty-diff identity so branch changes invalidate prior gate evidence; this validation phase may start after US1 independently of later stories, but full-feature coverage must remain pending until all stories pass (Prerequisites: T042).
- [X] T085 [P] Update `docs/getting-started.md` with preset/custom setup, provider-verification warning, household timezone confirmation, regular/explicit/exception editing, normal/public selections and Calendar-only icon+text behavior; document exact limits and no new env/dependency/runtime service (Prerequisites: T084).
- [X] T086 [P] Update `docs/operations.md` with atomic conflicts/retry/request-ID diagnostics, additive migration/FK checks, lossless v2/new-reader-v1 warning, full-replacement/reauth semantics, pre-upgrade DB backup plus matching prior-image recovery and v2 incompatibility on old readers; keep private labels/environment out (Prerequisites: T084).
- [X] T087 [P] Complete the collection threat/mitigation note in `specs/065-bin-collection-calendar/constitution-check.md` for hostile-LAN guessed IDs/forged context/admin bypass/CSRF/public-cache revocation/oversized input/concurrent edits/restore, linking actual tests without weakening CH-02 or claiming LAN trust (Prerequisites: T084).
- [ ] T088 Exercise every `specs/065-bin-collection-calendar/quickstart.md` smoke scenario and record independent 24-month oracle, ≤731-day/max-32-stream bounded performance measurement and no unnecessary foreground/background polling evidence in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md`; treat warm 90-day p95 <200ms as measured target, not an invented pass (Prerequisites: T085–T087).
- [ ] T089 Record SC-001 setup and SC-005 readability study protocol/results with ten representative administrators/residents in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md` (9/10 within 3min setup and 10s next-date/all-stream identification at 360px/desktop), plus screen-reader/keyboard checks; if participants are unavailable, explicitly block those claims (Prerequisites: T088).
- [X] T090 Complete preservation/upgrade fixtures in `backend/tests/integration/collectionMigration.test.ts` and `backend/tests/integration/migrationIntegrity.test.ts`, covering populated current-main DB→candidate, restart/repeated migrations, original provider/birthday/widget/selection/backup equality, empty unseeded install and FK integrity using disposable copies only (Prerequisites: T088).
- [ ] T091 At the separately authorized PR-preparation stage after refreshing against current main, run `pnpm version:bump-main` then `pnpm version:check`, updating only `versions.json` main and the blue `README.md` Main Version badge by one patch step; do not alter release/package.json/green badge, commit/push/open PR or dependency PRs #2/#18 (Prerequisites: T089, T090, separate PR-preparation authorization).
- [X] T092 Run full `pnpm --filter backend test`, `pnpm --filter frontend test:unit`, `pnpm --filter frontend test:e2e` (both Chromium and mobile-safari critical specs), `pnpm typecheck`, `pnpm build` and `pnpm format:check` under Node 24/pnpm 11; compare pre-existing unrelated formatter findings with baseline/main, fix feature failures and capture raw sidecars in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md`; run independently of PR permission/version preparation and repeat applicable gates after T091 or any candidate changes (Prerequisites: T088, T090).
- [X] T093 Invoke `code-review-standard` on the final candidate branch diff, resolve significant findings and record review/evidence in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md`; implementation authorization still does not imply PR/commit permission (Prerequisites: T092).
- [X] T094 Invoke `design-taste` and `emil-design-eng` for settings/agenda/fullscreen/config UI, retaining existing tokens and immediate dense-list behavior; resolve accessibility/mobile/keyboard/focus findings and record light/dark/360px/desktop evidence in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md` (Prerequisites: T093).
- [X] T095 Invoke `pre-pr-upgrade-gate` and execute its prescribed `pnpm test:upgrade` proof for the final candidate Docker image starting on a DB created by current main, preserving existing configuration and FK integrity; keep raw logs and fixture comparison in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md`, never use live data (Prerequisites: T090, T094).
- [X] T096 Invoke `lint-gate` and run full root `pnpm lint` under Node 24 after all final edits, requiring exit 0 and zero warnings; record raw evidence in `specs/065-bin-collection-calendar/logs/12-phase-final-validation.md` and rerun changed-behavior tests/build/reviews/upgrade as necessary if fixes change the candidate (Prerequisites: T095).
- [ ] T097 Validate all story acceptance/FR/SC coverage, task statuses and phase/raw-sidecar/index links in `specs/065-bin-collection-calendar/tasks.md` and `specs/065-bin-collection-calendar/logs/readme.md`; close only after all stories and green applicable suites/gates, with honest unresolved human/operational blockers, then hand off without commit/push/PR actions (Prerequisites: T053, T069, T083, T089, T096).

**Checkpoint**: Final candidate has documented operational/privacy behavior,
safe upgrades/backups and complete local gates. On later candidate changes,
rerun required gates. GitHub checks are supplemental; do not open/merge a PR
while any mandatory gate fails. A later PR requires separate authorization.

---

## Dependencies & Execution Order

### CH-03 Refactor Tasks (owner authorised 2026-10-10)

Original checked tasks remain historical evidence, not proof of the revised
candidate. Outstanding original matrices/human evidence are not marked complete.

- [x] R001 Update issue #19, spec CH-03, plan, model, UI/API contracts and phase audit before implementation.
- [x] R002 Extend recurrence bounds and icon allowlist with positive/negative date/validation tests (Prerequisite: R001).
- [x] R003 Generate additive migration; preserve old event IDs/rules/selections and backup v2 legacy defaults (Prerequisite: R002).
- [x] R004 Validate save/public/restore and migration compatibility; commit foundation phase after lint (Prerequisite: R003).
- [x] R005 Add Custom Events button/dialog beside Birthdays; remove inline household manager (Prerequisite: R004).
- [x] R006 Implement compact event list with one expanded series editor, Add Event, default one-off and additive bin preset (Prerequisite: R005).
- [x] R007 Add title/icon/colour, Repeat Off/Weekly/Fortnightly/Custom, first/end dates and advanced occurrences (Prerequisite: R006).
- [x] R008 Update agenda/fullscreen icons and custom-event selection/empty labels without changing provider behavior (Prerequisite: R007).
- [x] R009 Test one-off create/edit, recurrence stop, legacy rules, isolated delete, cancelled drafts and public icon selection (Prerequisite: R008).
- [x] R010 Run desktop/mobile browser flows, unit suites, typecheck/build and full lint; update docs/audit and commit UI phase (Prerequisite: R009).
- [x] R011 Verify rebuilt isolated preview and final review; no push/PR or data wipe (Prerequisite: R010).

### CH-04 Correction Tasks (owner review 2026-10-10 1507 UTC+11)

- [x] R012 Replace the Custom Events modal with an in-page expandable manager panel launched from the admin Calendar Sources controls (no popup/dialog overlay); remove `CustomEventsDialog` (Prerequisite: R009).
- [x] R013 Make native date pickers theme-visible (dark-mode `color-scheme`) and touch-friendly (≥44px on coarse pointers) for all event date fields; align spec/UI contract/changelog (Prerequisite: R012).
- [x] R014 Re-validate collections E2E (desktop + mobile-safari), unit suite, typecheck/build and full lint after the in-page refactor (Prerequisite: R013).
- [x] R015 Compact the expanded event editor and replace the inline icon grid with the shared anchored Popover; validate desktop field alignment, 360px containment, no title-row reflow, selection/Escape focus return, disabled options and unchanged edit/save/delete flows (Prerequisite: R014). Evidence: `logs/20-phase-editor-density.md`.

### Phase and story graph

```text
Separate implementation authorization
  → Setup T001–T004
  → Foundation T005–T023
  → US1 P1 T024–T042 (safe MVP)
  → US2 P1 T043–T053 (custom regular management)
  → US4 P1 T054–T069 (complete timezone/cache/accessibility acceptance)
  → US3 P2 T070–T083 (irregular/exception editors)
  → Full-feature validation T084–T090, T092–T097
  → Separate PR-preparation authorization → T091 → repeat affected final gates
```

These dependencies are intentional, not a claim that all stories can be edited
in parallel. The manager/editor/hooks/service/calendar files are shared.
US2 builds on the US1 manager/API; US4 completes the common reading path; US3
extends the US2 editor and uses the tested US4 read path. Each story checkpoint
is testable with its own fixtures and prior stable infrastructure, without
requiring a later story. The shared foundation already supports full exception/
explicit validation and backup so later UI cannot introduce unchecked state.

### Within each phase

The `Prerequisites:` clause on every task is authoritative. Ranges mean **all**
tasks inclusively, not merely the last ID. Tests precede behavior, schemas precede
generated migrations, semantic validation precedes save/restore, resolvers
precede public routes, and hooks/group components precede view integration.
Never execute T091 during task generation or interpret it as PR authorization.
Any significant finding/fix sends the candidate back through affected tests
and required review/UI/upgrade/lint gates.

### Genuine parallel opportunities

Only these batches are marked `[P]`; run them after their common prerequisite:

| Batch | Common prerequisite | Independent targets |
| --- | --- | --- |
| T003 + T004 | T002 | Backend fixtures vs frontend E2E helpers |
| T006–T009 | T005 | Date oracle, migration, service and backup test files |
| T025–T029 | T024 | API contract, public integration, manager unit, Calendar unit, E2E files |
| T044–T046 | T043 | Custom backend, editor unit and E2E files |
| T055–T058 | T054 | Refresh unit, public integration, visibility unit and reading E2E files |
| T071–T074 | T070 | Exception backend, explicit editor unit, exception editor unit and E2E files |
| T085–T087 | T084 | Setup docs, operations docs and threat note |

All shared-file implementation tasks are deliberately serialized. E2E authoring
may be parallel with other test authoring; actual suites must not concurrently
mutate the same E2E DB/server or global process timezone.

## Parallel Examples Per User Story

### US1

After T024, author T025 `backend/tests/contract/collections.test.ts` alongside
T027 `frontend/tests/unit/CollectionManager.test.tsx` and T028
`frontend/tests/unit/collectionCalendar.test.tsx`. Do not overlap T033/T034/T035
manager/integration work with another task editing those files.

### US2

After T043, author T044 `backend/tests/integration/collectionCustom.test.ts`
alongside T045 `frontend/tests/unit/CollectionStreamEditor.test.tsx` and T046
the custom E2E pair. T047→T048→T049→T050 is serialized integration.

### US4

After T054, author T055 `frontend/tests/unit/collectionRefresh.test.tsx`
alongside T056 `backend/tests/integration/collectionPublic.test.ts` and T057
`frontend/tests/unit/collectionVisibility.test.tsx`. T059/T060 share hooks
and cannot be run together.

### US3

After T070, author T072 `frontend/tests/unit/CollectionExplicitDatesEditor.test.tsx`
alongside T073 `frontend/tests/unit/CollectionExceptionEditor.test.tsx` and
T071 `backend/tests/integration/collectionExceptions.test.ts`.
T075/T076 are left unmarked: their behavior starts only after meaningful red
tests and is integrated serially by T077/T078.

## Coverage and Independent Verification

| Spec/contract area | Required tasks / proof |
| --- | --- |
| US1; FR-001–FR-004; SC-001 | T025–T042 exact preset, confirmed anchor/timezone, provider disclaimer, offline persistence; T089 representative setup study |
| US2; FR-005–FR-008; SC-002 | T006/T012, T044–T053 independent stable streams and N-week weekday sets; T088 24-month oracle/performance |
| US3; FR-009–FR-013; SC-003 | T008/T012/T013/T015 full-set validation, T071–T083 explicit/exception/editor/isolation/conflicts |
| US4; FR-014–FR-019; SC-004/SC-005 | T021/T028/T037–T040, T055–T069 typed Calendar-only icon+text groups/date clock/states/accessibility; T089 human readability |
| FR-020/FR-021; SC-007 | T014/T019/T020/T022, T025/T026/T030–T032, T056/T057/T060/T065 default-deny role/CSRF/projection/revocation/safe errors/limits |
| FR-022; SC-006 | T007/T009–T011/T016–T018/T023/T041/T080/T090/T095 migration/restart/FK/v2/v1/preserved records and epoch safety |
| FR-023; SC-008 | T033–T042, T074–T083, T088 offline/manual entry/no extrapolation; no runtime network scope |
| API draft/preview/save contract | T008/T013/T015/T025/T030/T032/T034/T079 complete draft, digest, revision/epoch, confirmations and rollback |
| API widget/public/display/backup contract | T014/T016–T020/T026/T031/T056/T060/T065/T080 allowlisted bounded reads, bootstrap privacy and lossless restore |
| UI contract and CH-02 | T027–T029/T033–T040/T045–T048/T055–T069/T072–T078/T094 visible names+bin icons, grouped dates, Calendar/fullscreen/settings only |
| Constitution/audit/release gates | T001/T005/T024/T043/T054/T070/T084/T087/T091–T097 phase logs, threat note, version tooling and full local review/UI/upgrade/Node24 lint |

## Implementation Strategy

### MVP first

Complete setup/foundation and US1, then stop and verify the four-Wednesday
offline preset as its own increment. US4's minimum security/date/accessible
projection and full migration/backup support are already part of this slice.
Do not expose an insecure “temporary” public catalogue or defer backup preservation.
To ship even this reduced increment, run the applicable polish/docs/full gates;
the presence of future stories does not waive those obligations.
T084 and T092–T096 are reachable from US1 without later-story or PR permission.
Run their applicable slice-specific docs and proof, leave T097/full-feature and
unimplemented story claims pending, and record skipped out-of-slice scenarios
explicitly. T091 is required only for separately authorised PR preparation;
it changes the candidate and requires subsequent revalidation before any PR.

### Incremental delivery

Add US2 custom regular management, then finish US4 timezone/refresh/accessible
reading, then US3 irregular dates. Each uses isolated fixtures and retains
previous provider/birthday/source-selection and prior-story regressions.
Complete documentation, human/operational evidence and separately authorized
version tooling at final candidate/PR preparation, then reviews, upgrade and
zero-warning lint. Do not add specialized bin import/export, multi-household,
notifications/completion, official lookup, seasonal/monthly inference or a widget.

### Pending approvals / unresolved validation dependencies

- No design clarification blocks task generation. One-household/manual-entry
  remain conservative documented defaults, not invented owner approvals.
- No application tests or gates have been executed by task generation.
- Implementation and later PR-preparation authorization are separate pending
  execution prerequisites; task creation does not approve a registered workflow
  `review-plan` gate or authorize any workflow invocation.
- Representative SC-001/SC-005 participants, screen-reader tooling and
  NAS-class performance/Docker upgrade execution must be available during
  implementation; unavailability blocks those claims, not artifact generation.
- T011's exact generated migration basename is determined by Drizzle at
  execution, not invented here; its owning command and destination are explicit.
- Preserve current dirty artifacts and leave dependency PRs #2/#18 untouched.
  Spec changes, if genuinely needed later, require CH-03/next changelog entry.

## Task Inventory

| Phase | IDs | Tasks | Parallel-marked |
| --- | --- | ---: | ---: |
| Setup | T001–T004 | 4 | 2 |
| Foundational | T005–T023 | 19 | 4 |
| US1 P1 — preset | T024–T042 | 19 | 5 |
| US2 P1 — custom regular | T043–T053 | 11 | 3 |
| US4 P1 — safe reading | T054–T069 | 16 | 4 |
| US3 P2 — irregular dates | T070–T083 | 14 | 4 |
| Polish | T084–T097 | 14 | 3 |
| **Total** | **T001–T097** | **97** | **25** |

All 97 checkboxes are intentionally unchecked. Completion requires recorded
execution evidence; generating this file completes none of its implementation tasks.
