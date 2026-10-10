# 12 — Final candidate validation

[← Back to Logs Index](readme.md)

## Overview

Candidate starts at `fa26841` plus the explicitly audited final increment.
Implementation/local commits are authorized; PR, push and release are not.
Gate evidence applies to the final diff recorded before commit; subsequent
behavior changes require affected gates again.

Current-main comparison ref: `c5bd8a1102cd2e7a1d22cbea93b68614be5903a5`.
Final backend/frontend tracked diff against `fa26841`, plus the new performance
test bytes, SHA256:
`c7814262455a2d6e7acd0c7e7efb377928c99c1b796c95c211eea76dc4e5d838`.
Audit/task-only edits do not change this code identity. The next local commit
identifies the complete candidate; no remote actions are authorized.

## Commands Run

| Run | Command | Outcome | Log File |
| --- | --- | --- | --- |

| bounded-1 | `pnpm --filter backend exec vitest run tests/integration/collectionPerformance.test.ts tests/integration/collectionMigration.test.ts tests/integration/migrationIntegrity.test.ts` | Exit 1 | [12-phase-final-validation/bounded-run-1.log](12-phase-final-validation/bounded-run-1.log) |

| bounded-2 | `pnpm --filter backend exec vitest run tests/integration/collectionPerformance.test.ts tests/integration/collectionMigration.test.ts tests/integration/migrationIntegrity.test.ts` | Exit 0 | [12-phase-final-validation/bounded-run-2.log](12-phase-final-validation/bounded-run-2.log) |

| frontend-1 | `pnpm --filter frontend test:unit && pnpm typecheck && pnpm build` | Exit 0 | [12-phase-final-validation/frontend-run-1.log](12-phase-final-validation/frontend-run-1.log) |

| backend-1 | `pnpm --filter backend test` | Exit 1 | [12-phase-final-validation/backend-run-1.log](12-phase-final-validation/backend-run-1.log) |

| e2e-1 | `pnpm --filter frontend test:e2e` | Exit 0 | [12-phase-final-validation/e2e-run-1.log](12-phase-final-validation/e2e-run-1.log) |

| backend-2 | `pnpm --filter backend test` | Exit 0 | [12-phase-final-validation/backend-run-2.log](12-phase-final-validation/backend-run-2.log) |

| format-1 | `pnpm format:check` | Exit 1 | [12-phase-final-validation/format-run-1.log](12-phase-final-validation/format-run-1.log) |

| format-feature-1 | `pnpm exec prettier --write $(git diff main --name-only --diff-filter=A -- "*.ts" "*.tsx") backend/tests/integration/collectionPerformance.test.ts` | Exit 0 | [12-phase-final-validation/format-feature-run-1.log](12-phase-final-validation/format-feature-run-1.log) |

| upgrade-1 | `pnpm test:upgrade` | Exit 0 | [12-phase-final-validation/upgrade-run-1.log](12-phase-final-validation/upgrade-run-1.log) |

| final-fix-tests-1 | `pnpm --filter backend exec vitest run tests/unit/collectionService.test.ts && pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx` | Exit 1 | [12-phase-final-validation/final-fix-tests-run-1.log](12-phase-final-validation/final-fix-tests-run-1.log) |

| final-fix-tests-2 | `pnpm --filter frontend exec vitest run tests/unit/CollectionManager.test.tsx && pnpm typecheck` | Exit 0 | [12-phase-final-validation/final-fix-tests-run-2.log](12-phase-final-validation/final-fix-tests-run-2.log) |

| format-final-1 | `pnpm format:check` | Exit 1 | [12-phase-final-validation/format-final-run-1.log](12-phase-final-validation/format-final-run-1.log) |

| final-e2e-1 | `pnpm --filter frontend test:e2e` | Exit 0 | [12-phase-final-validation/final-e2e-run-1.log](12-phase-final-validation/final-e2e-run-1.log) |

| final-suites-1 | `pnpm --filter backend test && pnpm --filter frontend test:unit && pnpm typecheck && pnpm build` | Exit 0 | [12-phase-final-validation/final-suites-run-1.log](12-phase-final-validation/final-suites-run-1.log) |

| main-migration-1 | `pnpm --filter backend exec vitest run tests/integration/collectionMigration.test.ts tests/integration/migrationIntegrity.test.ts && pnpm typecheck` | Exit 1 | [12-phase-final-validation/main-migration-run-1.log](12-phase-final-validation/main-migration-run-1.log) |

| main-migration-2 | `pnpm --filter backend exec vitest run tests/integration/collectionMigration.test.ts tests/integration/migrationIntegrity.test.ts && pnpm typecheck` | Exit 0 | [12-phase-final-validation/main-migration-run-2.log](12-phase-final-validation/main-migration-run-2.log) |

| format-verified-1 | `pnpm format:check` | Exit 1 | [12-phase-final-validation/format-verified-run-1.log](12-phase-final-validation/format-verified-run-1.log) |

