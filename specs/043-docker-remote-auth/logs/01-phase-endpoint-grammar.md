# Phase 1: Endpoint Grammar — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1 — Pre-change baselines](#run-1--pre-change-baselines)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

Covers `tasks.md` Phase 1 (Setup, T001–T004) and Phase 2 (Foundational,
T005–T015) — the logging scaffold, the pre-change validation baselines, the
migration guard, and then the closed-set endpoint grammar, SSRF boundary, and
error taxonomy that every later phase depends on.

Setup tasks (T001–T004) are recorded here rather than in a separate log because
they produce no code; the six phase logs named in
[plan.md § Test & Error Logging](../plan.md#test--error-logging) map to the
implementation phases.

### Migration guard (T004)

**This feature is migration-free.** Verified requirement-by-requirement in
[research.md R5](../research.md#r5-storage-schema-change-vs-validation-only): the
endpoint grammar is validation over the existing `docker_url TEXT NOT NULL`
column; authorization only *reads* existing `widget_connections` rows; the
version-negotiation cache is deliberately in-memory so it cannot survive a daemon
upgrade; SSH credentials are filesystem paths supplied by environment variables,
never rows; and legacy-config adoption writes rows into existing tables, one
Docker link per widget, which the untouched `widget_conn_pk` unique index already
permits. There is no DDL anywhere in scope. The only migration ever contemplated
(relaxing `widget_conn_pk` and adding `sort_order`) left with the multi-host
scope, deferred to [#190](https://github.com/streetratz/HomeDash/issues/190).

**STOP condition.** If any task appears to require a change to
`backend/src/db/schema/`:

1. **Halt.** Do not write the change.
2. Raise it in the PR or issue thread first — a schema need means the R5 analysis
   was wrong, and that is worth knowing before code is written.
3. If it is genuinely required, generate it with
   `pnpm --filter backend db:generate`. **Never hand-write
   `backend/drizzle/*.sql`** (`backend/AGENTS.md`).

T079 asserts at PR time that no `backend/drizzle/*.sql` file was touched.

## Commands Run

| #   | Command                              | Purpose                | Sidecar                 |
| --- | ------------------------------------ | ---------------------- | ----------------------- |
| 1   | `pnpm lint`                          | Baseline (T003)        | `eslint-run-1.log`      |
| 2   | `pnpm typecheck`                     | Baseline (T003)        | `backend-tsc-run-1.log` |
| 3   | `pnpm --filter backend test`         | Baseline (T003)        | `vitest-run-1.log`      |
| 4   | `pnpm --filter backend openapi:lint` | Baseline (T003)        | `redocly-run-1.log`     |
| 5   | `pnpm --filter backend exec vitest run tests/integration/rateLimit.test.ts` | Isolate a suspected flake | `vitest-ratelimit-run-2.log` |
| 6   | `pnpm --filter backend test:unit` | Phase 2 gate (T015) | `vitest-run-2.log` |
| 7   | `pnpm typecheck` | Phase 2 gate (T015) | `backend-tsc-run-2.log` |
| 8   | `pnpm typecheck` (after fix) | Phase 2 gate re-run | `backend-tsc-run-3.log` |
| 9   | `pnpm lint` | Phase 2 gate (T015) | `eslint-run-2.log` |

## Run 1 — Pre-change baselines

Captured by T003 at commit `bc2ad02` (`01-phase-endpoint-grammar/HEAD.txt`),
before any implementation change. Full table in
[readme.md § Baselines](./readme.md#baselines).

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm lint` | 1 | 82 problems (55 errors, 27 warnings) |
| `pnpm typecheck` | 2 | 23 errors, all in backend test files |
| `pnpm --filter backend test` | 1 | 450 pass / 4 fail (454) |
| `pnpm --filter backend openapi:lint` | 1 | 5 errors, 39 warnings |

Every one of these fails on `main` too. The gate for this feature is **no new
problems versus these numbers**, never a clean run.

Two baseline figures differ from what `tasks.md` records, and both are worth
carrying forward:

**1. Typecheck is broader than documented.** `tasks.md` cites TS4111/TS18048 in
`restore.test.ts` only. The real count is 23 across two files —
`tests/integration/backup.test.ts` contributes 13 `TS2532` that had not been
noted. Still entirely pre-existing and entirely in test files, but the
comparison figure is 23, not 10.

**2. The suite reports 4 failures, not 3 — one is a flake.**
`tests/integration/rateLimit.test.ts > returns 429 after exceeding login rate
limit` times out at 5s in the full run, but passes in isolation (run 5: 2/2,
exit 0). Root cause is visible in the unhandled rejection vitest attributes to
that file:

```
TypeError: Cannot open database because the directory does not exist
 ❯ new Database better-sqlite3/lib/database.js:65:9
 ❯ Module.getSqliteDb src/db/sqlite.ts:18:9
 ❯ executeJob src/services/scheduledJobService.ts:398:14
 ❯ E._trigger croner/dist/croner.js
```

A `scheduledJobService` cron job outlives the test file that started it and
fires after the temp data dir has been removed, so it throws while an unrelated
test is running; the rate-limit timeout is collateral damage from the same
run's load. It is a pre-existing test-isolation defect, unrelated to Docker,
and **out of scope here** — but it means the honest gate is *"the only failing
tests are the 3 in `calendar-phase7.test.ts`, plus possibly this known flake"*.
Any other red test is a regression.

## Run 2 — Phase 2 gate (T015)

| Command | Exit | Result | vs baseline |
| --- | --- | --- | --- |
| `pnpm --filter backend test:unit` | 0 | **122 pass / 122** across 7 files, including 44 new `dockerEndpoint` cases and 10 new `isAllowedDockerEndpoint` cases | ✅ no failures |
| `pnpm typecheck` | 2 | 23 errors — 13 `TS2532` in `backup.test.ts`, 10 in `restore.test.ts` | ✅ identical to baseline |
| `pnpm lint` | 1 | 82 problems (55 errors, 27 warnings) | ✅ identical to baseline; no finding in any file touched |

`test:unit` is the phase gate rather than the full suite: phase 2 changes no
route or database behaviour, and the integration suite is re-run at the phase 5
gate. The full-suite baseline is unaffected.

## Errors & Fixes

| # | Symptom | Diagnosis | Resolution |
| --- | --- | --- | --- |
| 1 | Baseline suite reported 4 failures against an expected 3 | Re-ran `rateLimit.test.ts` alone → 2/2 pass. Full-run failure is caused by a leaked `scheduledJobService` cron opening a torn-down temp SQLite dir. | Classified as a pre-existing flake, not a regression and not a baseline failure. Documented above and in `readme.md` so it is not mistaken for damage from this feature. No code changed. |
| 2 | `src/lib/validation.ts(430,5): error TS2322: Type 'number' is not assignable to type '22 \| 2375 \| 2376'` | `DOCKER_DEFAULT_PORTS` is declared `as const`, so `let port = DOCKER_DEFAULT_PORTS[scheme]` inferred the literal union rather than `number`, and the parsed-port assignment then failed. | Annotated the local as `let port: number`. The `as const` is kept — it is what makes the per-scheme default lookup type-safe. Re-run clean (`backend-tsc-run-3.log`). |

## Design notes

**`DockerEndpointSchema` outputs a string, not the parsed union.** `data-model.md`
describes `DockerEndpoint` as "the parsed, validated result of
`DockerEndpointSchema`", but T007 also requires that schema to replace
`dockerUrl: z.string()` inside `CreateDockerConnectionSchema` /
`UpdateDockerConnectionSchema`. Those two cannot both hold literally: `docker_url`
is a `TEXT` column and the API contract carries a string, so a transforming
schema would have changed the persisted shape and forced a migration — the one
thing this feature is explicitly avoiding. Resolved by splitting the concerns:

- `parseDockerEndpoint(raw)` → `{ ok, endpoint } | { ok: false, error }` — the
  typed union, used by the service layer.
- `parseDockerEndpointOrThrow(raw)` → throws a classified `AppError`.
- `DockerEndpointSchema` — a `z.string()` with `superRefine`, validating via the
  same parser and yielding the **string** unchanged.

One grammar, one implementation, no storage change.

**Value is validated but not rewritten.** Trimming aside, a valid endpoint is
stored exactly as the operator typed it. Normalising (e.g. appending the default
port) would silently rewrite saved settings and make the settings field disagree
with what was entered.

**`endpoint_not_configured` is 409.** `data-model.md` leaves it as "4xx". 404 would
be indistinguishable from "no such widget", which is precisely the ambiguity
FR-010 exists to remove, so a widget that exists but has no Docker connection
linked returns 409.

**SSH is rejected, not silently rerouted.** `dockerRequest()` recognises
`kind: 'ssh'` and fails with `remote_docker_unavailable` until phase 3 implements
the transport. Falling through to HTTP would have recreated the #181 class of bug
inside the fix for it.

**`isAllowedDockerEndpoint()` does not resolve SSH hostnames.** `~/.ssh/config`
`Host` aliases are a supported way to name a Docker host — `docker-host`
is exactly that — and deliberately have no DNS record. Requiring a lookup would
reject the working configuration. IP literals are still checked, so an SSH
endpoint aimed at a link-local address is denied.

## Phase Checkpoint

✅ **Phase 2 (Foundational, T005–T015) complete.** Endpoint grammar green at unit
level; FR-001–FR-011 and FR-016 covered; all user stories unblocked.

| Task | Outcome |
| --- | --- |
| T005/T006 | `DockerEndpoint` union + closed-set parser in `backend/src/lib/validation.ts`. No fallback variant. |
| T007 | `DockerEndpointSchema` wired into both connection schemas. |
| T008 | `isAllowedDockerEndpoint()` in `backend/src/lib/url-validator.ts`, with the RK-6 divergence documented in-code. |
| T009 | Eight `DockerErrors.*` constructors + `ErrorCode` entries in `backend/src/lib/errors.ts`. |
| T010 | `parseDockerUrl()` replaced; **the silent Unix-socket fallthrough is deleted**. |
| T011 | Read-time re-validation — a non-conforming stored value fails closed with re-entry instructions. |
| T012 | Every connectivity failure names the endpoint attempted via `describeEndpoint()`. |
| T013/T014 | 44 + 10 new unit tests. |
| T015 | Gate run; results above. |

✅ **Setup (T001–T004) complete.**

- T001 — `logs/readme.md` created as the canonical index, linking all six phase logs.
- T002 — this log created with the constitution-required sections, plus the sidecar folder `01-phase-endpoint-grammar/`.
- T003 — all four baselines captured with raw sidecars and exit codes; counts recorded here and in `readme.md`; one discrepancy investigated and explained rather than papered over.
- T004 — migration guard and STOP condition recorded (see [Overview](#migration-guard-t004)).

No implementation code written. Phase 2 (Foundational, T005–T015) may begin.
