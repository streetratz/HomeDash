# Implementation Plan: Bin Collection Calendar

**Branch**: `065-bin-collection-calendar` | **Date**: 2026-10-10 UTC+11 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/065-bin-collection-calendar/spec.md`,
including owner-confirmed CH-02 Calendar-only icon-and-text scope.  
**Status**: Implemented baseline; CH-03 custom-event refactor authorised.

## CH-03 Implementation Revision

Use a Custom Events button alongside Birthdays in CalendarSourceList. It expands
an in-page manager panel (CH-04: no modal/popup — settings do not use dialog
overlays for editing) with a compact event list and one expanded editor. Keep the
existing collection engine/API/table/widget-key names as compatibility internals;
do not duplicate scheduling into provider events or rewrite unrelated sources.
UI wording becomes custom events, with Add Event and additive bin preset. Date
fields use the repository's native date picker, rendered theme-aware so it is
visible in dark mode and ≥44px on touch (CH-04).

Extend stream storage with a bundled allowlisted icon (legacy default Trash2),
nullable startDate and endDate for regular schedules. New events default to an
explicit one-date schedule; new repeating schedules have a first-date bound.
Existing null boundaries preserve their phase, even before anchor. Validate
ordered bounds and exception origins/destinations before preview/save/restore.
Use a new generated additive migration. Backup v2 accepts missing legacy fields
with compatibility defaults and preserves new fields in current readers; older
bin-only readers cannot restore these expanded v2 rows.

**Constitution Check — CH-03**: PASS design: no new auth boundary/network call/
dependency; bundled icon allowlist and dates validated at input and backup;
same public selected projections, 32-event/range limits and atomic writes;
additive upgrade without destructive cleanup; keyboard/mobile manager tests,
phase logs and spec changelog required. No PR/version/push authorised.

## Summary

Add independently configurable household collection streams to the **existing
Calendar widget and fullscreen calendar only**. Keep the owner's red weekly
General waste / yellow fortnightly Recycling A / green fortnightly Garden waste B
preset, independent weekday-set N-week cycles, explicit dates and reversible
skip/replace/add exceptions. One household and manual entry remain conservative
spec-defined draft defaults, not newly claimed owner approvals.

Store authoritative date-only configuration in new collection tables, **not**
provider-synced `calendar_events`. Compute occurrences read-only for a bounded
requested range, and merge a distinct collection display projection with existing
events at the calendar UI boundary. Reuse admin/session/CSRF enforcement, SQLite
transactions, existing widget config persistence, full portable backup/restore,
TanStack Query and UI primitives. Do not add source polling, a dedicated widget,
external lookup, monthly/seasonal algorithms, notifications or completion state.

## Technical Context

**Language/Version**: TypeScript 5.x strict; Node.js 24; pnpm 11 (root pins pnpm@11.1.3)  
**Primary Dependencies**: Fastify 5 (^5.12.4), Drizzle ORM 0.45.2 / drizzle-kit 0.31.10, better-sqlite3 ^11.3.0, Zod ^3.23.8; React ^18.3.1, Vite ^5.3.3, TanStack Query v5, Tailwind 3, shadcn/Radix, lucide-react  
**Storage**: SQLite WAL under `HOMEDASH_DATA_DIR/db/homedash.sqlite`; additive Drizzle-generated tables; existing widget `configJson` for selections only  
**Testing**: Vitest backend unit/integration/contract and frontend unit tests; Playwright critical setup/read/public flows; generated migration and main-created-database upgrade checks  
**Target Platform**: Linux NAS Docker, Synology host networking/private LAN; modern browsers from approximately 360px to desktop  
**Project Type**: Existing pnpm backend/frontend web application; no new package or runtime service  
**Performance Goals**: Range computation O(selected streams × range days + bounded date/exception rows), never O(distance from anchor); target warm 90-day household read p95 <200ms on representative NAS-class hardware, measured during implementation, not claimed here; foreground relative-date rollover ≤60s  
**Constraints**: Offline core, no outbound callbacks, no new environment variables/dependency upgrades; max 32 streams, inclusive range ≤731 days, bounded finite inputs; exact Gregorian date keys; preserve unrelated calendar behavior  
**Scale/Scope**: One installation-wide household, ≤32 streams, ≤8,192 total explicit-date/exception entries; 1–52-week recurrence; finite supported dates 1900-01-01 through 2199-12-31; see [data-model.md](data-model.md)

Versions above are manifest declarations read in this phase, not an assertion of
registry latest versions. The generated historical tech inventory and feature
059 plan are not stack authority. No unknown major choice remains.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1 under constitution
2.4.0. PASS means the design conforms; application verification remains future work.*

| Gate | Before research | Post-design evidence / required implementation proof |
| --- | --- | --- |
| I — Secure-by-default | PASS: existing auth/role/CSRF can be reused; public display must be separately projected | Admin-only full configuration and preview/save; authenticated widget-scoped display; public GET-only selected-dashboard/widget/stream intersection; strict limits and non-enumerating denial. Positive and negative tests required. |
| II — Mobile/accessibility | PASS: retain Calendar and settings patterns, no new widget | Visible names + coloured bin icons, date grouping, 44px actions, wrapping at 360px, light/dark themes and keyboard/screen-reader paths; no decorative list motion. Critical E2E and visual checks required. |
| III — LAN/offline boundary | PASS: local authoritative configuration and pure computation | No internet/runtime service, scraped schedules, source polling, account requirement or environment change. Offline setup/preview/edit/display tests required. |
| IV — Operations/resilience | PASS: existing structured logger, safe errors, container health and DB lifecycle retained | Transactional save/restore; bounded computation, conflict/retry feedback, request-ID diagnostics without private input. Startup migration fails safely; health behavior unchanged. |
| V — Testing/change safety | PASS: define test and durability work, do not claim spec tests prove behavior | Date oracle, permission matrix, recurrence collisions, generated migration/upgrade and full backup roundtrip; prior providers/birthdays/selections regression suite required. |
| Audit and spec changelog | PASS: new phase 03 created and indexed before setup | [Planning log](logs/03-phase-planning.md) and raw sidecars; no spec/changelog edit, CH-02 remains latest; implementation gets separate logs. |
| Workflow/release | PASS: bounded plan only, no optional commit | Template-derived plan and Phase 1 artifacts; task prerequisites checked, no approval inferred. Main Version patch/docs and all mandatory local PR gates deferred to authorised implementation/PR work. |

No constitution waiver is requested. Legacy calendar public reads are a known
code constraint, **not** justification to expose new private collection state.
Collection persistence stays separate so those endpoints cannot enumerate it.

### Brief threat model

An anonymous/compromised LAN visitor can guess widget/stream IDs, forge device
headers, poll large ranges, or request mutation directly. A signed-in non-admin
can bypass hidden controls; two administrators can overwrite each other.
Mitigate using existing session/admin/CSRF guards, fixed range/body/row bounds,
server-resolved web/mobile designation and selected IDs, allowlisted response
DTOs, optimistic revision and atomic writes. Public visibility is content policy,
not proof of a visitor's physical device identity. No provider label, anchor,
weekday, interval, exception origin, revision, admin identity, or hidden stream
catalogue appears publicly. Previously served content cannot be recalled, but
revocation denies the next fetch and clears rendered cached collection data.

## Project Structure

### Documentation (this feature)

```text
specs/065-bin-collection-calendar/
├── spec.md                        # preserved, CH-02 scope
├── changelog-spec.md              # preserved
├── constitution-check.md          # preserved specification-only check
├── checklists/requirements.md     # preserved
├── plan.md
├── research.md                    # existing council provenance + technical appendix
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── collection-api.md
│   └── calendar-ui.md
└── logs/
    ├── readme.md
    ├── 03-phase-planning.md
    └── 03-phase-planning/*.log
```

`tasks.md` is deliberately absent; the parent may generate it after the planning
handoff. No setup-tasks or implementation command is run here.

### Source Code (repository root; future changes only)

```text
backend/
├── src/
│   ├── api/admin-collections.ts        # new config/preview/save/auth display registration
│   ├── api/index.ts                   # register collection routes
│   ├── api/public.ts                  # sole new anonymous collection GET
│   ├── services/collectionService.ts  # validation, transactions, DTO selection
│   ├── services/collectionDates.ts    # pure ordinal, cycle and exception engine
│   ├── services/publicVisibility.ts  # collection-specific resolver/projection
│   ├── services/backupTypes.ts
│   ├── services/backupService.ts
│   ├── lib/validation.ts             # calendar selection schema extension
│   └── db/schema/index.ts            # new collection tables/relations/checks
├── drizzle/                          # new owning-tool-generated migration
└── tests/{unit,integration,contract}/
frontend/
├── src/
│   ├── state/collectionHooks.ts      # new queries/mutation invalidation
│   ├── lib/collectionDates.ts        # household date/labels, not old local helpers
│   ├── components/settings/CollectionManager.tsx
│   ├── components/settings/IntegrationsTab.tsx # existing CalendarsPanel
│   ├── components/widgets/CalendarConfigForm.tsx
│   ├── components/widgets/CalendarWidget.tsx
│   └── components/calendar/
│       ├── CollectionGroup.tsx       # shared icon/name/date rendering
│       ├── AgendaView.tsx
│       └── FullScreenCalendar.tsx
└── tests/e2e/
docs/{getting-started,operations}.md  # future setup, limits/restore/upgrade notes
```

**Structure Decision**: Add a small local service and separate projection to the
existing workspaces. Do not introduce a package, calendar provider type, new widget
registry entry or a parallel dashboard. New filenames above are planned, not
existing code asserted to have been read.

## Phase 0 — Research and Current-Code Findings

Direct research was performed without delegated agents, per this invocation's
explicit boundary. [research.md](research.md) retains official council provenance
unaltered and appends implementation decisions with current-code references.

| Current code | Implication for design |
| --- | --- |
| `backend/src/api/admin-calendar.ts` | Sources are user-owned; new sources auto-enable in every Calendar widget. Event queries use UTC strings, limit 200 and source colours. Do not create a collection source or reuse source auto-enabling. |
| `backend/src/services/calendar-sync-service.ts` | Events are upserted/pruned to a two-month-back/90-day-forward window; fallback handles birthdays; scheduled sync materializes local events. Inappropriate for arbitrary anchored recurrence navigation and read-only collection generation. |
| `backend/src/db/schema/index.ts` | Calendar event fields are timed ISO/one source colour, with no authoritative stream/rule/exception state. New tables avoid altering these records. |
| `frontend/src/state/calendarHooks.ts` | Event hook calls legacy public events route even for signed-in users. Collection queries must use separate auth-aware paths and keys, never this fallback. |
| `CalendarWidget.tsx`, `AgendaView.tsx`, `FullScreenCalendar.tsx` | Browser-local today/ranges are memoized; old all-day helper reads UTC components. Fullscreen can use all returned sources. Add household-date collection path and explicit widget collection selection. Collection-enabled fullscreen must use the widget's exact provider IDs, with empty meaning no providers; preserve legacy fallback only for widgets with no collection selection. |
| `backend/src/services/publicVisibility.ts` | Calendar is intrinsic public; generic explicit-widget resolver supports other types only. Use a collection-specific resolver with the existing selected dashboard/device logic, not an invented calendar switch in the unrelated snapshot loader. |
| `backend/src/api/user.ts` | Authenticated dashboard read uses `requireAuth`; no general dashboard ACL helper is enforced there. Match that policy for installation-shared collections, resolve actual widget membership, and never claim unused `dashboardAccessRules` provide security. |
| `backupTypes.ts`, `backupService.ts` | Calendar configuration is portable; materialized events excluded. Table map, data schemas and insertion/deletion order must all include new authoritative tables, with semantic validation before destructive restore. |
| `backend/src/db/migrate.ts` | Existing startup runner handles generated table rebuild/FK guards and checks FKs. Generate additive migration; do not hand-edit SQL or change migration runner. |

All previous technical unknowns (integration mechanism, date engine, permissions,
schema, collision policy and backup versioning) are resolved below. No new
external council lookup is needed and no historical seasonal finding is promoted
to current household authority.

## Phase 1 — Design

### 1. Persistence, identity and mutation

- Four tables: singleton `collection_household`, `collection_streams`,
  `collection_explicit_dates`, `collection_exceptions`; details and constraints
  in [data-model.md](data-model.md).
- No user ownership FK for the household: all authorised administrators manage
  the one shared household; deleting the setup administrator must not delete it.
- Stream UUIDs survive rename/recolour/disable/re-enable. Omission/removal is
  explicit and confirmed; child dates/exceptions cascade only for that stream.
- Small bounded aggregate API: GET full config, POST draft preview, PUT complete
  config with `expectedRevision`, preview digest and explicit destructive
  confirmations. Full aggregate replacement is simpler than many partially
  overlapping CRUD endpoints; optimistic concurrency protects other stream edits.
- Validate all proposed state, including disabled streams, before one immediate
  SQLite transaction. Re-read revision, validate against current state, diff/update
  stable rows, increment revision and commit; no await/outbound work inside.
  Roll back completely on validation/constraint/IO failure. Stale revision is
  409, not last-writer-wins. Preview is read-only and not a durable write token.
- Validate the final exception aggregate before persistence. Within the same
  transaction, delete removed/changed exception rows before reinserting changed
  rows, preserving their IDs/createdAt and updating updatedAt only when changed.
  Leave unchanged rows untouched. This permits valid destination swaps despite
  immediate unique indexes; failed reinsertion rolls back the whole diff.
- A schedule edit previews affected dates and reports orphan/conflicting
  exceptions. The admin explicitly removes listed incompatible exceptions;
  switching to explicit dates clears regular rules/exceptions only after
  confirmation. Changing name/colour cannot reset dates or phase.
- Preset is a draft builder using exactly the chosen weekday and confirmed
  timezone/normal Recycling date. General uses interval 1, Recycling interval 2
  at that anchor, Garden interval 2 at anchor+7 civil days. Preview four weeks
  before first save. Do not reseed an already configured household implicitly.

### 2. Pure recurrence and collision semantics

Use Gregorian ordinal-day arithmetic on validated `YYYY-MM-DD` keys. UTC Date
construction is only a numeric civil-calendar utility, **not** the instant at
which a household collection occurs. Never iterate real household timestamps in
24-hour increments and never calculate cycles from annual ISO week parity.

For date D, compute its Monday ordinal M(D). Active iff
`floorMod((M(D) - M(anchor)) / 7, intervalWeeks) === 0` and its weekday is selected.
This applies before and after the anchor; the anchor is not a start date.
Iterate only the requested ≤731 date keys. Explicit schedules select exactly the
listed keys. Disabled streams generate none.

For each regular stream, suppress skip/replacement origins, then add replacement
targets and added dates. Load **all** its bounded exceptions so a replacement
whose origin is outside the requested range still appears at its actual date
inside the range. Validate origins against base recurrence, uniqueness of origin
and resulting actual dates, replacement != origin, and additions/replacements
against unsuppressed base dates. Allow same-date different streams; reject
same-stream actual-date duplicates. Never silently deduplicate conflicting edits.
Check the entire finite exception set with recurrence membership predicates,
not just dates shown in preview. Removing an exception that would restore a
collision is rejected unless the conflict is resolved in the same atomic draft.

The service does not persist occurrences or update sync timestamps during GET or
preview. Identity for a displayed row is `collection:<streamId>:<actualDate>`;
a moved collection gets a new display-date key but retains stream identity.
Groups are sorted by actual date, rows by saved stream order then UUID.

### 3. Read contracts and selected public projection

See [contracts/collection-api.md](contracts/collection-api.md).

- Admin configuration and POST preview/PUT save use `requireAdmin`; POST/PUT
  use `assertCsrf`, including read-only POST preview as existing patterns do.
  No generic `settings:manage` grant permits a non-admin to mutate.
- Signed-in display GET requires `requireAuth`, a real Calendar widget joined
  through its placeholder/dashboard, and the widget's saved `collectionStreamIds`.
  Match existing authenticated dashboard read access. Do not expose full config
  or an unselected household stream catalogue to ordinary readers.
- Public GET in `api/public.ts` uses `selectUnauthDashboard(detectDeviceContext())`
  and actual widget/dashboard membership. Require an explicit nonempty saved
  `publicCollectionStreamIds` subset of `collectionStreamIds`; default both to [].
  Publishing an existing calendar dashboard must **not** automatically publish
  newly configured collections. This is an additional collection content
  selection, not a change to intrinsic calendar/provider visibility.
- New public route accepts widget ID and bounded display-window query only: no caller-specified
  stream/source/principal IDs. Selected subset is resolved on every fetch. It
  does not use the generic explicit-widget snapshot cache or loose legacy
  `/api/public/calendar/events` or `/sources` routes.
- Public bootstrap's Calendar config projection must replace private collection
  IDs with just the public subset and omit the separate public-selection field;
  hidden IDs/configuration must not leak through bootstrap or dashboard export
  responses to anonymous readers. Provider fields are otherwise unchanged.
- Return allowlisted date groups, names, icon colours, timezone and household
  today/server-now context only. Public empty state is `no_dates`; never expose
  whether hidden streams are disabled/unconfigured/exhausted. Admin manager
  distinguishes those states from full private config; authenticated display
  can distinguish states for its selected streams.
- `Cache-Control: no-store`, existing public per-IP widget rate limit, no
  implicit cache serving after revocation. On 401/403/404 clear collection data,
  not just keep stale rows visible. On 5xx retain any explicitly marked last-good
  display with an error/retry indicator; no stale result may masquerade as current.

### 4. Existing Calendar presentation and timezone

See [contracts/calendar-ui.md](contracts/calendar-ui.md). Collection UI is a
typed date-only branch beside, not disguised as, legacy `CalendarEvent`.

- Existing Calendars settings panel gets a restrained “Bin collections” manager:
  preset/custom choice, confirmed timezone, private optional provider label,
  stream name/colour/enabled, weekday checkboxes and 1–52-week interval/normal
  anchor **or** unique date list, exception editor, preview and Save/Cancel.
  Clear field errors retain draft inputs. No new settings top-level tab.
- Calendar config form separately selects collection streams for normal display
  and a deliberate public subset; no global source colour overrides those
  colours. Explain that public display additionally requires the appropriate
  web/mobile default dashboard. Settings and widget mutation remain admin-only.
- Agenda merges provider items and collection groups by civil date key but
  maintains separate relative-label contexts: provider labels/times keep existing
  behavior; collections show their own Today/Tomorrow + weekday/full date and
  household timezone. A visitor can have a different provider “Today”; do not
  silently relabel old timed events in the household timezone.
- First collection group at/after household today within the selected range is
  prominent, with all due names/icon colours; later groups quieter. No “next”
  guess outside range. Use semantic headings/list rows, wrap long names and
  stack at 360px. No colour-only distinction, glow, emoji substitution or new
  typography system. Icons decorative when name is present.
- Do not send collections through `toLocalDateKey` or legacy `getDayInfo`.
  Use `Intl.DateTimeFormat` with explicit household timezone/Gregorian calendar
  and parts to derive today's key; format a civil key in UTC solely for weekday/
  date text. A timezone change changes relative labels, never stored date keys.
- Agenda requests `daysAhead` (1–90) so the server computes household today and
  its civil-date range on the first read without requiring an admin-only timezone
  lookup or trusting a visitor's initial date. Fullscreen supplies explicit
  date keys instead. Provider range remains existing browser-local range.
  Collection query keys include auth/public mode, widget and window/range.
  Visible queries poll ≤30s with `useWidgetVisibility` and TanStack Query,
  refetch immediately on focus/visibility/resume. Server-now context plus local
  elapsed time drives label refresh; no dependency on inaccurate visitor wall
  clock for initial Today. No raw per-widget interval or Sonos-specific adaptive
  polling reuse. Midnight triggers recomputed range as well as relative labels.
- Fullscreen fetches collection range for its displayed month/date grid, using
  the **same widget ID/selections** as its agenda, not all household streams.
  Put collection icon/name rows into cells and complete grouped detail below/
  alongside. Household Today control/highlight is labelled when collections
  selected; initialise collection-enabled fullscreen month from returned
  householdToday and retain provider/browser Today as a separately labelled
  action/marker. Preserve a separate provider/browser today meaning rather than
  applying household date changes to provider fetching. Collections-only widgets
  work with zero provider source IDs. No missed midnight due to empty memo deps.
- Existing maxEvents applies to provider rows unchanged. Collection groups have
  their own complete scrollable segment within date groups and are not chopped
  by the provider's 200-row endpoint or maxEvents slicing. All streams on the
  next date remain visible; fullscreen cells may show “+N more” with complete
  accessible day detail. This is still the existing Calendar, not another widget.
- Empty/loading/disabled/out-of-range/exhausted/error states are explicit where
  permitted. No automatic completion/time-of-day or extrapolation.

### 5. Migration, backup, restore and recovery

- Generate an additive migration from schema changes using
  `pnpm --filter backend db:generate` during implementation. No SQL, existing
  released migration, package lock, seed or application DB changed in this phase.
  Do not recreate calendar/source/user/widget tables or populate preset rows on
  upgrade. An absent household stays unconfigured.
- New nullable/optional widget config selections default to [] on parsing; old
  config and source IDs remain untouched. Stream removal filters only that ID
  from both selection arrays in valid Calendar widget configs transactionally;
  never erase other config. Malformed unrelated widget JSON is left unchanged,
  logged safely, and read resolvers ignore missing IDs without widening access.
- Include all four tables in backup data types/Zod/table maps, explicit FK-safe
  insertion order (household → streams → dates/exceptions) and reversed deletion.
  Widget selected IDs remain in full backups. Do not back up generated occurrences.
- Increment portable `BACKUP_VERSION` from 1 to 2 so old readers reject rather
  than silently strip the new authoritative data. New reader accepts v1 with
  missing collection arrays defaulted empty, and requires all four arrays for v2.
  Validate strict collection row schemas, singleton/foreign keys/limits/date
  semantics/collisions and selected IDs before deleting anything. A v1 full
  restore is a full replacement: preview warns that it contains no collections.
- Preserve stream IDs, dates, exceptions, colours, enabled states, timezone,
  private label and widget selections exactly through v2 export/restore.
  Keep runtime concurrency epoch separately in process memory so pre-restore
  drafts cannot overwrite newly restored state even if persisted revisions match;
  restoring config revision itself remains lossless. Admin GET/preview/save
  includes that opaque epoch; public DTOs do not.
- Existing restore transaction must roll back on any invalid reference/insert
  failure. After successful restore clear collection queries/process caches and
  require refetch/login under existing session-reset semantics. Full backup
  privacy/reauth treatment for other integrations remains unchanged.
- Test new-on-empty, existing-main → candidate, repeated startup, v2 roundtrip,
  old v1 restore, invalid/malicious backup rollback and foreign_key_check.
  Compare all pre-existing calendar/birthday/source/widget fixtures before/after.
  Rollback to an older app image is not a down-migration guarantee: take a
  pre-upgrade database backup; restore that backup with the matching prior image.
  New v2 portable backups require a v2-capable HomeDash.

### 6. Errors, diagnostics and operational limits

Use existing `{error,message,details?}` shape and helpers: 401 unauthenticated,
403 forbidden/CSRF, 404 unavailable public widget, 422 field/date/input violations,
409 revision/preview/destructive-confirmation/collision conflicts, 413 body limit,
429 rate limit and safe 500 internal failure. Explicitly map oversize requests
through a scoped route error handler if the generic current handler would reduce
them to 500. Public authorization happens before detailed range diagnostics;
do not return private conflict examples to unauthorised callers.

Diagnostics include request ID, operation, safe reason code, bounded counts and
duration only. Do not include request bodies, stream/provider labels, full backup
content or SQL bind values in logs/errors; catch DB exceptions before the existing
global full-error logger can include private values. Restore failures must also
be sanitized inside `backupService.ts` before its existing catch/logger runs;
a caller-side sanitizer cannot retract an earlier log. Inject restore insertion
failures and assert logs/responses omit synthetic private labels, SQL parameters,
and backup content while rollback and existing reauth behaviour remain intact.
No new environment settings,
ports, cron jobs or health surface. Bound entries/body/range before computation.
SQLite busy/IO errors roll back and show safe retry feedback, not success.

## Phase 2 — Planning Handoff and Test Strategy

This section informs parent task generation, **not** application implementation.
Produce foundation tasks for schemas/date engine/contracts, then story slices
US1 preset, US2 custom schedules, US3 exceptions and US4 presentation/permissions,
with migration/public/backup coverage prerequisite to claiming any slice ready.
US4 security/date correctness must be built into US1 delivery, not late polish.

| Area | Required automated / manual evidence |
| --- | --- |
| Civil-date engine | Independent 24-month expected-date oracle for interval 1/2/4/52, weekday sets 1/3/7, anchor before/after range, Monday/Sunday boundary, daily vs seven weekdays every second week; leap 2028-02-29, 53-week/year crossing. Avoid duplicating implementation formula as the oracle. |
| Preset | Sydney Wednesday anchor 2026-10-14 → red/yellow 14+28, red/green 21+Nov 4; reject 2026-10-15 mismatch; custom setup requires no preset; four-week preview before save. |
| Exception/edit safety | Skip, earlier/later/moved-in/out-of-range, add/remove, same-stream base/destination duplicates, two different streams same date, restoring conflicting origin, orphan rule edit, mode-switch confirmation, disabled rules validated; failed/stale write leaves whole aggregate and other streams unchanged. |
| Timezone/DST | Server/process and browser TZ UTC, Sydney, Auckland and America/Los_Angeles; fake instants across household midnight and DST transitions; date-only labels invariant, timezone edits preserve keys, open/resumed view updates ≤60s; leap/date bounds reject normalization. |
| Permissions | Admin allow; anonymous expired/no session deny; non-admin deny even with settings:manage; missing/wrong CSRF deny; ordinary selected-widget read allow with no admin state; selected public web/mobile allow; wrong widget/type/dashboard/context, hidden stream, arbitrary stream query, revoked designation deny/non-enumerate; POST/PUT/DELETE on public path do not mutate. |
| Privacy/cache | Assert no provider label/rule/anchor/origin/epoch/revision/admin identity in public JSON or bootstrap; hidden IDs absent. Public/privileged caches not reused across logout/session changes. Revocation clears next-fetched rendered data; no stale successful fallback for forbidden responses. |
| UI critical paths | 360px/desktop light+dark setup, custom edit, exception preview/conflict/retry, select normal/public content, agenda/fullscreen all names/icon colours, collections-only widget, same-colour names, long names and fully accessible detail/keyboard focus, errors/disabled/exhausted states. |
| Durability/offline | Reload/restart, generated migration on main-created populated DB, foreign keys, v2 export/restore exact equality and v1 warning, invalid backup rollback; Internet blocked while core setup/edit/read succeeds; existing calendar providers/birthdays and selected source behavior retain regression fixtures. |

Future commands (Node 24/pnpm 11, isolated test databases; not run as app gates here):
focused Vitest files first, then `pnpm --filter backend test`,
`pnpm --filter frontend test:unit`, `pnpm --filter frontend test:e2e`,
`pnpm typecheck`, `pnpm build`; authorised PR work must additionally satisfy
code-review-standard, UI skills, pre-pr-upgrade-gate and lint-gate. App tests/build
are unnecessary for these documentation-only planning changes and no new app
gate result is claimed. SC-001/SC-005 require representative user sessions
(9/10 thresholds); automated tests do not establish those human outcomes.

Task-generation prerequisites: required plan/spec plus research, data model,
contracts and quickstart present; current feature pointer/branch agree. The
registered full SDD workflow additionally has a **review-plan approval gate**.
Artifact existence is not approval; parent must apply the user's authorised
plan→tasks scope without guessing a workflow gate decision. No workflow engine
or tasks agent is launched by this invocation.

## Risks and Mitigations

1. Legacy public calendar paths and browser-local helpers cannot safely be reused
   for collections. Keep persistence/query/DTO/date paths separate and test both
   public leaks and provider regressions.
2. The shared aggregate can conflict between admins; revision + runtime epoch,
   preview/retry with draft retention and atomic saves prevent lost updates.
3. Exceptions outside viewed range can create hidden collisions or missing moved
   events; validate the complete bounded exception set and filter on actual dates.
4. New tables can be lost if backup maps/order are missed; format v2, strict
   restore validation, full equality tests and upgrade gate are mandatory.
5. Bounds are justified safety limits, not council rules; document in setup/ops.
   User schedules outside supported dates/counts get actionable validation,
   not truncation. Monthly/seasonal cases use explicit dates without inference.
6. Browser timers pause in the background; visibility resume refetch is immediate,
   while the ≤60s requirement applies to an open active view. Initial date labels
   use server-now context to reduce client-clock errors.

## Complexity Tracking

No constitution violations. Separate date-only persistence/projection is the
minimum safe adaptation to current timed/materialized calendar storage; no
waiver or new infrastructure is needed.
