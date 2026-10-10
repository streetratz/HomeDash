# Quickstart and Validation — Bin Collection Calendar

**Status**: Instructions for future implementation validation. Feature is not
implemented by this planning phase. Do not run migration/code/PR steps merely
because this file exists.

## Planning Handoff

1. Read [plan.md](plan.md), preserved [spec.md](spec.md)/CH-02, [research.md](research.md),
   [data-model.md](data-model.md), [API contract](contracts/collection-api.md) and
   [UI contract](contracts/calendar-ui.md).
2. Confirm plan/spec/companions exist using task-generation prerequisite checking.
   Do not use `--require-tasks` before tasks are generated. Parent handles tasks
   and any registered workflow plan-review gate; file existence is not approval.
3. Before installation/network, read local operating instructions per root
   AGENTS.md. Use Node 24 and pinned pnpm 11; do not introduce dependencies for
   this feature without a separate justified decision.

## Future Developer Validation Setup

- Use isolated temporary data directories/test databases, never the household's
  live database. Follow `docs/getting-started.md` for existing env/dev commands.
- Generate a **new** migration from the owning Drizzle schema command, not
  handwritten SQL. Test empty and a database populated by current main.
- Start the existing backend/frontend using repo scripts when running E2E;
  consult current Playwright config/start-e2e-server script rather than assuming
  a server is automatically launched.
- Build fixtures with original provider sources, birthday records, widgets and
  public web/mobile dashboard selection before introducing collection config.

## Smoke Scenario 1 — Owner Preset (US1)

1. Admin opens Settings → Integrations → Calendars → Bin collections.
2. Choose household preset; explicitly confirm `Australia/Sydney`, Wednesday
   and known normal Recycling date `2026-10-14`.
3. Preview at least four weeks:

| Collection date | Required visible streams |
| --- | --- |
| 2026-10-14 | red General waste; yellow Recycling |
| 2026-10-21 | red General waste; green Garden waste |
| 2026-10-28 | red General waste; yellow Recycling |
| 2026-11-04 | red General waste; green Garden waste |

4. Save; select streams in an existing Calendar widget. Reload/restart and
   confirm identical IDs/names/colours/enabled rules.
5. Confirm Thursday `2026-10-15` cannot be a Wednesday normal anchor.
   Preset claims no official schedule; manual setup/preview works with no internet.

## Smoke Scenario 2 — Independent and Explicit Schedules (US2)

- Custom start without preset: Rubbish Monday+Thursday weekly, FOGO weekly,
  Recycling Monday fortnightly, Glass Tuesday with chosen independent colour.
- Test all-seven weekdays weekly vs all-seven every second week, three weekday
  recycling, four-week cycle labelled “Every 4 weeks,” and 52-week cycle.
- Thursday fortnightly anchor `2026-12-31` gives `2027-01-14` and `2027-01-28`.
- Rename/recolour one stream; dates/exceptions of it and others unchanged.
  Disable/re-enable retains its phase. Confirm removal only deletes that stream.
- Explicit seasonal dates `2026-12-14`, `2027-01-18`, `2027-02-15` generate exactly
  those dates. No “monthly” inference; exhausted manager state after last date.

## Smoke Scenario 3 — Exceptions and Atomic Editing (US3)

- Weekly Friday replace `2026-12-25` → `2026-12-26`: no Dec 25 occurrence,
  Jan 1 still due unless separately altered.
- Fortnightly replace `2026-12-25` → `2026-12-24`: Jan 8 unchanged.
- Twice-weekly skip second date; add another collection; remove exceptions to
  restore base behavior. Test moved origin outside/target inside selected month.
- Reject same-stream destination/base collisions with no partial save; allow
  different streams sharing a date. Remove a skip that would restore a duplicate
  only after resolving conflict in the same draft.
- Rule edit reports orphan origins; mode switch confirms cleared rules/dates/
  exceptions. A stale admin draft returns 409 and preserves unsaved values.

## Smoke Scenario 4 — Reading, Timezone and Security (US4)

- Calendar only, not a Bin Days widget. Next group has full weekday/date,
  household Today/Tomorrow, every due stream's coloured bin icon and visible
  name. Later groups are quieter; same-colour streams remain readable.
- Test 360px and desktop, light/dark, long names, touch/keyboard and complete
  fullscreen day detail. Collections-only Calendar works without provider IDs.
- Visitors in Sydney, Auckland and Los Angeles see identical household collection
  dates. Freeze server/browser test time around household midnight and DST:
  open foreground label/range rollover ≤60s; resume updates immediately.
- Admin GET/preview/save allowed; anonymous/expired session denied; non-admin
  denied even with generic manage grants; missing/wrong CSRF denied.
- Public collection read requires designated context dashboard + real widget +
  explicitly selected public subset; wrong dashboard/widget/context/stream
  query rejected. Revoke selection and confirm next fetch removes displayed data.
- Assert no providerLabel/anchor/interval/weekdays/origins/revision/epoch/user
  metadata in public JSON or bootstrap; ordinary read cannot fetch admin config.
- Distinct private unconfigured/disabled/out-of-range/exhausted/loading/error
  states; generic public empty state cannot expose private causes.

## Future Automated Test and Upgrade Gate

Plan tasks for:

1. Backend pure date tests with independent 24-month date fixtures, DST/leap/
   Monday-Sunday and negative validation/collision cases.
2. Backend API contract/integration tests for full permission matrix, preview GET
   purity, atomic failures, stale revision/epoch, public non-enumeration/projection.
3. Frontend unit/fake-time tests for range/relative dates/query-mode/cache changes.
4. Playwright setup/edit/display/public and provider-regression critical flows.
5. Full backup v2 equality (including selections and disabled exceptions),
   v1 warning/full replacement, corrupt/over-limit/invalid-FK backup rollback,
   restart, repeated migration and populated-main upgrade with FK checks.
6. Offline smoke with local app access preserved, no required external services.

Future commands from repository root:

```sh
pnpm --filter backend test
pnpm --filter frontend test:unit
pnpm --filter frontend test:e2e
pnpm typecheck
pnpm build
```

Focused Vitest files should run before broader suites. Every implementation
phase needs fresh numbered log/sidecars. No known failing tests may be marked
complete. Before an authorised PR, invoke all required review/UI/upgrade/lint
skills and run the mandatory Node 24 zero-warning lint gate; Main Version patch
bump and operational docs belong to that authorised work, not this plan.

## Operational and Recovery Notes to Deliver

- Limits are implementation safety choices: 32 streams, 731-day request range,
  1900–2199 supported dates, 2,048 explicit dates/stream, 512 exceptions/regular
  stream, 8,192 total entries, 2 MiB input. Reject clearly rather than truncate.
- Household timezone is explicitly confirmed and independent of shell clocks;
  edits preserve all entered dates. No additional environment variables/services.
- Full portable backup v2 includes authoritative collection rows and selections,
  not generated occurrences. New app restores v1 with warning; v1-only app
  rejects v2. Full restore removes current config not present in the backup.
- Before upgrade keep a database backup and prior image. Downgrade recovery uses
  the pre-upgrade database backup with matching older image, not an assumed
  down-migration or a v2 portable file on an old reader.
- Existing provider OAuth reauth/backup exclusions and calendar birthday behavior
  remain unchanged. Document safe request-ID troubleshooting without private labels.

## Planning Outcome Boundary

Artifact checks establish only planning structure, scope and prerequisite
availability. No app tests, migration, UI usability study, implementation readiness,
plan approval, task file, version bump, commit, push or PR is implied.
