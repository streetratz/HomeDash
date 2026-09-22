# Phase 9: Migration Relationship Integrity

[Back to phase index](./readme.md)

## Overview

Regression fix for [#209](https://github.com/streetratz/HomeDash/issues/209).
Migration `0028_huge_black_cat.sql` rebuilt `app_widget_instances` with
generated `PRAGMA foreign_keys=OFF/ON` statements. Drizzle's synchronous SQLite
migrator issues `BEGIN` before those statements, and SQLite ignores foreign-key
mode changes inside an active transaction.

Dropping the parent table therefore legally cascaded into
`links_list_items`, `shortcut_groups`, `app_shortcuts`, and
`widget_connections`, while applying `SET NULL` to legacy Pi-hole and UniFi
references. Users, dashboards, widget instances, connection rows, and general
settings survived, matching the production incident.

The migration runner now disables foreign keys before Drizzle starts its
transaction, restores the original setting afterward, and runs
`foreign_key_check` whenever migrations were applied.

## Production Evidence

Read-only copies were taken into the session workspace. No NAS database was
modified.

| Table | 2026-09-18 02:00 backup | Post-upgrade current DB |
|---|---:|---:|
| `app_widget_instances` | 10 | 10 |
| `links_list_items` | 4 | 0 |
| `app_shortcuts` | 12 | 0 |
| `widget_connections` | 3 | 3 after manual recreation |
| `pihole_instances` | 1 | 1 |
| `docker_connections` | 2 | 2 |
| `unifi_instances` | 1 | 2 after manual recreation |
| `users` | 1 | 1 |

The September 18 backup has 27 migrations applied; the current database has
29. Applying migrations 0027–0028 to a disposable backup copy reproduced the
loss exactly. Disabling foreign keys before invoking Drizzle preserved all
affected rows with clean `quick_check` and `foreign_key_check` results.

## Commands Run

Command output is captured in `09-phase-migration-integrity/`.

| Command | Result | Sidecar |
|---|---|---|
| Synthetic migration-integrity test | ✅ Final run: 10 passed | `vitest-migration-run-1.log`, `vitest-migration-run-2.log`, `vitest-migration-run-3.log` |
| Production backup copy migration | ✅ 4 links, 12 shortcuts, and 3 widget links preserved; integrity clean | `production-backup-migration-run-1.log`, `production-backup-migration-run-2.log` |
| Backend typecheck | ⚠️ Source passed; test typecheck reached existing unrelated findings | `backend-typecheck-run-1.log` |
| Backend test suite | ✅ Final run preserved baseline: 695 passed, the same 3 calendar failures | `backend-vitest-run-1.log`, `backend-vitest-run-2.log` |
| Backend production build | ✅ Bundle and declarations built | `backend-build-run-1.log` |
| Full local lint gate | ✅ Zero errors and zero warnings | `eslint-run-1.log` |

## Errors & Fixes

- The first full backend run included one additional `publicWidgets.test.ts`
  failure. That file passed alone and alongside the migration test; the second
  full run returned to the established three-failure calendar baseline.
- The full suite also emitted the known scheduler teardown warning attributed
  to another integration file after its database closed. This is documented
  pre-existing test infrastructure behavior and did not affect assertions.
- Backend source typechecking passed. Test typechecking reported existing
  unrelated findings in backup, restore, and public snapshot tests; none are in
  this change.
- Code review identified that the first implementation disabled foreign keys
  for every pending migration. It was narrowed before PR to only batches whose
  generated SQL explicitly requests `PRAGMA foreign_keys=OFF`.

## Review

- **Correctness/data integrity:** the synthetic pre-0027 fixture and a copied
  production backup both preserve all affected child rows and references.
- **Security:** migration SQL is unchanged; the runner restores the prior
  foreign-key mode in `finally` and refuses startup if applied migrations leave
  foreign-key violations.
- **Maintainability:** pending-migration detection follows the same latest
  timestamp rule used by Drizzle and only compensates for its transaction
  ordering when a generated migration requests foreign keys off.
- **UI/design applicability:** not applicable; no frontend files or user
  interface behavior changed.
- **Lint gate:** passed with zero errors and zero warnings.

## Recovery Status

The missing shortcut/link records remain available in the untouched backup:

```text
/path/to/homedash/homedash-data/backups/homedash_20260918_020000.db
```

No live recovery has been attempted. Restoring or merging rows into the
current NAS database requires an explicit operator decision after a fresh
backup of the current state.

## Phase Checkpoint

✅ **Complete.** Root cause, prevention fix, production-backup verification,
regression coverage, code review, documentation, lint, backend tests, and
production build are complete under
[PR #211](https://github.com/streetratz/HomeDash/pull/211). Release promotion
and NAS deployment remain intentionally deferred. Live data recovery requires
a separate explicit operator decision.
