# Data Model — Bin Collection Calendar

**Date**: 2026-10-10 UTC+11  
**Scope**: Planned schema; no application schema/migration generated in this phase.

## Aggregate and Ownership

One installation-wide household, managed by authenticated administrators using
existing `requireAdmin`. Not owned by the admin who originally creates it.
The authoritative aggregate is household → streams → explicit dates/exceptions.
Occurrence groups are computed DTOs, never completion records or persisted events.
Provider/birthday tables and user/source relationships remain unchanged.

## Tables

### `collection_household` (`collectionHousehold`)

| Field | Type / validation |
| --- | --- |
| id | TEXT PK, fixed `global`, singleton CHECK |
| timezone | TEXT NOT NULL, supported IANA name ≤100 chars, explicit confirmation on setup/edit |
| providerLabel | nullable TEXT ≤120 chars; trimmed non-control text, private |
| revision | INTEGER NOT NULL ≥1; increments once per successful aggregate save |
| createdAt / updatedAt | UTC ISO audit instants, server-assigned |

No row means unconfigured. An existing row with zero streams means configured
but no streams. Do not insert default household/preset during migration.
Timezone is separate from shell clock timezone: it may be suggested but requires
explicit confirmation; shell clock edits never silently change collections.

### `collection_streams` (`collectionStreams`)

| Field | Type / validation |
| --- | --- |
| id | TEXT UUID PK; stable across edits |
| householdId | TEXT NOT NULL FK household id, ON DELETE CASCADE |
| name | TEXT NOT NULL, trimmed 1–80 chars, no controls; duplicate names allowed |
| color | TEXT NOT NULL exact `#RRGGBB` (normalise hex case); duplicate colours allowed |
| icon | TEXT NOT NULL bundled allowlisted icon key; legacy default `Trash2` |
| enabled | INTEGER boolean NOT NULL |
| sortOrder | INTEGER 0–31; aggregate validator requires consecutive unique order; request array order canonical |
| scheduleMode | TEXT `regular` or `explicit` |
| weekdaysMask | nullable INTEGER 1–127; bit 0 Monday through bit 6 Sunday |
| intervalWeeks | nullable INTEGER 1–52 |
| anchorDate | nullable date key; on a selected weekday for regular mode |
| startDate / endDate | nullable inclusive regular occurrence bounds; null preserves legacy phase; explicit schedules require null |
| createdAt / updatedAt | UTC ISO audit instants, server-assigned |

Regular mode requires mask, interval and anchor. Explicit mode requires all
three null, at least one explicit date, and no exceptions. Mode CHECK guards
nullable shape; semantic validation guards anchor weekday and children.
Index householdId. **Chosen implementation**: no DB unique index on sortOrder; CHECK 0–31 and
aggregate validation enforce unique consecutive ordering. Identity PK remains
the authority; this avoids SQLite immediate per-row uniqueness during reordering.

### `collection_explicit_dates` (`collectionExplicitDates`)

| Field | Type / validation |
| --- | --- |
| streamId | TEXT FK stream id ON DELETE CASCADE |
| date | TEXT valid date key |

Composite PK `(streamId,date)` and indexed `(streamId,date)` for range reads.
Only explicit-mode streams have these rows; no duplicates or implied continuation.
Dates sorted canonically. Editing this list is the only explicit schedule
maintenance; regular exceptions cannot be attached to it.

### `collection_exceptions` (`collectionExceptions`)

| Field | Type / validation |
| --- | --- |
| id | TEXT UUID PK; stable while exception edited |
| streamId | TEXT NOT NULL FK stream id ON DELETE CASCADE |
| kind | TEXT enum `skip`, `replace`, `add` |
| originalDate | nullable date key; required for skip/replace, null for add |
| actualDate | nullable date key; null for skip, required for replace/add |
| createdAt / updatedAt | server UTC ISO instants |

CHECK enforces shape and replacement original != actual. Unique indexes
`(streamId,originalDate)` and `(streamId,actualDate)` allow SQLite multiple nulls,
prevent duplicate origins and duplicate explicit destinations. Stream index.
Only regular-mode streams may have these rows. Each origin must match the
**base** weekday/cycle, even if currently disabled. These indexes cannot detect
a collision with computed base dates; aggregate semantic validation must do so.

After validating final aggregate state, delete removed/changed exception rows
before reinserting changed rows in the same transaction. Preserve their IDs and
createdAt, update updatedAt only for changed rows, and leave unchanged rows alone.
This supports valid destination swaps under immediate unique constraints.
Any insertion failure rolls back deletions and all other aggregate changes.

No user/provider credential, URL, account, completion or recurring event table
reference is added. All date keys use the same strict representation.

## Input and Computation Limits

Implementation safety choices, not council-derived requirements:

| Input | Limit / rejection |
| --- | --- |
| Household count | exactly zero/unconfigured or one singleton |
| Streams | ≤32; no silent truncation |
| Dates | valid Gregorian `YYYY-MM-DD`, 1900-01-01 … 2199-12-31 inclusive; reject timestamp, rollover/invalid/leap date |
| Weekdays | unique integers Monday=1 … Sunday=7, nonempty; encode to mask |
| Interval | integer 1–52, no strings/coercion/fractional value |
| Explicit entries | 1–2,048 unique dates per explicit stream |
| Exceptions | ≤512 per regular stream |
| Aggregate entries | explicit dates + exceptions ≤8,192 across all streams |
| Name / provider label / timezone | 80 / 120 / 100 chars; trim text, reject controls; no address required |
| Request body | ≤2 MiB JSON for admin preview/save |
| Range | inclusive `from`/`to` date keys, from ≤ to, ≤731 days; display agenda alternatively uses server-derived `daysAhead` 1–90 |
| Widget selections | ≤32 unique UUIDs in each array; public subset of normal selection |

