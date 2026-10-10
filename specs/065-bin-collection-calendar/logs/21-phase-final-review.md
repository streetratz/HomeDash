# 21 — Final Design, Code and Migration Review

[Back to Logs Index](readme.md)

## Table of Contents

- [Scope](#scope)
- [Commands Run](#commands-run)
- [Findings](#findings)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Scope

Owner requests final design/code reviews and all other migration tests before
pushing. Candidate c5fb9a0 versus local main. Fresh Opus 4.8 code reviewer is
read-only; parent reviews UI consistency. Run the entire backend suite (including
all migration/upgrade and backup/restore suites), frontend unit/collection browser
tests, full lint and populated-main Docker upgrade gate on Node 24.
No push or PR during review.

## Commands Run

All application commands used Node 24.18.0 / pnpm 11; no dependencies changed.

| Command | Exit / result | Raw output |
| --- | --- | --- |
| Full backend suite, first attempt (remaining chained checks not reached) | 1; 834 passed / publicWidgets socket failure | [validation-run-1.log](21-phase-final-review/validation-run-1.log) |
| Standalone publicWidgets, then full backend suite | 1; standalone passed / collectionPublic socket failure in full run | [backend-rerun-1.log](21-phase-final-review/backend-rerun-1.log) |
| `pnpm --filter frontend test:unit && pnpm typecheck && pnpm --filter frontend exec playwright test collections && pnpm lint` | 0; 179 unit / 9 browser tests | [frontend-run-1.log](21-phase-final-review/frontend-run-1.log) |
| `pnpm --filter backend exec vitest run tests/integration/migrationIntegrity.test.ts tests/integration/collectionMigration.test.ts tests/integration/dockerConnectionUpgrade.test.ts tests/integration/backup.test.ts tests/integration/restore.test.ts tests/integration/collectionBackup.test.ts tests/integration/collectionPublic.test.ts tests/integration/publicWidgets.test.ts` | 0; 49 tests / 8 suites | [migration-focused-run-1.log](21-phase-final-review/migration-focused-run-1.log) |
| `pnpm test:upgrade` with repository-local temporary directory, initial attempt | 1; insufficient wrapper diagnostics | [upgrade-run-1.log](21-phase-final-review/upgrade-run-1.log) |
| Plain-progress candidate Docker build | 0 | [docker-build-diagnostic-run-1.log](21-phase-final-review/docker-build-diagnostic-run-1.log) |
| `pnpm test:upgrade`, second attempt | 1; insufficient wrapper diagnostics | [upgrade-run-2.log](21-phase-final-review/upgrade-run-2.log) |
| Quiet-mode candidate Docker build | 0 | [docker-build-quiet-run-1.log](21-phase-final-review/docker-build-quiet-run-1.log) |
| Original upgrade script sourced under `bash -E` with an ERR trap reporting only line/exit, not commands or credentials | 0; migrations 32 → 35, 28 tables preserved, zero FK violations | [upgrade-diagnostic-run-1.log](21-phase-final-review/upgrade-diagnostic-run-1.log) |
| `pnpm --filter backend test`, without concurrent browser/build jobs | 0; 835 tests / 73 suites | [backend-final-run-1.log](21-phase-final-review/backend-final-run-1.log) |

Both diagnostic images removed; original upgrade-script cleanup removes its
isolated containers/images/volume. No live household or preview data changed.
Both typechecks and complete zero-warning lint passed; browser harness rebuilt
the frontend. All existing migration test files are included, not just the new
collection migration. Full backend also includes restore-preview and all other
integration/contract/unit suites.

## Findings

### Design review

Reviewed the current desktop editor screenshot, manager/disclosure/picker code,
Calendar selection controls, agenda rendering and advanced editors. The owner
accepted the compact editor locally in phase 20. No blocking visual/layout
finding in the latest correction.

| Before | After | Why |
| --- | --- | --- |
| Stretched weekdays and separate repeat/enabled rows | Bounded weekdays and grouped desktop controls | Reduces empty space while preserving touch/keyboard operation |
| Inline icon palette reflows title/colour | Existing anchored Popover with local icon buttons | Consistent palette behaviour without a settings modal |
| Date help consumes separate full-width rows | Field-local concise help with aligned desktop dates | Clear hierarchy and less vertical scanning |

Low, non-blocking terminology inconsistency remains: CalendarConfigForm still
uses "Household collection streams" / "Set up household collections", and
advanced CollectionExceptionEditor / CollectionExplicitDatesEditor still say
"collection". Generic events function correctly, but these labels can mislead
users into thinking those controls are bin-only. Follow-up: replace visible
generic-event labels with event terminology while retaining persisted collection
keys and intentional bin-preset labels. No source changes during this review.

Residual evidence gap: automated desktop/WebKit checks do not replace physical
device or screen-reader testing; no claim of a human accessibility study.

### Code review

Fresh-context Opus 4.8 reviewed the runtime branch diff at c5fb9a0 against main,
including public projections, recurrence, inclusive bounds/exceptions, immediate
save transactions, generated migrations and v1/v2 backup compatibility.
No Critical/High/Medium high-confidence defect. Latest public-key projection
uses fresh objects and does not affect authenticated keys; icon popover/density
changes preserve editing semantics.

Strengths: bounded input, default-deny public selection, pre-delete semantic
backup validation, transactional revision/digest rechecks, and occurrence
collision validation without silently dropping exceptions.

Residual risk: intermittent full-suite connection resets; standalone affected
tests and the final unchanged full suite passed. Reviewer found no new route
or limiter defect and recommends harness lifecycle investigation rather than
assuming a product defect. Authenticated collection reads intentionally remain
household-wide, consistent with the current app trust model.

## Errors & Fixes

Two full-suite runs encountered socket hang-ups (publicWidgets limiter loop,
then collectionPublic). Standalone affected suites and a focused migration/
backup/public run passed unchanged; final full run without concurrent builds/
browsers passed 835/835. Exact root cause is not established, and recurrence
remains a reliability risk. No source edit or test disabling to suppress failures.

Two upgrade wrapper attempts failed after the candidate-build status line with
insufficient diagnostics. Both plain and quiet diagnostic candidate builds
passed. The identical upgrade script, with an error-location-only trap, then
completed all original data-preservation/health/login assertions successfully.
Root cause of the earlier wrapper failures is not established; failed logs
are retained. No comparison exclusion or gate bypass was used.

## Phase Checkpoint

Final code and design review complete; all requested migration/backup/restore
tests and real main-to-candidate upgrade assertions passed. Full backend 835,
frontend unit 179, collection browser 9, both typechecks and full lint passed.
No runtime changes during review; only audit/task records updated locally.
Ready for branch push, not a claim of PR/merge readiness: version preparation
and repository PR requirements still apply before a PR. No push or PR performed.
