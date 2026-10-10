# Logs Index — Bin Collection Calendar

## Phases

| # | Phase | Status | File |
| --- | --- | --- | --- |
| 01 | Specification and official-source research | Complete — spec only; validation/lint passed | [01-phase-specification.md](01-phase-specification.md) |
| 02 | Owner-confirmed calendar presentation | Complete — documentation assertions passed | [02-phase-calendar-presentation.md](02-phase-calendar-presentation.md) |
| 03 | Technical planning | Complete — design and planning validation only | [03-phase-planning.md](03-phase-planning.md) |
| 04 | Task generation | Complete — task artifact validation only; implementation pending | [04-phase-task-generation.md](04-phase-task-generation.md) |
| 05 | Plan and task consistency review | Complete — corrected artifact validation passed | [05-phase-plan-review.md](05-phase-plan-review.md) |
| 06 | Implementation setup | Complete — baseline/typechecks/lint pass | [06-phase-setup.md](06-phase-setup.md) |
| 07 | Foundation | Complete | [07-phase-foundational.md](07-phase-foundational.md) |
| 08 | Household preset | Validated implementation increment — original test-first closure pending | [08-phase-preset.md](08-phase-preset.md) |
| 09 | Custom regular streams | Validated implementation increment — exact matrix pending | [09-phase-custom-streams.md](09-phase-custom-streams.md) |
| 10 | Safe reading | Validated implementation increment — full timezone/manual evidence pending | [10-phase-safe-reading.md](10-phase-safe-reading.md) |
| 11 | Irregular dates | Validated implementation increment — broader acceptance closure pending | [11-phase-irregular-dates.md](11-phase-irregular-dates.md) |
| 12 | Final validation | Gates passed; 78/97 tasks checked, full outcome closure pending | [12-phase-final-validation.md](12-phase-final-validation.md) |
| 13 | Fresh-context Opus 4.8 review | Scoped today-marker correction validated; owner validation pending | [13-phase-opus-review.md](13-phase-opus-review.md) |
| 14 | Collection settings polish | Validated — compact weekdays and shared colour picker | [14-phase-settings-polish.md](14-phase-settings-polish.md) |
| 15 | Custom event scope revision | Complete — CH-03 replaces bin-only UI boundary; planning aligned | [15-phase-custom-event-planning.md](15-phase-custom-event-planning.md) |
| 16 | Custom event backend foundation | Complete — icon/bounds engine + migrations; 835 tests, lint clean | [16-phase-custom-event-foundation.md](16-phase-custom-event-foundation.md) |
| 17 | Custom event UI refactor | Complete — admin dialog launcher, offline icons, generic labels; 177 unit / 9 collection E2E, typecheck/build/lint clean | [17-phase-custom-event-ui.md](17-phase-custom-event-ui.md) |

## Overall Status

Current execution: implementation and local phase commits authorised on
2026-10-10; no push/PR/release/version preparation. Earlier notes below are
historical planning boundaries, not current execution restrictions.

Runtime implementation and isolated local demonstration are delivered.
Latest evidence: 824 backend / 173 frontend unit / 36 browser tests passing;
typechecks, build, lint and Docker main→candidate upgrade passing. Final audit
records formatter baseline, intermittent harness reruns, remaining exact
coverage tasks, unavailable human/assistive evidence and unauthorized T091.
The independent fresh-context Opus 4.8 review found no Critical/High defects and
one Medium today-marker inconsistency; phase 13 records correction and validation.

Historically, planning and task generation were authorised; phase 05 records consistency review
and artifact corrections only. Phase 04's counts below describe its initial output.
Application implementation, commit/push/PR work and dependency PRs #2/#18 remain
out of scope. Optional auto-commit hooks are skipped. Earlier phase outcomes
below describe their historical scope.

Generated `../tasks.md`: 97 unchecked tasks in seven phases, with US1=19,
US2=11, US4=16 and US3=14; setup=4, foundation=19, polish=14. Final task
validation passed checklist/story/path consistency, 158 explicit acyclic
dependency edges, 25 parallel markers in seven disjoint-file batches, unchanged
design-input fingerprints and raw audit/index links. Execution order is setup
→ foundation → US1 → US2 → US4 → US3 → polish. No application tests/gates or
readiness claims were made. Consistency review found four significant design/task
gaps, resolved in phase 05; final corrected dependency counts are recorded there.
Corrected graph: 97 pending tasks, 163 acyclic prerequisite edges. US1 validation
can reach the applicable final gates without later-story or PR authorization.
The complete feature still requires every story and its outcome evidence.

Historical phase 01 scope: specification-only work for issue #19. No implementation,
plan, tasks, application tests, commit, push, or pull request was authorised then. Specification
validation is separate from proving application behaviour.

Quality checklist: 16/16. Structural/date-fixture checks and full root lint passed;
failed helper checks and their fixes are retained in the phase audit. Only the
new feature documentation/audit artifacts and core feature pointer changed.
Issue #19's original body is preserved, with a local/unpushed tracking comment.
No blocking clarifications; bounded draft scope defaults remain revisable.
The owner confirmed existing-calendar-only scope and icon-and-text presentation;
phase 02 records this clarification without application changes.
