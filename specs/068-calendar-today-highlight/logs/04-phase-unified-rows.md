# Phase 04 — Compact Headings and Unified Rows

**Status**: ✅ Complete

## Changes

- Headings return to the date number plus a short weekday; Today uses a 24px bold
  number and a primary "· Today" label. The full date stays available to screen
  readers.
- Bins and events share one row: a 26px tinted icon disc on the rail, a 15px
  title, a right-aligned 13px time at 70% strength, a 6% background tint, and no
  border. Event cards, dots, and visible source badges are removed; the source name
  stays available to screen readers.

## Validation

| Check | Result | Log |
| --- | --- | --- |
| Targeted unit tests | ✅ 11 passed | [targeted-tests.log](targeted-tests.log) |
| Frontend unit tests | ✅ 198 passed | [unit-tests.log](unit-tests.log) |
| Typecheck | ✅ | [typecheck.log](typecheck.log) |
| Lint (`--max-warnings=0`) | ✅ | [lint.log](lint.log) |
| Playwright (incl. 5 viewports × light/dark) | ✅ 44 passed, 1 skipped | [e2e-responsive-and-full.log](e2e-responsive-and-full.log) |
| Upgrade gate | ✅ migrations 35 → 35, 32 tables, 0 FK violations | [upgrade-gate.log](upgrade-gate.log) |

The first responsive run failed at phone widths because a regex locator matched
the off-screen screen-reader source label; the locator was narrowed to visible
titles.
