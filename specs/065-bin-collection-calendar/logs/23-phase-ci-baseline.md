# 23 — Portable Migration Baseline

[Back to Logs Index](readme.md)

## Scope and Findings

PR #21 quality CI failed one of 835 backend tests: migration fixture extraction
required a local `main` branch absent in the detached Actions checkout. This
was not a production migration failure. Pin fixture extraction to the exact
pre-feature main commit c5bd8a1102cd2e7a1d22cbea93b68614be5903a5 instead.
The full-history quality checkout already contains this commit. Missing history
still fails explicitly; no fallback, skipped test or weakened assertion.

Using origin/main alone would fix detached checkout but become incorrect after
merge, when main includes collection tables. A pinned pre-feature baseline
preserves the empty-collection assertion and makes this regression repeatable.
The separate Docker gate continues to use actual current main.

## Reviews

Scoped code review: both git commands use the same baseline; table/column/row,
restart, empty new-table and foreign-key assertions unchanged. Runtime and UI
diff unchanged from the independently reviewed candidate; design review has
no new applicable surface.

## Commands Run

Node 24.18.0: full backend 835/835 (73 suites), both typechecks and full
zero-warning lint passed. Original `pnpm test:upgrade` with repository-local
TMPDIR passed: migrations 32 → 35, 28 tables unchanged, zero FK violations and
original admin login retained. Raw output:
[validation-run-1.log](23-phase-ci-baseline/validation-run-1.log).
Phase 22 frontend unit/browser/build results remain applicable; no frontend
or production source changed.

## Phase Checkpoint

Local mandatory gates refreshed and passed. Push the test-only correction;
merge remains blocked until the new candidate passes CI. No cleanup yet.
