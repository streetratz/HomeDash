# Tasks: Docker Remote Endpoints & Endpoint Authorization

**Feature**: `043-docker-remote-auth` | **Branch**: `043-docker-remote-auth`
**Input**: Design documents from `/specs/043-docker-remote-auth/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/docker-endpoints.md](./contracts/docker-endpoints.md), [quickstart.md](./quickstart.md)

**Issues closed**: [#181](https://github.com/streetratz/HomeDash/issues/181) (remote connectivity), [#189](https://github.com/streetratz/HomeDash/issues/189) (unauthenticated Docker routes)

**Tests**: REQUIRED. FR-024 and FR-025 mandate negative- and positive-path coverage, and SC-007 requires each FR-024 scenario to have a test that fails pre-change. Test tasks are therefore not optional here.

---

## Table of Contents

- [Format](#format)
- [Scope guardrails](#scope-guardrails)
- [Phase ordering and user stories](#phase-ordering-and-user-stories)
- [Validation baselines](#validation-baselines)
- [Phase 1: Setup](#phase-1-setup--logging-scaffold)
- [Phase 2: Foundational](#phase-2-foundational--plan-phase-01-endpoint-grammar)
- [Phase 3: US2-A version negotiation](#phase-3-us2-a--plan-phase-02-version-negotiation)
- [Phase 4: US2-B SSH transport](#phase-4-us2-b--plan-phase-03-ssh-transport)
- [Phase 5: US1 authorization](#phase-5-us1--plan-phase-04-authorization--mvp-security-fix)
- [Phase 6: US3 frontend](#phase-6-us3--plan-phase-05-frontend--guidance)
- [Phase 7: Live verification](#phase-7-plan-phase-06-manual-live-verification)
- [Phase 8: Polish](#phase-8-polish--cross-cutting-concerns)
- [Dependencies & Execution Order](#dependencies--execution-order)
- [Parallel Opportunities](#parallel-opportunities)
- [Requirement Coverage Map](#requirement-coverage-map)
- [Implementation Strategy](#implementation-strategy)

---

## Format

`- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]** — parallelisable: different file, no dependency on an incomplete task.
- **[US1] / [US2] / [US3]** — the spec user story the task serves. Setup, Foundational, live-verification and Polish tasks carry no story label.
- Every task names concrete file paths.

## Path Conventions