Strict Zod objects reject unknown fields, nulls where not allowed and numeric
coercions. DB CHECK/PK/FKs backstop structure; shared semantic validator applies
to requests, persistence writes and restore input. Validate timezone using the
runtime Intl-supported named zone and canonicalise; reject offsets as household
timezone and never silently fall back to server/browser zone.

Worst-case range output: 731 groups ×32 stream rows =23,392 occurrences.
Response contains the complete selected range, not an undocumented 200-row
truncation. UI scrolls/virtualises only if measured needed; next group is complete.

## State Transitions

| Transition | Required behavior |
| --- | --- |
| Unconfigured → preset/custom | confirmed timezone; four-week preset preview; atomic singleton + streams creation |
| Rename/recolour | same UUID, unchanged schedule/dates/exceptions |
| Disable/re-enable | retain configuration/phase; no displayed dates when disabled |
| Rule edit | preview; flag orphan origins/collisions; explicit resolution before save |
| Regular → explicit | explicit date list, clear regular fields and all exceptions, confirm removed exception IDs |
| Explicit → regular | valid fields/anchor, clear explicit dates after confirmation, do not guess phase |
| Add/skip/replace | one stream only; no base-anchor change; validate resulting dates |
| Remove exception | restore base origin or remove addition; reject resulting collision until resolved in same draft |
| Remove stream | explicit confirmed stream ID; cascade only its children, remove only its widget-selection IDs |
| Timezone edit | explicit confirmation; preserve every entered date key; recompute relative labels |
| Restore | validate full aggregate first, atomic full replacement, invalidate runtime epoch/drafts |

## Recurrence and Collision Algorithm

1. Parse date to Gregorian ordinal using strict roundtrip validation. This
   utility does not convert a real collection into an instant.
2. Find Monday ordinal for anchor/date. Euclidean modulo of signed week
   difference by interval chooses active weeks; selected weekday chooses days.
3. Generate requested range directly, including before anchor.
4. Suppress skip/replacement origins. Include replacement/add destinations in
   range even with origins outside it.
5. Reject actual-date duplicate per stream. Different streams on same date
   are valid and grouped. No dynamic phase changes, extrapolation or completion.

Validation examines the complete finite exception set and each destination's
base membership minus suppressed origins. It does not scan all dates since
anchor or assume a four-week preview covers all conflicts. Removing one skip
may collide with a moved-in date; report the affected admin field, not silently
drop either collection. A schedule edit must resolve orphan exception origins
before preview can produce a saveable draft.

## Draft, Concurrency and Read Models

Admin draft = confirmed timezone/private label + complete stream definitions and
child rows, expected persisted revision and opaque process runtime epoch.
Draft UUIDs generated by client for new rows are validated and checked for
uniqueness; DB timestamps/revision remain server-controlled. Existing IDs are
matched only inside this household; no payload may retarget children by FK.

Preview computes canonical digest over full proposed state, range, revision,
runtime epoch and confirmation list. `canSave=false` plus admin-only blockers
reports schedule/orphan/collision issues. Save revalidates current state and
digest and runs one immediate transaction; no durable preview token or write
is made by preview. Client retains draft on 409/422/500.

`CollectionDisplay` contains date groups and rows `{key,name,color}`, each key
derived from stream identity and actual date. Top-level timezone, householdToday
and serverNow support labels. No origin/rule/provider data is needed for display.
Private config `revision` is not returned publicly. Ordinary authenticated
display uses a selected-widget projection, not the admin aggregate.

Authenticated selected-state enum: `unconfigured`, `not_selected`,
`disabled`, `no_dates_in_range`, `exhausted`, `ready`.
Exhausted means selected enabled streams are all explicit and have no dates
on/after household today anywhere in their finite lists; mixed/regular streams
with no dates in the requested range are `no_dates_in_range`. Public responses
collapse non-ready cases to `no_dates` and cannot reveal hidden configuration.
Loading/error are client transport states, not misleading empty success data.

## Migration and Backup Mapping

Add four tables and only new generated migration artifacts. No existing calendar
table rewrite or data seed. Existing widget configs parse optional new arrays as
[] without rewriting unrelated data.

Backup v2 adds `collectionHousehold`, `collectionStreams`,
`collectionExplicitDates`, `collectionExceptions` arrays. All required in v2;
v1 defaults absent arrays to [] with a full-replacement warning. Table map,
data schema, export list and insertion/deletion order must agree.
Insert household → streams → dates/exceptions; delete inverse. Validate FK
references, singleton, mode children, ordering, dates/limits/collisions and
widget selections before destructive restore; never silently discard v2 fields.
Full roundtrip preserves all stable IDs and authoritative state, including
revision; process-only runtime epoch changes to reject pre-restore drafts.
Generated occurrences remain excluded just as provider materialization is.
