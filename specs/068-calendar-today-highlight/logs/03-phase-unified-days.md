# Phase 03 — Unified Day Headings and Bins in Day

**Status**: ✅ Complete

## Changes

- `AgendaView.tsx`: one `<section>` per day with a full-date `<h4>` from
  `collectionDateLabel`; Today is `text-base` and full-strength, later days
  `text-foreground/80`. The date badge and day-name row are removed.
- Bin collections render as rows at the top of their day's rail, marked by a 22px
  stream-icon disc centred on the rail. `CollectionGroup` is no longer used by the
  agenda; fullscreen and the collection manager are unchanged.
- The collection timezone is shown once below the agenda.

## Validation

| Check | Result | Log |
| --- | --- | --- |
| Targeted unit tests | ✅ 11 passed | [targeted-tests.log](targeted-tests.log) |
| Frontend unit tests | ✅ 198 passed | [unit-tests.log](unit-tests.log) |
| Typecheck | ✅ | [typecheck.log](typecheck.log) |
| Lint (`--max-warnings=0`) | ✅ after removing two redundant assertions | [lint.log](lint.log) |
| Playwright (incl. 5 viewports × light/dark) | ✅ 44 passed, 1 skipped | [e2e-responsive-and-full.log](e2e-responsive-and-full.log) |
| Upgrade gate | ✅ migrations 35 → 35, 32 tables, 0 FK violations | [upgrade-gate.log](upgrade-gate.log) |

Screenshots: [calendar-light.png](calendar-light.png), [calendar-dark.png](calendar-dark.png).
