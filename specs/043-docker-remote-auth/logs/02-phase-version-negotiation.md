# Phase 2: API Version Negotiation — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [OQ-1 — the preferred API version](#oq-1--the-preferred-api-version)
- [Commands Run](#commands-run)
- [Run 1 — phase gate](#run-1--phase-gate)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

`tasks.md` Phase 3 (T016–T023). Replaces the hardcoded `/v1.43/` API prefix with
negotiation against the daemon's advertised range, and makes the connection test
exercise the same call the widget makes.

This is the defect that produced the reported symptom in
[#181](https://github.com/streetratz/HomeDash/issues/181): Engine 29.1.3
advertises `MinAPIVersion` 1.44 and rejects `/v1.43/...` with HTTP 400, while the
unversioned `/_ping` the connection test used still returned 200. **Test
Connection said "Connected to Docker" and the widget stayed empty.**

## OQ-1 — the preferred API version

**Decision: `PREFERRED_API_VERSION = '1.24'`.**

The constant is a **floor, not a target**. `effective = clamp(PREFERRED,
MinAPIVersion, ApiVersion)`, so against a modern daemon the daemon's own minimum
wins and the preference costs nothing; it only decides what we speak to a daemon
whose range sits *below* it.

1.24 is the oldest version serving every field this client parses from
`/containers/json` — `Id`, `Names`, `State`, `Status`, `Image`, `Ports`,
`Created` — all stable since Docker 1.12. That is the constraint T017 requires:
the preference must not exceed the field set actually parsed.

Choosing higher would repeat the original mistake in the opposite direction —
pinning a version some supported daemon cannot serve. Choosing lower would claim
compatibility with daemons that cannot satisfy the response shape we parse.

## Commands Run

| #   | Command                            | Purpose                 | Sidecar                 |
| --- | ---------------------------------- | ----------------------- | ----------------------- |
| 1   | `pnpm --filter backend test:unit`  | Phase gate (T023)       | `vitest-run-1.log`      |
| 2   | `pnpm --filter backend test:unit`  | Re-run after test fix   | `vitest-run-2.log`      |
| 3   | `pnpm typecheck`                   | Phase gate (T023)       | `backend-tsc-run-1.log` |
| 4   | `pnpm typecheck`                   | Re-run after import fix | `backend-tsc-run-2.log` |
| 5   | `pnpm lint`                        | Phase gate              | `eslint-run-1.log`      |
| 6   | `pnpm --filter backend test`       | Full suite — the connection-test change is behavioural | `vitest-full-run-3.log` |

## Run 1 — phase gate

| Command | Exit | Result | vs baseline |
| --- | --- | --- | --- |
| `pnpm --filter backend test:unit` | 0 | **138 pass / 138** (8 files), including 16 new version-negotiation cases | ✅ |
| `pnpm typecheck` | 2 | 23 errors, all pre-existing in `backup.test.ts` / `restore.test.ts` | ✅ identical |
| `pnpm lint` | 1 | 82 problems (55 errors, 27 warnings) | ✅ identical |
| `pnpm --filter backend test` | 1 | **521 pass / 3 fail (524)** — the 3 known `calendar-phase7` failures only | ✅ no regression |

The full suite was run because `testDockerConnection()` changed behaviour. Pass
count rose from the 450 baseline to 521 through added tests; the failure set is
unchanged. The `rateLimit.test.ts` flake recorded in phase 1 did not recur,
consistent with it being load-dependent.

Tests run against a **fake daemon** — an in-process `http.Server` speaking just
enough of the Engine API to advertise a version range and reject
below-minimum requests exactly as Engine 29.1.3 does. No test contacts the real
`docker-host` host; live verification is phase 6.

## Errors & Fixes

| # | Symptom | Diagnosis | Resolution |
| --- | --- | --- | --- |
| 1 | `expected …HomeDash requested 1.40, got …requested 1.30` | **My test assertion was wrong, not the code.** For a daemon advertising 1.30–1.40, `clamp('1.24', '1.30', '1.40')` is `1.30` — the preferred version is raised to the daemon *minimum*, not its maximum. I had written the expectation as though clamping targeted the ceiling. | Corrected the expectation to `1.30`. Worth recording because the mistake is the intuitive one: the daemon's **minimum** is the binding constraint in the #181 scenario. |
| 2 | `src/services/dockerService.ts(328,88): error TS2304: Cannot find name 'AppError'` | `unsupportedVersionError()` returns `AppError`, but only the `DockerErrors` value was imported. | Added `type AppError` to the existing import. |

## Design notes

**`/version` is probed unversioned, and its failure is not fatal.** `/version` is
the one endpoint that answers regardless of negotiation. If it cannot be reached
we fall back to unversioned request paths rather than guessing a prefix — the
daemon then applies its own default. A genuine connectivity failure still
surfaces from the real call, with the endpoint named.

**The cache is in-memory and keyed by normalised endpoint (FR-027).** A
`Map<string, DockerApiVersion>` with a 10-minute TTL, keyed on
`describeEndpoint()`, so two widgets pointed at one host share a probe. It is
deliberately **not persisted**: a cached version must not survive a daemon
upgrade, which is precisely the state that produces a stale-prefix 400.

**Exactly one re-probe (FR-029).** A client-version 400 invalidates the entry and
re-probes once. A second rejection raises `api_version_unsupported` naming the
daemon's range and what was requested — *"supports API 1.30–1.40; HomeDash
requested 1.30"* — rather than retrying against a range that cannot overlap. A
dedicated test asserts the probe count is exactly 2, so a retry loop cannot be
introduced unnoticed.

**`DockerHttpError` never escapes the module.** Version negotiation needs the
status code and body to recognise a client-version rejection, which the
classified `AppError` shape does not carry. An internal error type carries them,
and `classify()` converts at the public boundary — an unclassified failure
reaching a route is exactly what made #181 undiagnosable.

**`pingDocker()` is deprecated, not deleted.** `POST /api/docker/ping` is removed
in phase 5 (T043); deleting the function now would have mixed two phases. The
deprecation notice states why a green ping does not imply a working listing.

## Phase Checkpoint

✅ **Phase 3 (T016–T023) complete.** FR-026–FR-029 covered; SC-009 mechanically
guaranteed — the connection test now performs a negotiated versioned listing, so
it cannot pass in a configuration where the widget fails.

| Task | Outcome |
| --- | --- |
| T016 | This log + sidecar folder. |
| T017 | OQ-1 settled: `PREFERRED_API_VERSION = '1.24'`, rationale above. |
| T018 | `DockerApiVersion` + clamp + in-memory TTL cache. |
| T019 | `/v1.43/` deleted; `/version` probe then `/v{effective}/…`, unversioned fallback. |
| T020 | Single re-probe on a client-version 400, then `api_version_unsupported` naming the range. |
| T021 | `testDockerConnection()` now calls `testDockerListing()` — a versioned `/containers/json?limit=1`, not `/_ping`. |
| T022 | 16 new tests in `backend/tests/unit/dockerApiVersion.test.ts`. |
| T023 | Gate run; results above. |
