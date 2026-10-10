# Feature Specification: Bin Collection Calendar

**Feature Branch**: `065-bin-collection-calendar`  
**Created**: 2026-10-10  
**Status**: Draft — specification validated; implementation not started  
**Issue**: [#19 — Calendar: Track recurring bin collection days](https://github.com/streetratz/HomeDash/issues/19)  
**Input**: Specify recurring household collections using the owner's configurable
AU/NZ preset, official council research, and independent schedules for other
locations. Deliver specification and audit artifacts only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Up the Household Preset (Priority: P1)

As an administrator, I want a short setup using my household's collection weekday,
timezone, and one known recycling date so residents can see the correct bins
without working out alternating weeks themselves.

**Why this priority**: Delivers the owner's requested everyday household use case.

**Independent Test**: Configure the preset for Wednesday with recycling anchored
to 2026-10-14. Preview and save it, select it in a Calendar widget, and inspect the
next four Wednesdays without connecting an external service.

**Acceptance Scenarios**:

1. **Given** no collection configuration, **When** an administrator chooses the
   preset, Wednesday, `Australia/Sydney`, and recycling date 2026-10-14,
   **Then** preview shows red General waste plus yellow Recycling on October 14
   and 28, and red General waste plus green Garden waste on October 21 and
   November 4.
2. **Given** that preview, **When** the administrator saves and reloads or restarts
   HomeDash, **Then** the same names, colours, enabled states, timezone, weekday,
   and alternating dates remain.
3. **Given** Wednesday selected, **When** the anchor supplied is Thursday
   2026-10-15, **Then** setup explains the mismatch and cannot save until corrected;
   it never silently changes the weekday or treats a holiday-shifted date as a
   normal anchor.
4. **Given** a saved schedule, **When** a resident views the selected Calendar
   agenda or fullscreen calendar, **Then** collections appear as all-day dates
   alongside existing events, with labelled streams and actual collection dates.

---

### User Story 2 - Match a Different Local Service (Priority: P1)

As an administrator, I want to add, rename, recolour, disable, remove, and schedule
each stream independently so a council's organics, glass, or rubbish service is
not forced into the preset.

**Why this priority**: Official AU/NZ and international examples demonstrate that
neither frequency, weekday, nor colour is universal.

**Independent Test**: Create custom streams without using the preset, then compare
their dates and presentation with a hand-written collection calendar.

**Acceptance Scenarios**:

1. **Given** custom streams, **When** General waste is weekly and FOGO is weekly
   while Recycling is fortnightly, **Then** both weekly streams occur every week;
   there is no forced recycling/organics alternation.
2. **Given** Rubbish on Monday and Thursday every week and Recycling on Monday
   only, **When** the resident opens the calendar, **Then** rubbish appears twice
   and recycling once each week without requiring duplicate stream definitions.
3. **Given** General waste on all seven weekdays, Recycling on Monday, Wednesday,
   and Friday, and Glass on Tuesday, **When** a week is viewed, **Then** there are
   seven, three, and one collection dates respectively.
4. **Given** a two-week Rubbish cycle anchored to Thursday 2026-12-31, **When**
   January is viewed, **Then** the next occurrences are 2027-01-14 and 2027-01-28;
   the year boundary does not reset its phase.
5. **Given** Green organics weekly on Monday and Red rubbish/Yellow recycling
   fortnightly on Tuesday in alternate weeks, **When** dates are previewed,
   **Then** each stream retains its own weekday and cycle.
6. **Given** two streams with the same colour, **When** one is renamed or
   recoloured, **Then** its dates and saved exceptions stay unchanged and each
   stream remains distinguishable by its text label.
7. **Given** a configured stream, **When** it is disabled, **Then** it disappears
   from due dates but retains its configuration; re-enabling restores the same
   cycle. Confirmed removal deletes that stream and its exceptions only.

---

### User Story 3 - Handle Holidays and Irregular Calendars (Priority: P2)

As an administrator, I want to move, skip, or add individual collections and enter
explicit dates for seasonal services so the calendar follows my published local
schedule without guessing holidays or redefining the regular cycle.

**Why this priority**: Accurate exceptions prevent misleading set-out advice;
explicit dates provide a bounded alternative to complex seasonal rules.

**Independent Test**: Apply exceptions to one recurring stream and configure a
different stream from a finite date list; compare every displayed occurrence.

**Acceptance Scenarios**:

1. **Given** weekly Rubbish on Friday, **When** 2026-12-25 is replaced with
   2026-12-26, **Then** it appears on December 26, not December 25, and the next
   regular date remains 2027-01-01 unless separately changed.
2. **Given** fortnightly Recycling on 2026-12-25 and 2027-01-08, **When** December
   25 is moved earlier to December 24, **Then** January 8 remains unchanged.
3. **Given** a twice-weekly stream, **When** the second collection in one holiday
   week is skipped and an additional collection is added for another date,
   **Then** only those occurrences change; the following week's weekday set is
   unchanged. Removing either exception restores the original schedule.
4. **Given** a provider's irregular or seasonal list, **When** an administrator
   enters 2026-12-14, 2027-01-18, and 2027-02-15 as an explicit-date schedule,
   **Then** exactly those dates appear, with no inferred dates between or after
   them. Once exhausted, the manager states that no future dates are configured.
5. **Given** a four-week cycle anchored to 2027-01-04, **When** previewed,
   **Then** January 4, February 1, and March 1 appear and the schedule is labelled
   “Every 4 weeks,” never “Monthly.” Actual monthly provider dates can instead
   be entered explicitly.
6. **Given** an already scheduled destination date for a stream, **When** another
   occurrence is moved or added to that same date, **Then** a conflict is explained
   and no duplicate or partial change is saved.

---

### User Story 4 - Read Correct Dates Safely on Any Device (Priority: P1)

As a resident, I want to identify today's, tomorrow's, and the next collection
using the household's date, and see only content I am permitted to view.

**Why this priority**: Readability, correct local dates, and existing visibility
policy are essential to the household-facing result.

**Independent Test**: View configured collections at 360px and desktop sizes,
using differing visitor timezones and permitted/forbidden roles.

**Acceptance Scenarios**:

1. **Given** collections tomorrow and later in the selected calendar range,
   **When** the resident opens the agenda, **Then** the next date and all streams
   due on it are grouped, identified by coloured bin icons and visible names,
   and labelled Tomorrow plus the actual weekday/date. The next collection group
   is prominent; later groups show their dated collection days with quieter
   emphasis. Narrow screens stack stream rows without hiding their names.
2. **Given** a collection due today, **When** its household date advances through
   midnight, **Then** it remains Today for the entire collection date and ceases
   to be upcoming after midnight; no unconfigured collection time is guessed.
   An already open view updates its relative labels within 60 seconds.
3. **Given** `Pacific/Auckland` or `Australia/Sydney` as household timezone and
   visitors in other timezones, **When** they view dates spanning daylight-saving
   changes, **Then** everyone sees the same collection dates and relative-day
   labels. Changing timezone preserves entered dates and recalculates Today/
   Tomorrow against the newly confirmed household timezone.
4. **Given** an authorised administrator, **When** configuration is changed,
   **Then** the change succeeds; anonymous visitors and signed-in non-admin users
   cannot change it, including through attempts outside the visible controls.
5. **Given** collection content not selected for public display, **When** an
   anonymous visitor requests it, **Then** it is unavailable. With explicit
   public selection on the designated dashboard and widget for that device
   context, only the selected read-only collection display is available;
   administration details remain private.
6. **Given** no setup, all streams disabled, no dates within the selected range,
   an exhausted date list, loading, or a failed load/save, **When** the applicable
   view is opened, **Then** it explains that specific state rather than presenting
   every case as “No collections.” Failed edits retain entered values for retry.
7. **Given** light/dark themes and 360px width, **When** a user navigates setup
   and reads collections by touch, keyboard, or screen reader, **Then** labels,
   dates, focus, and actions remain usable without colour-only identification,
   clipping, or horizontal page scrolling.

### Edge Cases

- Anchor dates on either side of the displayed range, leap day 2028-02-29, a
  53-week year, month/year boundaries, and timezone daylight-saving changes.
- An anchor is a normal cycle date, not a holiday-moved occurrence; setup cannot
  infer the correct fortnight solely from a suburb name or today's week number.
- Multiple selected weekdays in an N-week active week; Sunday/Monday boundaries;
  daily collection versus seven weekdays every second week.
- Disabled streams with exceptions; duplicate names/colours; different streams
  due on one date; a moved date landing in another month or before its origin.
- Removing an exception, changing a regular schedule with existing exceptions,
  and switching between regular and explicit-date schedules.
- Invalid dates, empty weekday selection, zero/fractional/negative intervals,
  invalid timezone/colour, blank names, repeated explicit dates, and conflicts
  targeting the same stream/date; invalid input must not partially overwrite data.
- An explicit-date list is exhausted, contains only past dates, or covers only part
  of a season; display never extrapolates an unconfirmed future collection.
- Public selection revoked while a view is open; data must cease being served on
  the next fetch. Household/provider labels and configuration must not leak.
- Existing birthdays, imported calendars, timed events, source selections,
  backups, and unrelated calendar settings remain intact.

## Requirements *(mandatory)*

### Functional Requirements

**Setup and independent streams**

- **FR-001**: Administrators MUST be able to choose the household preset or start
  with custom streams without accepting the preset first.
- **FR-002**: Preset setup MUST require an explicitly confirmed household timezone,
  one collection weekday, and one known normal Recycling date matching that
  weekday. It MUST preview at least four consecutive collection weeks before save.
- **FR-003**: The preset MUST create red General waste weekly, yellow Recycling
  fortnightly on week A anchored to the supplied date, and green Garden waste
  fortnightly on week B one week later, all on the selected weekday.
- **FR-004**: Setup MUST identify this as a customisable household starting preset,
  not an official schedule or universal AU/NZ policy, and tell administrators to
  check their actual provider calendar. Optional council/suburb/provider labelling
  MUST NOT require an address or external lookup.
- **FR-005**: Administrators MUST be able to add, edit, enable, disable, and remove
  streams, each with its own name, colour, and schedule. Name/colour changes MUST
  preserve stream identity, dates, and exceptions; disabled streams MUST not be
  displayed as due. Removal MUST require confirmation.

**Regular and explicit-date schedules**

- **FR-006**: Each regular stream MUST support a nonempty set of selected weekdays,
  an integer interval of 1–52 weeks, and a normal local anchor date on a selected
  weekday. Each selected weekday occurs in every active week of that cycle.
- **FR-007**: Active weeks MUST be Monday–Sunday weeks containing the anchor and
  repeating every N weeks. The anchor determines phase, not a creation/start date:
  navigation before or after it MUST retain the same phase. All seven weekdays at
  interval 1 MUST represent daily collection. Cycles MUST NOT reset at year
  boundaries or use odd/even annual week numbers to determine alternation.
- **FR-008**: Streams MUST be independently schedulable, including different
  weekdays, fortnightly General waste, weekly FOGO, separate glass/paper streams,
  and multiple weekly collection days. Editing one MUST not reschedule another.
- **FR-009**: Administrators MUST be able to use an explicit list of unique local
  dates instead of a recurring schedule for a stream. Only listed dates MUST be
  shown; the manager MUST clearly report when none remain in the future.
- **FR-010**: Initial scope MUST represent seasonal/irregular calendars through
  explicit dates or manual single-date exceptions, not inferred seasonal rules.
  Four-week recurrence MUST be labelled distinctly from calendar-month recurrence;
  automatic monthly and seasonal recurrence are outside this specification.

**Exceptions and safe editing**

- **FR-011**: Administrators MUST be able to skip a recurring occurrence, replace
  its date with an earlier or later date, or add a collection date. Exceptions MUST
  apply to one stream only and MUST leave the base anchor/cycle unchanged.
- **FR-012**: A skipped/replaced original date MUST not remain as a collection;
  removing its exception MUST restore its original occurrence. Removing an
  additional date MUST remove only that added occurrence. Each original occurrence
  MUST have at most one skip or replacement, and each stream MUST have at most one
  collection per actual date. Conflicting edits MUST be rejected without changing
  existing data. Explicit-date schedules are maintained by editing their dates,
  not by layering guessed recurrence.
- **FR-013**: Before saving a schedule change, administrators MUST preview the
  resulting dates and resolve exceptions whose original dates no longer belong
  to the new cycle. A switch of schedule mode MUST explicitly confirm removal of
  incompatible rules/exceptions; no stale or silently retargeted exception may
  survive. Saved changes MUST become visible on the next calendar refresh.

**Calendar presentation and date correctness**

- **FR-014**: Collection dates MUST be selectable for display in existing Calendar
  agenda and fullscreen views alongside other selected calendar content, without
  altering existing birthdays, imported sources, or timed-event behaviour. This
  owner-confirmed scope MUST NOT introduce a separate Bin Days widget. This
  specifies calendar behaviour, not how sources or events are implemented.
- **FR-015**: The collection agenda MUST group all enabled streams due on each
  actual date, in chronological order, and expose the next collection within the
  selected range. Each stream MUST retain its own name/colour in calendar display;
  a general calendar colour MUST not erase stream-specific identification.
- **FR-016**: Collection displays MUST pair bin icons in each stream's configured
  colour with visible text names and actual weekday/date, with Today/Tomorrow where
  applicable and clear household-timezone context. Text MUST remain readable
  independently of icon colour; icons MUST NOT replace names. The next collection
  group MUST be prominent, with later collection groups quieter. Narrow screens
  MUST stack stream rows rather than hide names. Collections are all-day
  obligations, not timed appointments or confirmation of completion.
- **FR-017**: Entered anchors, explicit dates, and exceptions MUST remain household
  calendar dates regardless of server/visitor timezone or daylight-saving changes.
  Relative-day labels MUST use the explicitly confirmed household timezone,
  rollover at its midnight, and update an open view within 60 seconds. Changing
  that timezone MUST not change entered collection dates.
- **FR-018**: Setup, preview, editing, and reading MUST work from approximately
  360px through desktop in light/dark themes, with touch-friendly and keyboard
  actions, visible focus, screen-reader labels, and text identification independent
  of colour. All action/date labels MUST remain readable without clipping.
- **FR-019**: Views MUST distinguish unconfigured, loading, disabled, no dates in
  range, exhausted explicit dates, and error states. Validation/save errors MUST
  explain the correction and preserve unsaved input.

**Permissions, privacy, and durability**

- **FR-020**: Only authenticated, authorised administrators MUST be able to mutate
  collection configuration, including exceptions and timezone. Other signed-in
  access MUST obey existing roles. Anonymous reads MUST be limited to content
  explicitly selected for the designated public dashboard/widget in the applicable
  web/mobile context, with no management capability or private configuration.
- **FR-021**: Names, colours, weekdays, intervals, timezones, anchors, and dates MUST
  be validated and bounded before save. Invalid or unauthorised changes MUST fail
  safely without partial writes, disclosure of private information, or changes to
  another stream. Private household labels MUST not appear in public responses.
- **FR-022**: Configuration and exceptions MUST survive reload and restart and be
  retained through existing full backup/restore and supported upgrades. Existing
  calendar configuration and records MUST be preserved.
- **FR-023**: Manual setup, recurrence, exception editing, and reading MUST function
  without internet access, cloud accounts, automatic council scraping/address
  lookup, or notification services. No automatic holiday adjustment is included.

### Key Entities *(include if feature involves data)*

- **Household collection configuration**: Confirmed timezone and optional private
  provider label for one household; shared date context for its streams.
- **Collection stream**: Stable identity, editable name/colour, enabled state, and
  one independent regular or explicit-date schedule.
- **Regular schedule**: Selected weekdays, interval in weeks, and normal local
  anchor date identifying its active-week phase.
- **Explicit-date schedule**: Finite authoritative collection dates entered by an
  administrator, with no implied continuation.
- **Occurrence exception**: Skip/replacement of one original regular date, or
  addition of an actual date; belongs to one stream and does not move the cycle.
- **Displayed collection**: One stream due on one actual household date, grouped
  with other streams on that date; not a completion record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 9 of 10 representative administrators, supplied with their
  weekday, timezone, and normal recycling date, can configure and verify the preset
  within 3 minutes without assistance.
- **SC-002**: All displayed dates match an independently prepared expected calendar
  across 24 consecutive months for weekly, fortnightly, every-four-weeks, multi-
  weekday, and daily examples, including year boundaries and a leap day.
- **SC-003**: 100% of skip, earlier/later replacement, addition, removal, and conflict
  acceptance cases alter only their intended occurrences; subsequent base-cycle
  dates are unchanged, with no duplicate collection for the same stream/date.
- **SC-004**: In every timezone acceptance case, residents in Sydney, Auckland, and
  an overseas visitor timezone see identical collection dates and household-relative
  Today/Tomorrow labels; an open view reflects household midnight within 60 seconds.
- **SC-005**: At least 9 of 10 representative residents correctly identify the next
  date and every stream due within 10 seconds on both a 360px display and desktop,
  including when stream colours are identical. Critical flows are operable using
  keyboard and screen reader without colour-based instructions.
- **SC-006**: All configured streams, exceptions, and explicit dates remain unchanged
  after reload, restart, full backup/restore, and supported upgrade tests; all
  pre-existing calendar records and selections are preserved.
- **SC-007**: 100% of permission acceptance cases allow authorised administration,
  reject unauthorised mutation, and prevent public reads of unselected collection
  content or management details, including after selection is revoked.
- **SC-008**: Every explicit-date and empty/error-state acceptance case shows only
  configured dates and explains its state; setup, preview, editing, and viewing
  complete with internet access disabled.

## Assumptions

- The red/yellow/green alternating preset is an explicit owner request. Council
  evidence informs customisation and tests; it does not override that request.
  See [research.md](research.md) for official examples and evidence mapping.
- **Owner-confirmed presentation and scope (2026-10-10)**: use coloured bin icons
  alongside visible names and grouped collection dates in the existing Calendar
  widget and fullscreen calendar. Do not create a separate Bin Days widget.
- **Draft scope defaults, not confirmed owner decisions**: one household collection
  configuration per HomeDash installation and manual authoritative date entry
  rather than bin-specific import. These are conservative limits for issue #19
  and can be revised explicitly before planning. No multi-property management is
  promised.
- Explicit-date schedules are included as the bounded first-release solution for
  seasonal/irregular/monthly provider calendars. A seasonal rule editor, automatic
  calendar-month recurrence (including short-month policies), and specialised
  collection import/export are deferred. Existing general calendar imports remain
  available but are not merged with guessed bin recurrence or reinterpreted.
- The weekday/cycle convention and 1–52-week interval are documented draft defaults,
  not council-derived restrictions. A known normal date may be past or future and
  anchors phase in either direction; preview makes its meaning visible.
- Administrators obtain their actual schedules and holidays from their provider.
  No address, council connection, country-wide schedule, or postcode is needed.
- Provider labels are optional private configuration, not extra public content.
  The household timezone must be confirmed, never silently taken from a visitor.
- Set-out times/notes, completion tracking, push/email notifications, automated
  holiday rules, address lookup/scraping, cloud dependencies, shared-container
  management, and collection booking are out of scope without owner approval.
- Existing calendar display/selection, authentication/roles, public widget policy,
  and full backup/restore are behavioural dependencies, not new architecture choices.
  Planning must assess reuse while keeping independent stream colours and household
  date semantics. Existing provider and birthday behaviour must not regress.
- Implementation must later supply positive/negative permission coverage, date and
  exception tests, critical setup/display flow tests, migration/upgrade evidence,
  and operational documentation under constitution 2.4.0. Spec-phase validation
  does not claim any of those implementation tests have passed.
- This invocation stops after specification, changelog, research, checklist, and audit
  artifacts. A plan/tasks, Main Version increment, commit with required trailers,
  push, PR, and implementation are not performed here; applicable release gates
  remain mandatory before a future implementation PR.