| final-source-check-1 | `pnpm --filter backend exec vitest run tests/integration/collectionMigration.test.ts tests/integration/collectionBackup.test.ts tests/unit/collectionService.test.ts && pnpm --filter frontend exec vitest run tests/unit/collectionCalendar.test.tsx tests/unit/CollectionManager.test.tsx && pnpm typecheck && pnpm build` | Exit 0 | [12-phase-final-validation/final-source-check-run-1.log](12-phase-final-validation/final-source-check-run-1.log) |

| lint-final-1 | `node --version && pnpm lint` | Exit 1 | [12-phase-final-validation/lint-final-run-1.log](12-phase-final-validation/lint-final-run-1.log) |

| upgrade-final-1 | `pnpm test:upgrade` | Exit 1 | [12-phase-final-validation/upgrade-final-run-1.log](12-phase-final-validation/upgrade-final-run-1.log) |

| lint-final-2 | `node --version && pnpm lint` | Exit 0 | [12-phase-final-validation/lint-final-run-2.log](12-phase-final-validation/lint-final-run-2.log) |

| final-performance-1 | `pnpm --filter backend exec vitest run tests/integration/collectionPerformance.test.ts` | Exit 0 | [12-phase-final-validation/final-performance-run-1.log](12-phase-final-validation/final-performance-run-1.log) |

| upgrade-final-2 | `pnpm test:upgrade` | Exit 1 | [12-phase-final-validation/upgrade-final-run-2.log](12-phase-final-validation/upgrade-final-run-2.log) |

| upgrade-diagnosis-1 | `bash -E -c 'trap '\''printf "Upgrade failure at script line %s\n" "$LINENO"'\'' ERR; source .github/skills/pre-pr-upgrade-gate/run.sh'` | Exit 0 | [12-phase-final-validation/upgrade-diagnosis-run-1.log](12-phase-final-validation/upgrade-diagnosis-run-1.log) |

| upgrade-final-3 | `pnpm test:upgrade` | Exit 0 | [12-phase-final-validation/upgrade-final-run-3.log](12-phase-final-validation/upgrade-final-run-3.log) |

| final-backend-1 | `pnpm --filter backend test` | Exit 1 | [12-phase-final-validation/final-backend-run-1.log](12-phase-final-validation/final-backend-run-1.log) |

| final-frontend-1 | `pnpm --filter frontend test:unit` | Exit 0 | [12-phase-final-validation/final-frontend-run-1.log](12-phase-final-validation/final-frontend-run-1.log) |

| public-widget-retry-1 | `pnpm --filter backend exec vitest run tests/integration/publicWidgets.test.ts` | Exit 0 | [12-phase-final-validation/public-widget-retry-run-1.log](12-phase-final-validation/public-widget-retry-run-1.log) |

| final-backend-2 | `pnpm --filter backend test` | Exit 0 | [12-phase-final-validation/final-backend-run-2.log](12-phase-final-validation/final-backend-run-2.log) |

| lint-before-commit-1 | `node --version && pnpm lint` | Exit 0 | [12-phase-final-validation/lint-before-commit-run-1.log](12-phase-final-validation/lint-before-commit-run-1.log) |

## Errors & Fixes

1. Initial performance fixture supplied a numeric `daysAhead` to the HTTP
   query schema. Corrected to its required string representation; bounded rerun
   passed. Final 30-sample warm 90-day service p95 is 10.11ms; 32 streams over
   731 days is 56.18ms. HTTP/browser overhead is excluded. The independent
   week-enumerating 24-month oracle includes leap-day and 1/2/4/52-week cycles.
2. Initial full backend run had an App Shortcut reorder connection reset.
   A later run had an existing public-widget fixture's unchecked create response
   produce an undefined widget ID and NOT NULL failure. The isolated public
   fixture passed; the complete unchanged-source rerun passed all 824 tests.
   These intermittent harness failures are retained, not hidden or relabelled
   as passing runs. Existing asynchronous calendar teardown stderr remains.
3. Review-fix editing briefly mismatched JSX fieldset/div closing tags. Fixed
   the structure and moved reapproval outside the stream loop so it remains
   reachable even when the retained draft deletes every stream. Five manager
   tests and both typechecks passed afterward.
4. The initial populated-main fixture archived unnecessary generated snapshots,
   exceeding the subprocess buffer. Restricted the archive to actual main SQL
   and journal. The failure sidecar is explicitly an excerpt (binary archive
   output excluded); the successful rerun is raw. No generated migration was
   edited. Original table columns and every row remain byte-equivalent after
   candidate migration and reopen/repeated migration; all four new tables are
   empty and FK checks clean.
5. Full format comparison started at 310 findings. Individually formatted feature
   source/tests and newly affected files. Final 267 findings equal all 266
   setup-baseline paths plus generated `0032_snapshot.json`, intentionally left
   generator-owned. No new hand-maintained source formatting findings remain.