Web-app monorepo per [plan.md § Project Structure](./plan.md#project-structure): `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, plus `Dockerfile`, `deploy/Dockerfile`, `docs/`, and `specs/001-homelab-dashboard/contracts/openapi.yaml`.

---

## Scope guardrails

Read before starting. These are hard boundaries, not preferences.

1. **Two issues only** — #181 and #189. Nothing else.
2. **No multi-host work.** Deferred to [#190](https://github.com/streetratz/HomeDash/issues/190) (spec changelog CH-05). [research.md R10](./research.md#r10-deferred-to-190--multi-host) is a preserved analysis record for that issue, **not** a work item in this feature. One widget resolves to exactly one Docker connection throughout. Do not relax `uniqueIndex('widget_conn_pk')`, do not add `sort_order`, do not add a `connectionId` discriminator, do not build grouped-host UI.
3. **MIGRATION-FREE.** The plan verified requirement-by-requirement ([research.md R5](./research.md#r5-storage-schema-change-vs-validation-only)) that no DDL is needed. **There is deliberately no `db:generate` task in this list.** If implementation uncovers a genuine schema need, **STOP and flag it loudly** (see T004) — do not silently add a migration, and never hand-write migration SQL (`backend/AGENTS.md`).
4. **No drive-by refactors** (root `AGENTS.md` rule 8). The four adjacent fixes that *are* in scope are explicitly authorised by the plan's Constitution Check: `useDocker.ts` bare `fetch`, missing Docker paths in `openapi.yaml`, `resolveDockerUrl()` missing its `connectionType` filter, and `DockerWidget.tsx:221` hard-coding the local socket.
5. **Container images keep running as root.** Pre-existing constitution deviation, documented in [plan.md § Complexity Tracking](./plan.md#complexity-tracking). Do **not** add a `USER` directive here.
6. **No new npm dependencies.** The SSH transport uses `node:child_process`, `node:stream`, `node:http` only. The single new artifact is the OS package `openssh-client`.
7. **No automated test may touch the live SSH host.** `docker-host` is a personal machine and there is no CI. Automated SSH coverage runs against the stub fixture; the live host is used only in Phase 7.

---

## Phase ordering and user stories

This feature has three spec user stories but a six-phase plan whose log filenames are already fixed by [plan.md § Test & Error Logging](./plan.md#test--error-logging). Phases below follow the **plan's committed numeric order** so log file `NN` stays a true global execution sequence (constitution § Test & Error Logging). Story membership is carried on every task label instead.

| Task phase | Plan phase / log file | Story | Delivers |
| --- | --- | --- | --- |
| 1 | — (scaffold, logged into 01) | — | Logs index + baselines |
| 2 | `01-phase-endpoint-grammar.md` | Foundational (blocks US1, US2, US3) | Closed-set endpoint grammar, SSRF boundary, error taxonomy |
| 3 | `02-phase-version-negotiation.md` | US2 | Clamped per-endpoint API negotiation |
| 4 | `03-phase-ssh-transport.md` | US2 | `ssh://` transport, env, images |
| 5 | `04-phase-authorization.md` | **US1** | The #189 lockdown |
| 6 | `05-phase-frontend.md` | US3 | Guidance, classified errors, corrected call sites |
| 7 | `06-phase-live-verification.md` | — | Manual SC-008 / SC-010 / SC-011 |
| 8 | — (logged into 06) | — | Polish, release notes, PR |

> **On US1 not being literally first.** [spec.md](./spec.md) states the authorization fix "must land before, or at the same time as, any connectivity work." That is satisfied: this is a **single PR closing both issues**, so nothing reaches a deployed install until US1 lands with it. Phase 5 also depends on Phase 2 (`DockerEndpointSchema`, `isAllowedDockerEndpoint()`), which is genuinely blocking. The branch-local window during Phases 3–4, where the still-unguarded routes can reach more hosts, exists only on an unmerged branch and must not be deployed. **Do not push this branch to `release` or build an image from it mid-feature.**

---

## Validation baselines

**There is no CI on pull requests.** Local runs are the only gate, and the gate is **"no NEW problems versus these baselines"** — never "clean".

| Command | Known baseline on `main` | Tracking |
| --- | --- | --- |
| `pnpm lint` | 82 problems (55 errors, 27 warnings) | #183–#188 |
| `pnpm --filter backend test` | 450 pass; **3 pre-existing failures** in `backend/tests/integration/calendar-phase7.test.ts` + 1 known flake in `rateLimit.test.ts` | pre-existing |
| `pnpm typecheck` | **23 errors**, all in backend test files: 13 TS2532 in `backup.test.ts`, 10 TS4111/TS18048 in `restore.test.ts` | pre-existing |
| `pnpm --filter backend openapi:lint` | 5 errors, 39 warnings in the 001 contract | pre-existing |

A task that demands a clean run of any of the above is wrong. Compare counts and identities of findings against the captured baseline (T003).

**Measured 2026-09-18 at commit `bc2ad02`** — raw output in
[`logs/01-phase-endpoint-grammar/`](./logs/01-phase-endpoint-grammar/), analysis
in [`logs/readme.md` § Baselines](./logs/readme.md#baselines). The typecheck and
test rows above were corrected by that measurement.

---

## Phase 1: Setup — Logging scaffold

**Purpose**: Constitution §V audit artifacts and the baselines every later gate compares against. **No build or test command may be run before T001–T002 exist.**

- [x] T001 Create `specs/043-docker-remote-auth/logs/` and write `specs/043-docker-remote-auth/logs/readme.md` as the canonical index, linking all six phase files named in [plan.md § Test & Error Logging](./plan.md#test--error-logging): `01-phase-endpoint-grammar.md`, `02-phase-version-negotiation.md`, `03-phase-ssh-transport.md`, `04-phase-authorization.md`, `05-phase-frontend.md`, `06-phase-live-verification.md`
- [x] T002 Create `specs/043-docker-remote-auth/logs/01-phase-endpoint-grammar.md` with the constitution-required sections in order (Overview / Commands Run / Run N / Errors & Fixes / Phase Checkpoint), a TOC and a back-link to `readme.md`, and create the sidecar folder `specs/043-docker-remote-auth/logs/01-phase-endpoint-grammar/`
- [x] T003 Capture pre-change baselines and commit the raw sidecars into `specs/043-docker-remote-auth/logs/01-phase-endpoint-grammar/`: `pnpm lint` → `eslint-run-1.log`, `pnpm typecheck` → `backend-tsc-run-1.log`, `pnpm --filter backend test` → `vitest-run-1.log`, `pnpm --filter backend openapi:lint` → `redocly-run-1.log`; record the resulting counts in a **Baselines** section of `logs/readme.md` so every later "no new problems" claim is auditable
- [x] T004 Record the migration-free decision in `logs/01-phase-endpoint-grammar.md` with a back-link to [research.md R5](./research.md#r5-storage-schema-change-vs-validation-only), and add an explicit **STOP condition**: if any later task appears to require a change to `backend/src/db/schema/`, halt, raise it in the PR/issue thread before writing code, and only ever generate it via `pnpm --filter backend db:generate` — never hand-write `backend/drizzle/*.sql`

**Checkpoint**: Logs index exists, baselines captured, migration guard recorded.

---

## Phase 2: Foundational — plan phase 01, endpoint grammar

**Log**: `logs/01-phase-endpoint-grammar.md` (created in T002)

**Purpose**: The closed-set endpoint grammar, the SSRF boundary and the error taxonomy. **Blocks every user story** — US1 needs the schema and validator for FR-016/FR-008, US2 needs the parsed `DockerEndpoint` union for transport selection, US3 needs the rejection messages.

**⚠️ CRITICAL**: No user-story phase may begin until this phase is complete.

- [x] T005 [P] Add the `DockerEndpoint` discriminated union (`kind: 'unix' | 'tcp' | 'https' | 'ssh'`, with `socketPath` / `host` / `port` / `user` per [data-model.md § Value objects](./data-model.md#value-objects-new-in-memory)) to `backend/src/lib/validation.ts`, with **no default or fallback variant** — *FR-001, FR-005*
- [x] T006 Implement `DockerEndpointSchema` in `backend/src/lib/validation.ts` as a closed-set Zod parser: accepts only `unix://`, `tcp://`, `https://`, `ssh://`; applies default ports `tcp`→2375, `https`→2376, `ssh`→22; rejects `http://` with a message directing to the plain-TCP form; rejects bare `host:port`, empty values and any unmatched shape with a message naming all four accepted forms; retains max length 2048; rejects shell metacharacters in the host/user components for SSH argv safety — *FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-030*
- [x] T007 Replace `dockerUrl: z.string().min(1).max(2048)` with `DockerEndpointSchema` in **both** `CreateDockerConnectionSchema` and `UpdateDockerConnectionSchema` in `backend/src/lib/validation.ts` — *FR-004, FR-007*
- [x] T008 [P] Add `isAllowedDockerEndpoint()` as a new sibling export in `backend/src/lib/url-validator.ts`: allow `unix://` paths and loopback/RFC1918 for `tcp`/`https`; deny `169.254.0.0/16`, `fe80::/10`, `0.0.0.0`, `::` and non-IP-resolvable hosts; validate `ssh://` user/host/port grammar without dialling. Add an inline comment stating the loopback divergence from `isAllowedArtUrl()` is **deliberate** under host networking and must not be collapsed (RK-6) — *FR-016*
- [x] T009 [P] Add the eight `DockerEndpointError` categories to `backend/src/lib/errors.ts` using the existing `ErrorCode`/`AppError` shapes, with the HTTP mapping in [data-model.md](./data-model.md#dockerendpointerror-classified-failure): `invalid_endpoint` 400, `endpoint_not_configured` 4xx, `endpoint_unreachable` 502, `ssh_auth_failed` 502, `ssh_host_key_failed` 502, `ssh_client_missing` 500, `remote_docker_unavailable` 502, `api_version_unsupported` 502. Categories are never collapsed into a generic "connection failed" — *FR-010, FR-011, FR-029, FR-036*
- [x] T010 Rewrite `parseDockerUrl()` in `backend/src/services/dockerService.ts` to delegate to `DockerEndpointSchema` and return the `DockerEndpoint` union, **deleting the silent Unix-socket fallthrough branch** that is the root cause of #181 — *FR-004, FR-005, FR-009*
- [x] T011 Add read-time re-validation of the stored `docker_url` in `backend/src/services/dockerService.ts` so a legacy non-conforming value fails closed with `invalid_endpoint` and text instructing the operator to re-enter it, while a conforming stored value continues to work untouched — *FR-008, FR-023*
- [x] T012 Ensure every connectivity failure raised from `backend/src/services/dockerService.ts` identifies the configured endpoint that was attempted, so a remote failure can never read as a local success — *FR-011*
- [x] T013 [P] Write `backend/tests/unit/dockerEndpoint.test.ts` covering **positive** paths (each of the four forms; default-port application for `tcp`/`https`/`ssh`; `unix:///var/run/docker.sock` behaviour preserved) and **negative** paths (`http://host:2375`, bare `host:2375`, empty, unknown scheme, over-length, shell metacharacters), asserting each rejection message names the accepted formats — *FR-001–FR-008, FR-025, SC-004*
- [x] T014 [P] Extend `backend/tests/unit/url-validator.test.ts` with `isAllowedDockerEndpoint()` cases, explicitly asserting the **loopback-allowed** divergence from the art policy and the link-local/`0.0.0.0` denials — *FR-016*
- [x] T015 Run `pnpm --filter backend test:unit` and `pnpm --filter backend typecheck`; capture sidecars as `vitest-run-2.log` / `backend-tsc-run-2.log` in `logs/01-phase-endpoint-grammar/`; complete the Commands Run, Errors & Fixes and Phase Checkpoint sections of `logs/01-phase-endpoint-grammar.md`, comparing against the T003 baseline

**Checkpoint**: Endpoint grammar green at unit level. FR-001–FR-011 and FR-016 covered. All three user stories unblocked.

---

## Phase 3: US2-A — plan phase 02, version negotiation (Priority: P1)

**Story**: User Story 2 — connect to a Docker host over the network.

**Goal**: A current Engine release (MinAPIVersion newer than the old pinned `/v1.43/`) returns its container list, and "Test Connection" can no longer report success where listing would fail.

**Independent Test**: Point a connection at a daemon whose `MinAPIVersion` exceeds 1.43 and confirm both the container list and the connection test succeed; confirm a daemon outside the speakable range produces an error naming its supported range.

**Log**: `logs/02-phase-version-negotiation.md`

- [x] T016 Create `specs/043-docker-remote-auth/logs/02-phase-version-negotiation.md` (constitution sections, TOC, back-link) and the sidecar folder `logs/02-phase-version-negotiation/`
- [x] T017 [US2] Settle OQ-1 — the `PREFERRED` API version constant — against the oldest daemon HomeDash intends to support, constrained to ≤ the field set actually parsed (stable since v1.24); define it in `backend/src/services/dockerService.ts` and record the decision and rationale in `logs/02-phase-version-negotiation.md`
- [x] T018 [US2] Implement the `DockerApiVersion` value object (`apiVersion`, `minApiVersion`, `effective`, `probedAt`) with `effective = clamp(PREFERRED, MinAPIVersion, ApiVersion)` and a `Map<endpointKey, DockerApiVersion>` cache keyed by normalised endpoint with ~10 minute TTL, in `backend/src/services/dockerService.ts`. The cache is **in-memory only** — it must not be persisted — *FR-026, FR-027*
- [x] T019 [US2] Replace the hardcoded `/v1.43/` prefix in `backend/src/services/dockerService.ts` with a probe of the unversioned `GET /version` followed by `/v{effective}/…` on all subsequent calls, falling back to unversioned requests if `/version` is unreachable — *FR-026, FR-027*
- [x] T020 [US2] On a `400` whose body indicates a client-version mismatch, invalidate the cache entry and re-probe **exactly once**; on a second failure raise `api_version_unsupported` with text naming the daemon's supported range and the version attempted (e.g. "daemon supports API 1.44–1.52; HomeDash requested 1.43") — *FR-029*
- [x] T021 [US2] Upgrade `testDockerConnection()` in `backend/src/services/connectionService.ts` (~L367) from `pingDocker()` on the unversioned `/_ping` to a **negotiated, versioned container listing** (e.g. `/v{effective}/containers/json?limit=1`), so a green test guarantees the widget will also list — *FR-028, SC-009*
- [x] T022 [P] [US2] Write `backend/tests/unit/dockerApiVersion.test.ts` covering clamp arithmetic (including `clamp(1.43, 1.44, 1.52) = 1.44`), cache hit/TTL-expiry/invalidation, the single-re-probe rule, and the FR-029 message text — *FR-026, FR-027, FR-029*
- [x] T023 [US2] Run `pnpm --filter backend test:unit` and `pnpm --filter backend typecheck`; capture sidecars in `logs/02-phase-version-negotiation/`; complete that phase log's Commands Run, Errors & Fixes and Phase Checkpoint sections

**Checkpoint**: FR-026–FR-029 covered; SC-009 mechanically guaranteed.

---

## Phase 4: US2-B — plan phase 03, SSH transport (Priority: P1)

**Story**: User Story 2 — connect to a Docker host over the network, including hosts that expose no network port.

**Goal**: `ssh://user@host[:port]` endpoints reach the remote Docker API via `docker system dial-stdio`, with key-based non-interactive auth, fail-closed host-key verification, bounded timeouts and no orphaned processes.

**Independent Test**: Against the stub `ssh` fixture, assert argv hardening, each failure classification, and that every success/error/timeout path leaves no child process.

**Log**: `logs/03-phase-ssh-transport.md`

- [x] T024 Create `specs/043-docker-remote-auth/logs/03-phase-ssh-transport.md` (constitution sections, TOC, back-link) and the sidecar folder `logs/03-phase-ssh-transport/`
- [x] T025 [P] [US2] Add `HOMEDASH_SSH_KEY_PATH` (default `${HOMEDASH_DATA_DIR}/ssh/id_ed25519`), `HOMEDASH_SSH_KNOWN_HOSTS_PATH` (default `${HOMEDASH_DATA_DIR}/ssh/known_hosts`) and `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING` (default `true`) to `backend/src/config/env.ts`. These are **paths and a flag only** — key contents are never read into HomeDash memory, never returned by any API, never logged. No other module may read `process.env` — *FR-031, FR-032, FR-033*
- [x] T026 [P] [US2] Add `ssh` to `REQUIRED_SUBDIRS` in `backend/src/config/dataDir.ts`, created with mode `0700` — *FR-033*
- [x] T027 [US2] Create `backend/src/services/dockerSshTransport.ts`: spawn the system `ssh` with the hardened argv from [research.md R1](./research.md#r1-ssh-transport-mechanism) — `-T`, `-o BatchMode=yes`, `-a`, `-x`, `-o ClearAllForwardings=yes`, `-o ConnectTimeout=<n>`, `-o StrictHostKeyChecking=yes`, `-o UserKnownHostsFile=<path>`, `-o IdentitiesOnly=yes`, `-i <key>`, `-o LogLevel=ERROR`, `[-p <port>] [<user>@]<host>`, `docker system dial-stdio` — wrap `{stdin, stdout}` as a `Duplex` and hand it to `http.request()` via a custom `createConnection`. Frame responses by `Content-Length`/chunked encoding and ignore trailing bytes after the response (the `context canceled` quirk). No agent forwarding, no port forwarding, no tty — *FR-030, FR-031, FR-032, FR-034*
- [x] T028 [US2] Add a key-permission preflight in `backend/src/services/dockerSshTransport.ts` rejecting any key whose mode is group- or world-accessible (`mode & 0o077 !== 0`) with an actionable remediation message; never log or echo key contents — *FR-033*
- [x] T029 [US2] Implement failure classification in `backend/src/services/dockerSshTransport.ts` from child exit code plus stderr patterns, mapping to the distinct T009 categories: host unreachable → `endpoint_unreachable`, auth rejected → `ssh_auth_failed`, host-key mismatch/unseeded `known_hosts` → `ssh_host_key_failed`, spawn `ENOENT` → `ssh_client_missing` ("SSH client not available in this image"), remote `docker` missing or permission denied → `remote_docker_unavailable` (RK-2). Truncate captured stderr and emit at `warn` without echoing secret paths' contents — *FR-035, FR-036*
- [x] T030 [US2] Bound every dial in `backend/src/services/dockerSshTransport.ts` with a single overall deadline that `SIGKILL`s the child and destroys the duplex, with cleanup in a `finally` so the timer is cleared and the child reaped on success, error **and** timeout alike — *FR-037, SC-011*
- [x] T031 [US2] Wire the `kind: 'ssh'` variant into transport selection in `backend/src/services/dockerService.ts` so listing, version negotiation and the admin test all route through `dockerSshTransport.ts`, alongside the existing `unix`/`tcp`/`https` paths — *FR-030*
- [x] T032 [P] [US2] Create the stub `ssh` fixture at `backend/tests/fixtures/ssh-stub/` — an executable script placed on a test-controlled `PATH`/command override that replays canned Docker HTTP responses and each canned failure mode. **No automated test may contact `docker-host` or any real host** ([research.md R7](./research.md#r7-test-strategy))
- [x] T033 [P] [US2] Write `backend/tests/unit/dockerSshTransport.test.ts` against the stub: exact argv construction (all hardening flags present), each failure classification, key-permission rejection, timeout behaviour, and a child-process count returning to baseline after success, failure and timeout — *FR-031–FR-037, SC-011*
- [x] T034 [P] [US2] Add `apk add --no-cache openssh-client` to the **production stage** of `Dockerfile` (alpine). Do **not** add a `USER` directive (scope guardrail 5) — *FR-035*
- [x] T035 [P] [US2] Add `apt-get install -y --no-install-recommends openssh-client` followed by `rm -rf /var/lib/apt/lists/*` to the **production stage** of `deploy/Dockerfile` (debian) — *FR-035*
- [x] T036 [P] [US2] Document all three `HOMEDASH_SSH_*` variables in `docs/getting-started.md`, and **qualify the sentence at `docs/getting-started.md:84`** which currently claims integrations need no environment variables — SSH-based Docker endpoints are the first that do — *FR-021*
- [x] T037 [US2] Measure the per-request `ssh` spawn cost against the widget's default 30 s poll budget (RK-1) and record the numbers in `logs/03-phase-ssh-transport.md`. Connection pooling stays **deferred** unless the measurement justifies it — do not add it speculatively
- [x] T038 [US2] Run `pnpm --filter backend test:unit` and `pnpm --filter backend typecheck`; capture sidecars in `logs/03-phase-ssh-transport/`; complete that phase log's sections

**Checkpoint**: FR-030–FR-038 covered at unit level against the stub. US2's transport work is complete; live confirmation is Phase 7.

---

## Phase 5: US1 — plan phase 04, authorization 🎯 MVP security fix (Priority: P1)

**Story**: User Story 1 — lock down the Docker endpoints (#189).

**Goal**: No Docker route serves unauthenticated traffic, and **no route anywhere accepts an endpoint from a caller**. Ordinary listing and container actions both resolve the endpoint server-side from the widget's stored connection.

**Independent Test**: Issue container-list and action requests with (a) no session, (b) a non-admin session, (c) a non-admin session supplying an arbitrary endpoint, (d) an admin session — and confirm only authenticated callers receive data, only admins may supply an endpoint (and only via the admin test route), and `POST /api/docker/ping` returns 404.

**Log**: `logs/04-phase-authorization.md`

- [x] T039 Create `specs/043-docker-remote-auth/logs/04-phase-authorization.md` (constitution sections, TOC, back-link) and the sidecar folder `logs/04-phase-authorization/`
- [x] T040 [US1] Add `preHandler: [requireAuth]` to `GET /api/docker/containers` in `backend/src/api/docker.ts`, evaluated **before** any endpoint resolution, DNS lookup, socket open or `ssh` spawn, returning a constant `401` body so neither content nor timing reveals which endpoints are configured — *FR-012, FR-019, SC-001, SC-002*
- [x] T041 [US1] Remove the caller-supplied `url` query parameter from `GET /api/docker/containers` in `backend/src/api/docker.ts`; accept only `widgetInstanceId` (required) and the existing `all` flag, resolving the endpoint server-side — *FR-014*
- [x] T042 [US1] Fix `resolveDockerUrl()` in `backend/src/api/docker.ts` (~L25-40) to filter on `connectionType = 'docker'` instead of `widgetInstanceId` alone with an arbitrary `.get()`, and make it the **single** endpoint-resolution path for both listing and actions — *FR-014, D10*
- [x] T043 [US1] **Delete** the `POST /api/docker/ping` route from `backend/src/api/docker.ts` (route removed, not merely guarded) — it is an unauthenticated duplicate of the already-correct `POST /api/admin/connections/docker/test` — *FR-013, FR-015, FR-018*
- [x] T044 [US1] Remove `dockerUrl` from `ContainerActionSchema` in `backend/src/api/docker.ts` (~L18-22), changing the body to `{ widgetInstanceId, containerId, action }` and resolving the endpoint server-side via `resolveDockerUrl()`. **Keep `requireAdmin` + `assertCsrf` exactly as they are** — this feature must not weaken them. No `connectionId` discriminator (scope guardrail 2) — *FR-015, FR-016, FR-017, FR-038*
- [x] T045 [US1] Remove every code comment or assumption in `backend/src/api/docker.ts` asserting the Docker API is safe to expose because "the socket is local" — the endpoint is caller-influenced and may be remote — *FR-018*
- [x] T046 [US1] Wire the T009 error categories through `backend/src/api/docker.ts` so `endpoint_not_configured` (widget resolves to no Docker connection, or its stored endpoint fails re-validation) returns a `4xx` distinct from the `502` `endpoint_unreachable`/`ssh_*`/`api_version_unsupported` family, with **no fallback to `unix:///var/run/docker.sock` on any path** — *FR-009, FR-010, FR-011, SC-005*
- [x] T047 [US1] Validate the caller-supplied endpoint on `POST /api/admin/connections/docker/test` and `POST /api/admin/connections/docker/:id/test` in `backend/src/api/connections.ts` through `DockerEndpointSchema` **and** `isAllowedDockerEndpoint()` before any outbound connection is attempted; these remain the only admin-supplied-endpoint path — *FR-007, FR-015, FR-016, FR-038*
- [x] T048 [US1] Create `backend/src/services/dockerWidgetAdoption.ts`: an **idempotent** startup reconciliation that, for each widget carrying a legacy `config.dockerUrl`, creates a named `docker_connections` row, links it via `widget_connections`, and removes the config field — writing **rows into existing tables only, no DDL**. A value failing `DockerEndpointSchema` is **left alone and reported** (one log line per widget), never imported (RK-7) — *FR-022, FR-023, SC-006*
- [x] T049 [US1] Register the adoption pass in the server bootstrap (`backend/src/server.ts`) so it runs once at startup after migrations, logging one line per adopted or skipped widget
- [x] T050 [P] [US1] Write `backend/tests/integration/dockerAuth.test.ts` covering the full FR-024 negative matrix: unauthenticated container list; unauthenticated connection test; authenticated non-admin supplying an arbitrary endpoint; missing/invalid CSRF on the action route; `POST /api/docker/ping` → 404; and a **uniform rejection** assertion that the 401/403 body is byte-identical regardless of the destination supplied — *FR-012, FR-013, FR-015, FR-019, FR-024, SC-001, SC-002, SC-007*
- [x] T051 [P] [US1] Write `backend/tests/integration/dockerContainers.test.ts` covering server-side resolution from `widgetInstanceId`, the `4xx` misconfigured vs `502` unreachable distinction, the **absence of any silent local fallback**, and preserved `unix://` listing behaviour — *FR-009, FR-010, FR-011, FR-014, FR-025, SC-005, SC-006*
- [x] T052 [P] [US1] Write `backend/tests/integration/dockerAction.test.ts` asserting the action reaches the **resolved** endpoint (not the local socket), that a body carrying `dockerUrl` is rejected/ignored, and that `requireAdmin` + `assertCsrf` still hold (RK-8) — *FR-016, FR-017*
- [x] T053 [P] [US1] Write `backend/tests/integration/dockerAdoption.test.ts` over a seeded legacy `config.dockerUrl` widget: adoption is idempotent across repeated startups, a conforming value is adopted and linked, and a non-conforming value is left untouched and reported (RK-7) — *FR-022, FR-023, SC-006*
- [x] T054 [US1] Declare the Docker paths in `specs/001-homelab-dashboard/contracts/openapi.yaml` per [contracts/docker-endpoints.md](./contracts/docker-endpoints.md) — `GET /api/docker/containers` (session), `POST /api/docker/action` (admin + CSRF), `POST /api/admin/connections/docker/test`, `POST /api/admin/connections/docker/:id/test` — each with its security requirement declared, and **no** `/api/docker/ping` entry — *FR-025*
- [x] T055 [US1] Extend `backend/tests/contract/openapi.test.ts` to assert each Docker path is present with its declared auth and that `/api/docker/ping` is **absent** from the document — *FR-025*
- [x] T056 [US1] Run `pnpm --filter backend test:integration`, `pnpm --filter backend test:contract`, `pnpm --filter backend typecheck` and `pnpm --filter backend openapi:lint`; capture sidecars in `logs/04-phase-authorization/`; confirm against the T003 baseline that the only backend test failures are the 3 pre-existing `calendar-phase7.test.ts` ones and that `openapi:lint` shows **no new** findings beyond the pre-existing `security-defined` set; complete that phase log's sections

**Checkpoint**: **US1 complete.** #189 is closed — no unauthenticated Docker route, no caller-supplied endpoint anywhere. FR-012–FR-019 and FR-022–FR-025 covered.

---

## Phase 6: US3 — plan phase 05, frontend & guidance (Priority: P2)

**Story**: User Story 3 — understand and correct a bad endpoint.

**Goal**: The settings form states the accepted formats and their default ports, rejections are legible at the moment of save/test, widget errors are classified rather than generic, and the frontend stops sending endpoints entirely.

**Independent Test**: Submit malformed and unsupported endpoint strings through the connection form and confirm each is rejected with a message naming the supported formats; confirm a widget with an unresolvable connection shows a configuration error and never local container data.

**Log**: `logs/05-phase-frontend.md`

- [x] T057 Create `specs/043-docker-remote-auth/logs/05-phase-frontend.md` (constitution sections, TOC, back-link) and the sidecar folder `logs/05-phase-frontend/`
- [x] T058 [US3] Rewrite `frontend/src/hooks/useDocker.ts` to call the API through `src/lib/apiClient.ts` instead of bare `fetch` (carries session cookie + CSRF header), send **only** `widgetInstanceId` for listing, change the action payload to `{ widgetInstanceId, containerId, action }`, and remove `useDockerPing` — retargeting any remaining test-connection use to the admin route already consumed by `frontend/src/hooks/useConnections.ts` (RK-4) — *FR-014, FR-017*
- [x] T059 [P] [US3] Remove the `dockerUrl?` escape-hatch field from `DockerConfig` in `frontend/src/state/dashboards.ts` (~L112), leaving `pollIntervalSeconds`, `maxContainers` and `allowControls` unchanged; existing values are handled server-side by the T048 adoption pass — *FR-014, FR-022*
- [x] T060 [US3] Update `frontend/src/components/widgets/DockerWidget.tsx`: drop `resolveMode`/`explicitUrl`, **remove the hard-coded `'unix:///var/run/docker.sock'` fallback at ~L221** so actions target the displayed host (RK-8), and render the classified error categories distinctly — "no Docker connection configured" must read differently from "host unreachable", and neither may show stale or local container data — *FR-010, FR-011, SC-005*
- [x] T061 [US3] Update `frontend/src/components/settings/DockerConnectionForm.tsx` to state the four supported endpoint formats and the default ports applied when a port is omitted (`tcp`→2375, `https`→2376, `ssh`→22) in the field's guidance text, and surface the server's rejection message at both save time and test time. Guidance and errors must remain legible and operable at ~360 px with touch-sized targets and keyboard access, using existing `frontend/src/components/ui/` primitives (constitution §II) — *FR-006, FR-020, SC-003*
- [x] T062 [P] [US3] Write `frontend/src/hooks/__tests__/useDocker.test.ts` asserting `apiClient` is used (not bare `fetch`), that no endpoint/URL is ever sent in a listing or action request, and that `useDockerPing` no longer exists
- [x] T063 [P] [US3] Add a Playwright spec under `frontend/tests/e2e/` covering endpoint-format validation messaging in the Docker connection form: a rejected `http://` value, a rejected bare `host:port`, and an accepted `tcp://` value — asserting the message names the accepted formats. Start `pnpm dev` first (`playwright.config.ts` has `webServer` commented out) — *SC-003*
- [x] T064 [P] [US3] Add user-facing Docker connection documentation to `docs/getting-started.md`: the four accepted endpoint formats with default ports, the rejection of `http://` and bare `host:port` with the re-entry remedy, the SSH setup recipe (key, `ssh-copy-id`, `known_hosts` seeding) from [quickstart.md](./quickstart.md#configuring-an-ssh-endpoint), and the **authentication requirement** on the Docker endpoints — *FR-021*
- [x] T065 [US3] Run `pnpm --filter frontend test:unit`, `pnpm --filter frontend typecheck` and `pnpm --filter frontend build`; capture sidecars (`vitest-run-N.log`, `frontend-tsc-run-N.log`, `vite-run-N.log`) in `logs/05-phase-frontend/`; run the new Playwright spec and capture `playwright-run-N.log`; complete that phase log's sections

**Checkpoint**: **US3 complete.** FR-006, FR-020, FR-021 covered; SC-003 and SC-005 verified. All three user stories are now independently functional.

---

## Phase 7: plan phase 06, manual live verification

**Purpose**: SC-008, SC-010 and SC-011 can only be proven against a real daemon. These steps are **manual, developer-local and never automated** — `docker-host` is a personal machine and there is no CI. Record every command and its output in the phase log.

**Log**: `logs/06-phase-live-verification.md`

- [x] T066 Create `specs/043-docker-remote-auth/logs/06-phase-live-verification.md` (constitution sections, TOC, back-link) and the sidecar folder `logs/06-phase-live-verification/`
- [x] T067 [US2] Confirm the version clamp is necessary and correct: run `ssh docker-host 'docker version --format "API={{.Server.APIVersion}} MIN={{.Server.MinAPIVersion}}"'` (expect `API=1.52 MIN=1.44`) and confirm HomeDash negotiates `1.44`, not the old `/v1.43/`; paste the result into the phase log — *FR-026, FR-029, SC-008*
- [x] T068 [US2] Configure `ssh://docker-host` in Settings → Connections → Docker per [quickstart.md](./quickstart.md#configuring-an-ssh-endpoint) (key at `$HOMEDASH_DATA_DIR/ssh/id_ed25519` mode 0600, `known_hosts` seeded via `ssh-keyscan`), press **Test Connection**, and confirm the widget lists all 18 containers from the remote host — *FR-030, SC-010*
- [x] T069 [US2] Exercise the plain-TCP form and the deliberate loopback-allowed policy without opening a port on the remote host: `ssh -nNT -L 23750:/var/run/docker.sock docker-host &`, configure `tcp://127.0.0.1:23750`, and confirm the container list matches T068 — *FR-002, FR-016, SC-008*
- [x] T070 [US1] With the widget pointed at the SSH host, restart a container from the widget and confirm on the remote host (`ssh docker-host 'docker ps --format "{{.Names}}\t{{.Status}}"'`) that **that host's** container restarted — the pre-change behaviour would have hit the local daemon (RK-8) — *FR-017*
- [x] T071 [US2] Confirm no orphaned SSH clients: `ps -ax | grep -c '[d]ial-stdio'` returns to its pre-operation baseline between polls and after a forced error and a forced timeout. Note `timeout(1)` is unavailable on macOS — use `ssh -o ConnectTimeout=N` — *FR-037, SC-011*
- [x] T072 Confirm the local-socket regression case: an existing `unix:///var/run/docker.sock` connection lists containers **with no configuration change**, and a legacy `config.dockerUrl` widget is adopted at startup with no operator action — *FR-022, FR-023, SC-006*
- [x] T073 Confirm FR-028/SC-009 end-to-end: there is no reachable combination where Test Connection reports success and the widget then shows no containers; attempt it against each configured endpoint form and record the outcomes — *FR-028, SC-009*

**Checkpoint**: SC-008, SC-009, SC-010, SC-011 manually verified and evidenced in the phase log.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T074 Verify SC-007: confirm each FR-024 negative test added in T050 **fails against the pre-change behaviour** — run the new specs against a worktree/stash of `main`'s `backend/src` — and record the before/after outcomes in `logs/06-phase-live-verification.md` — *FR-024, SC-007*
- [x] T075 Run the full local gate — `pnpm lint`, `pnpm typecheck`, `pnpm --filter backend test`, `pnpm --filter frontend test:unit`, `pnpm --filter backend openapi:lint`, `pnpm build` — capture sidecars in `logs/06-phase-live-verification/` and assert **no NEW problems versus the T003 baselines**: lint ≤ 82 problems (55 errors / 27 warnings) with no new identities, backend tests showing only the 3 pre-existing `calendar-phase7.test.ts` failures, typecheck showing only the pre-existing `restore.test.ts` TS4111/TS18048, `openapi:lint` showing only the pre-existing `security-defined` findings
- [x] T076 [P] Write release notes covering the four intentional breaking changes: `POST /api/docker/ping` deleted (RK-4); stored non-conforming endpoints now fail closed instead of silently resolving to the local socket (RK-5, FR-008); container actions now target the displayed host rather than the local daemon (RK-8); the `dockerUrl` widget config field is adopted into a real connection at startup (RK-7)
- [x] T077 [P] If any edit was made to `specs/043-docker-remote-auth/spec.md` during implementation, add a new `CH-NN` entry to `specs/043-docker-remote-auth/changelog-spec.md` **in the same commit** (constitution → Spec Changelog; root `AGENTS.md` rule 5)
- [x] T078 Finalise `specs/043-docker-remote-auth/logs/readme.md`: all six phase files linked, every sidecar present, each phase carrying a pass/fail Phase Checkpoint, and the Baselines section reconciled against the T075 final run
- [x] T079 Open the PR with `gh pr create --base main`, including the threat-model note required by `backend/AGENTS.md` for auth/networking changes (what is exposed, who can reach it before/after, how it is mitigated, uniform rejection, residual risk — source: [research.md R6](./research.md#r6-authorization-redesign--ssrf-boundary)), the release notes from T076, and `Closes #181` / `Closes #189`. Confirm the PR touches **no** `backend/drizzle/*.sql` file and contains **no** multi-host work

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (Setup)
   └─▶ Phase 2 (Foundational — endpoint grammar)   ⚠ BLOCKS EVERYTHING
          ├─▶ Phase 3 (US2-A version negotiation)
          │      └─▶ Phase 4 (US2-B SSH transport)
          ├─▶ Phase 5 (US1 authorization)  ← needs only Phase 2
          │      └─▶ Phase 6 (US3 frontend)  ← needs Phase 5's API shape
          └─────────▶ Phase 7 (live verification) ← needs Phases 3-6
                          └─▶ Phase 8 (Polish)
```

- **Phase 2 blocks all three stories**: US1 needs `DockerEndpointSchema` + `isAllowedDockerEndpoint()` for FR-016 and read-time re-validation for FR-008; US2 needs the parsed `DockerEndpoint` union for transport selection; US3 needs the rejection messages.
- **Phase 5 (US1) depends only on Phase 2**, not on Phases 3–4. A team with capacity can run Phase 5 in parallel with Phases 3–4 — see below.
- **Phase 6 (US3) depends on Phase 5** because the frontend consumes the changed route contracts (removed `url`, removed `dockerUrl`, deleted ping).
- **Phase 7 depends on Phases 3, 4, 5 and 6** — it exercises the shipped behaviour end to end.

### Story dependencies

- **US1 (P1)** — independent of US2 and US3 once Phase 2 is done. Completes at T056.
- **US2 (P1)** — independent of US1 at the code level (Phases 3–4 touch `dockerService.ts` / `dockerSshTransport.ts`, US1 touches `docker.ts` / `connections.ts`). Completes at T038 (automated) and T071 (live).
- **US3 (P2)** — depends on US1's route contracts; per spec it also depends on US2's accepted-format decision, delivered in Phase 2. Completes at T065.

### Critical intra-phase ordering

- T001–T002 before **any** build or test command in the feature (constitution §V).
- T005 → T006 → T007 (types → schema → wiring); T006 → T010 → T011.
- T008 and T009 are independent of T005–T007 and of each other.
- T017 → T018 → T019 → T020 → T021.
- T025/T026 → T027 → T028/T029/T030 → T031; T032 → T033.
- T042 before T041 and T044 (both consume the fixed resolver); T009 → T046.
- T048 → T049 → T053.
- T054 → T055.
- T058 → T060 (widget consumes the hook); T059 → T060.

---

## Parallel Opportunities

**Phase 1**: T003 and T004 after T002.

**Phase 2**: T005, T008, T009 together (three different files). Then T013 and T014 together once T006/T008 land.

**Phase 4**: T025, T026, T032, T034, T035, T036 are six different files with no ordering between them:

```bash
Task: "Add HOMEDASH_SSH_* vars in backend/src/config/env.ts"
Task: "Add 'ssh' to REQUIRED_SUBDIRS in backend/src/config/dataDir.ts"
Task: "Create stub ssh fixture in backend/tests/fixtures/ssh-stub/"
Task: "Add openssh-client to Dockerfile production stage"
Task: "Add openssh-client to deploy/Dockerfile production stage"
Task: "Document HOMEDASH_SSH_* in docs/getting-started.md"
```

**Phase 5**: the four integration suites are independent files:

```bash
Task: "backend/tests/integration/dockerAuth.test.ts"
Task: "backend/tests/integration/dockerContainers.test.ts"
Task: "backend/tests/integration/dockerAction.test.ts"
Task: "backend/tests/integration/dockerAdoption.test.ts"
```

**Phase 6**: T059, T062, T063, T064 alongside the T058/T060/T061 chain.

**Phase 8**: T076 and T077 together.

**Cross-phase**: with two developers, Phase 5 (US1) can run concurrently with Phases 3–4 (US2) immediately after Phase 2 — they touch disjoint backend files. Phase 6 must wait for Phase 5.

---

## Requirement Coverage Map

Every functional requirement and success criterion in [spec.md](./spec.md) is claimed by at least one task. **No FR or SC is unclaimed.**

### Functional requirements

| FR | Tasks |
| --- | --- |
| FR-001 endpoint format set | T005, T006, T013 |
| FR-002 default ports | T006, T013, T069 |
| FR-003 reject `http://` | T006, T013, T063 |
| FR-004 reject unmatched, no fallthrough | T006, T007, T010, T013 |
| FR-005 never infer socket path | T005, T006, T010, T013 |
| FR-006 rejection names formats | T006, T013, T061 |
| FR-007 validate at every boundary | T007, T011, T047 |
| FR-008 stored bad value fails closed | T011, T013 |
| FR-009 no local substitution | T010, T046, T051 |
| FR-010 unresolvable connection error | T009, T046, T051, T060 |
| FR-011 error names attempted endpoint | T009, T012, T046, T051, T060 |
| FR-012 listing requires auth | T040, T050 |
| FR-013 connection test requires auth | T043, T050 |
| FR-014 server-side resolution | T041, T042, T051, T058, T059 |
| FR-015 endpoint admin-only | T043, T044, T047, T050 |
| FR-016 URL-validation boundary | T008, T014, T044, T047, T052, T069 |
| FR-017 action keeps admin+CSRF | T044, T052, T058, T070 |
| FR-018 not public; remove "socket is local" | T043, T045 |
| FR-019 uniform rejection | T040, T050 |
| FR-020 settings form states formats | T061 |
| FR-021 user docs updated | T036, T064 |
| FR-022 local socket unchanged | T048, T053, T059, T072 |
| FR-023 no re-creation needed | T011, T048, T053, T072 |
| FR-024 negative coverage | T050, T074 |
| FR-025 positive coverage | T013, T051, T054, T055 |
| FR-026 no pinned version | T018, T019, T022, T067 |
| FR-027 per-endpoint negotiation | T018, T019, T022 |
| FR-028 test matches listing | T021, T073 |
| FR-029 error names supported range | T020, T022, T067 |
| FR-030 SSH endpoint form | T006, T027, T031, T068 |
| FR-031 non-interactive key auth | T025, T027, T033 |
| FR-032 host-key verification | T025, T027, T033 |
| FR-033 no key material stored/logged/returned | T025, T026, T028, T033 |
| FR-034 least privilege ssh invocation | T027, T033 |
| FR-035 image provides ssh client | T029, T034, T035 |
| FR-036 failures distinguishable | T009, T029, T033 |
| FR-037 bounded + cleaned up | T030, T033, T071 |
| FR-038 SSH under same authz | T044, T047 |

### Success criteria

| SC | Tasks |
| --- | --- |
| SC-001 unauthenticated returns nothing | T040, T050 |
| SC-002 no reachability oracle | T040, T050 |
| SC-003 configurable from form guidance alone | T061, T063 |
| SC-004 100% of bad formats rejected | T013 |
| SC-005 error rather than wrong host | T046, T051, T060 |
| SC-006 local deployments unchanged | T048, T051, T053, T072 |
| SC-007 tests fail pre-change | T074 |
| SC-008 current Engine lists containers | T067, T069 |
| SC-009 green test implies green listing | T021, T073 |
| SC-010 SSH-only host works | T068 |
| SC-011 no orphaned ssh processes | T030, T033, T071 |

### Deliberately not claimed

- **[research.md R10](./research.md#r10-deferred-to-190--multi-host)** — a preserved analysis handed to [#190](https://github.com/streetratz/HomeDash/issues/190). Not a requirement of this feature and correctly has no task. Its only obligation here — server-side resolution by connection identity — is discharged by T042, T044 and T048.
- **Non-root container images** — pre-existing constitution deviation recorded in [plan.md § Complexity Tracking](./plan.md#complexity-tracking); T034/T035 explicitly must not "fix" it.
- **No `db:generate` task exists.** This is intentional (scope guardrail 3); T004 carries the STOP condition should that assessment prove wrong.

---

## Implementation Strategy

### Single-PR delivery (required)

Both issues ship in **one PR**. The spec requires the #189 authorization fix to land no later than the #181 connectivity work, because the connectivity fix widens the range of hosts a caller could reach. Do **not** merge Phases 2–4 ahead of Phase 5, and do not build or deploy an image from a mid-feature branch state.

### Suggested increments (for review, not for shipping)

1. **Phases 1–2** — foundation. Endpoint grammar green at unit level; nothing user-visible yet.
2. **Phase 5 (US1)** — the security fix. Reviewable on its own and the highest-value increment; #189 is closed at T056.
3. **Phases 3–4 (US2)** — connectivity. #181's version and transport defects fixed.
4. **Phase 6 (US3)** — guidance and the corrected frontend call sites.
5. **Phases 7–8** — live verification, baseline reconciliation, release notes, PR.

### Parallel team strategy

1. Everyone completes Phases 1–2 together.
2. Then: Developer A takes Phase 5 (US1, backend authz); Developer B takes Phases 3–4 (US2, service/transport). Disjoint files.
3. Phase 6 (US3, frontend) starts when Phase 5's route contracts are merged into the branch.
4. Phases 7–8 are done together.

### Per-task discipline

- Commit after each task or logical group; every phase log and sidecar is a committed audit artifact.
- No phase is ✅ with known failing tests other than the documented baselines (root `AGENTS.md` rule 7).
- Run the **smallest** command that covers the change; escalate only on failure.
- Auth and networking changes carry the threat-model note (T079).

---

## Task Summary

| Phase | Tasks | Count | Story |
| --- | --- | --- | --- |
| 1 Setup | T001–T004 | 4 | — |
| 2 Foundational (endpoint grammar) | T005–T015 | 11 | blocks all |
| 3 Version negotiation | T016–T023 | 8 | US2 |
| 4 SSH transport | T024–T038 | 15 | US2 |
| 5 Authorization | T039–T056 | 18 | **US1** |
| 6 Frontend & guidance | T057–T065 | 9 | US3 |
| 7 Live verification | T066–T073 | 8 | — |
| 8 Polish | T074–T079 | 6 | — |
| **Total** | | **79** | |

Story-labelled tasks: **US1** 18 (T040–T056 plus the live action check T070), **US2** 25 (T017–T023, T025–T038, plus live checks T067–T069 and T071), **US3** 8 (T058–T065). The remaining 28 are unlabelled Setup, Foundational, log-scaffold, shared live-verification and Polish tasks. Parallelisable tasks marked `[P]`: 23.