6. Final lint initially rejected the performance test's console.info. Replaced
   it with stdout measurement output (no suppression), reran the test and full
   zero-warning Node 24 lint successfully.
7. First upgrade proof passed. Two later prescribed runs exited silently after
   the coarse candidate-build banner; that output does not establish where the
   failure occurred. A plain diagnostic Docker build passed; an ERR-line-only
   diagnostic execution passed; the final prescribed `pnpm test:upgrade`
   rerun passed: migrations 32→33, 28 baseline tables preserved, zero FK
   violations, health and original-admin login. Silent intermittency remains a
   harness diagnostic limitation, not a claimed root cause. Temporary gate
   resources/debug image were removed.

## Direct final code and UI review

`code-review-standard`, `design-taste`, `emil-design-eng`, upgrade and lint skills
were invoked. Significant findings were fixed and regression-tested:

| Before | After | Why |
| --- | --- | --- |
| Fullscreen close callback recreated on parent clock/query render | Stable callback | Prevents focus-trap effect resetting keyboard focus |
| All confirmation arrays capped at 512 | Stream arrays cap 32; exception IDs cap 8192 | Allows legitimate multi-stream destructive batches while preserving aggregate bounds |
| Retained-draft destructive reapproval rendered only before a draft existed | Reapproval inside the active draft, outside stream loop | Restored/rebased and empty-removal drafts can receive renewed exact confirmations |
| Inputs editable while preview/save pending | Disabled draft fieldset | Old asynchronous responses cannot replace subsequently edited values |

Review retained existing UI tokens, neutral visible names, quieter later dates,
complete wrapped long labels and immediate dense-list/keyboard behavior; no
decorative list motion or new dependencies. Full browser evidence covers
Chromium desktop and 360px WebKit, light/dark/reduced motion, 32 due streams,
keyboard interaction, complete month detail and restored overlay focus.
This is direct implementation review, **not** the requested fresh zero-context
Opus 4.8 review; the parent will launch that separately after handoff.

## Task Progress

78/97 tasks checked. T084–T087, T090 and T092–T096 have exact persistent outcomes.
These are independent executed gate/documentation outcomes, not completion of
their still-open full smoke/story prerequisite matrices. T088 remains pending:
the oracle/performance measurements and major automated smoke flows passed,
but every quickstart variant and four-context lifecycle/browser matrix has not
been individually demonstrated.

Pending tasks: T029, T042, T044, T055, T056, T058, T066, T067, T068, T069,
T071, T072, T073, T074, T083, T088, T089, T091, T097.
T029/T042 retain their missing original test-first/checkpoint evidence.
T044/T055/T056/T058/T066/T067/T071–T074 have narrower passing tests than their
complete requested matrices; these are remaining **coverage work**, not claims
that automation is unavailable. T083/T069/T097 are full-outcome closure tasks.
Manual human/assistive evidence and unauthorized T091 are distinct blockers.
No unchecked task is claimed fully completed.

## Local disposable demo handoff

Created and seeded a dedicated session-only data directory using supported
first-run, preview/save, dashboard-layout and preferences APIs. No live data was
read or modified. A temporary source-mode production server served the built
frontend; health/static readiness and authenticated Calendar display were
verified in desktop Chromium and 360px WebKit. Both showed complete names with
no horizontal overflow, and opened/closed month detail. Four streams include
the Wednesday weekly/alternating preset and finite purple seasonal glass dates.
The next preset date for this run is 2026-10-14.

Seed helper and screenshots remain session-only outside the repository.
The temporary server was stopped; parent can restart on the verified free
loopback port with the dedicated directory. Credentials/data paths are supplied
only in the local handoff, not committed to audit artifacts.

## Human evidence protocol — not performed

Recruit ten representative administrators/residents, including mobile and
desktop users. Without coaching, time preset/custom setup against the provider
calendar (target 9/10 within three minutes). Ask each to identify next date and
every due stream from same-colour/long-name crowded Calendar examples at 360px
and desktop (target 9/10 within ten seconds). Record anonymized timings,
misidentifications and retries. Separately test native screen-reader navigation,
labels and live refresh with assistive technology. No participants or manual
assistive-technology session are available here. Automation is not a substitute:
T068, T069, T089 and full T097 outcome closure remain pending.

## Phase Checkpoint

✅ Validated final implementation increment, **not full feature outcome closure**:
824 backend tests, 173 frontend unit tests, 36 browser tests (one pre-existing
skipped icon performance test), both typechecks, production build, populated-main
preservation, prescribed Docker upgrade and full zero-warning lint passed.
Final affected-source checks followed the review fixes. The full formatter
command remains baseline/generated-metadata failing as documented above.

T091 intentionally not executed; no PR/push/release. T097 remains pending for
the exact remaining coverage and human evidence. Parent handoff includes the
final candidate for an independent zero-context Opus 4.8 review and later local
user validation. No readiness claim beyond the tested increment is made.
