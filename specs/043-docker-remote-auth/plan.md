# Implementation Plan: Docker Remote Endpoints & Endpoint Authorization

**Branch**: `043-docker-remote-auth` | **Date**: 2026-02-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/043-docker-remote-auth/spec.md`
**Changelog**: [changelog-spec.md](./changelog-spec.md) | **Research**: [research.md](./research.md)

---

## Table of Contents

- [Summary](#summary)
- [Technical Context](#technical-context)
- [Constitution Check](#constitution-check)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Implementation Phases](#implementation-phases)
- [Test & Error Logging](#test--error-logging)
- [Risks & Open Questions](#risks--open-questions)
- [Complexity Tracking](#complexity-tracking)

---

## Summary

Two linked defects in the Docker integration are fixed together because they share the
same code path.

1. **Remote endpoints don't work** (#181). `parseDockerUrl()` recognises only
   `unix://`, `tcp://` and `https://`; anything else — including `http://host:2375` and
   bare `host:2375` — silently falls through to a Unix **socket path**. Separately, the
   Docker API version is hardcoded as `/v1.43/`, which modern daemons reject
   (`MinAPIVersion 1.44` on Engine 29.1.3), while the connection test calls the
   *unversioned* `/_ping` — so "Test Connection" reports success and the widget then
   fails to list containers.
2. **The Docker endpoints are unauthenticated** (#189). `GET /api/docker/containers`
   and `POST /api/docker/ping` have no `preHandler` and accept a caller-supplied `url`,
   giving any LAN device both container enumeration and an unauthenticated outbound-
   request primitive from the HomeDash host.
**Technical approach**: replace the endpoint parser with a closed-set, validated
endpoint grammar covering `unix://`, `tcp://`, `https://` and a new `ssh://` form;
implement SSH by spawning the system `ssh` client running `docker system dial-stdio`
and speaking HTTP over its stdio duplex via a custom `http.request` `createConnection`
(verified working against a live Engine 29.1.3 host during planning, zero new npm
dependencies); replace the hardcoded API version with clamped, per-endpoint-cached
negotiation from `/version`; put `requireAuth` on container listing with **server-side**
endpoint resolution only; and **delete** `POST /api/docker/ping` as a redundant
unauthenticated duplicate of the already-correct, admin-guarded
`POST /api/admin/connections/docker/test`.

`POST /api/docker/action` also loses its caller-supplied `dockerUrl` body field: it keeps
its (already correct) `requireAdmin` + `assertCsrf` guard but resolves the endpoint
server-side from `widgetInstanceId`, so no route anywhere accepts an endpoint from a
caller ([R9](./research.md#r9-action-route-endpoint-resolution)).

**Multi-host Docker widgets are out of scope**, deferred to
[#190](https://github.com/streetratz/HomeDash/issues/190) (spec changelog CH-05). One
widget resolves to one Docker connection throughout this plan. The analysis produced
before the deferral is preserved in
[research.md R10](./research.md#r10-deferred-to-190--multi-host) so #190 does not restart
from zero.

**No database migration is required.** The change is validation and transport only;
evidence requirement-by-requirement in
[research.md R5](./research.md#r5-storage-schema-change-vs-validation-only).

## Technical Context

**Language/Version**: TypeScript (strict), Node.js >= 22.13.0, pnpm 11.1.3
**Primary Dependencies**: Fastify 5, Drizzle ORM, better-sqlite3, Zod, pino (backend);
React + TanStack Query + Vite (frontend). **No new runtime dependencies** — the SSH
transport uses `node:child_process`, `node:stream` and `node:http` only.
**Storage**: SQLite via Drizzle. Existing `docker_connections.docker_url TEXT NOT NULL`
(`backend/src/db/schema/index.ts:825`) is unchanged, and `widget_connections` is
unchanged. **No migration** — verified against every remaining requirement in
[research.md R5](./research.md#r5-storage-schema-change-vs-validation-only). The only
migration this feature ever contemplated served multi-host and left with it to #190.
**Testing**: Vitest (`tests/unit`, `tests/integration`, `tests/contract`) + supertest via
`backend/tests/helpers/http.ts`; Playwright for frontend E2E.
**Target Platform**: Linux container (Synology/homelab), LAN-only, frequently host
networking. Images: `Dockerfile` (`node:22-alpine`) and `deploy/Dockerfile`
(`node:22-slim`).
**Project Type**: Web application — `backend/` + `frontend/` monorepo.
**Performance Goals**: Version negotiation adds at most one `/version` round trip per
endpoint per cache TTL (~10 min), never on the widget polling path. SSH dial cost is one
`ssh` process per request; container listing must stay within the existing widget poll
budget (default 30 s interval).
**Constraints**: Every outbound transport bounded by an explicit timeout (existing 10 s
baseline); no unauthenticated network-reaching endpoints; no private key material in the
database, in API responses, or in logs; no CI on PRs, so no test may depend on the
developer-local SSH host. Settings-form guidance and error surfaces must stay usable from
~360 px, touch-friendly and keyboard accessible (constitution §II); the widget's visual
presentation is explicitly out of scope.
**Scale/Scope**: Single-household deployment, a handful of Docker connections, one per
widget. Touches ~8 backend files, ~3 frontend files, no migration, 2 Dockerfiles, 1 docs
page, 1 OpenAPI contract.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Constitution
v2.4.0.*

| Principle / Gate | Assessment | Verdict |
| --- | --- | --- |
| **I. Secure by Default** | This feature exists to restore the principle. Default-deny `preHandler`s replace the current no-auth routes; the redundant ping route is deleted rather than guarded; the admin action route stops accepting an endpoint from the request body ([R9](./research.md#r9-action-route-endpoint-resolution)), so **no** route accepts a caller-supplied endpoint at all; SSH keys are referenced (never stored, returned, or logged) with owner-only permission preflight; `StrictHostKeyChecking=yes` fails closed when `known_hosts` is unseeded. | ✅ Pass (post-design ✅) |
| **II. Local-First / No Cloud Dependency** | Purely local: talks to a Docker daemon the operator already runs, over a socket, LAN TCP, or SSH to a host they control. No new outbound internet dependency. | ✅ Pass (post-design ✅) |
| **II. Responsive / accessible UI** | No widget redesign — the spec puts the Docker widget's visual presentation out of scope, and multi-host UI is deferred to #190. The only UI surfaces touched are the connection settings form (FR-020 endpoint-format guidance) and the widget's error/empty states (FR-010, FR-011), both of which must remain legible and operable at ~360 px with touch-sized targets and keyboard access, using existing `frontend/src/components/ui/` primitives. No new UI dependency. | ✅ Pass (post-design ✅) |
| **III. LAN Boundary & Host Networking** | Reduces LAN exposure: the two unauthenticated routes are removed/guarded. The `ssh -L` transport alternative was **rejected specifically because** it would open an unauthenticated Docker API on a local TCP port that host networking makes LAN-reachable ([research.md R1](./research.md#r1-ssh-transport-mechanism)). `isAllowedDockerEndpoint()` deliberately permits loopback/RFC1918 (the legitimate case) while denying link-local metadata ranges. | ✅ Pass (post-design ✅) |
| **IV. Deliberate, Pinned Dependencies** | **Zero new npm dependencies.** The only new artifact is an OS package (`openssh-client`) in the production image stages, required by FR-035. | ✅ Pass (post-design ✅) |
| **V. Testing & Logging Discipline** | Unit + integration + contract coverage mapped requirement-by-requirement in [research.md R7](./research.md#r7-test-strategy). Authorization has an explicit negative matrix (FR-024). No test depends on the live SSH host — a stub `ssh` fixture is used instead. Feature logs directory is created at implementation start (see [Test & Error Logging](#test--error-logging)). | ✅ Pass (post-design ✅) |
| **Deployment: container runs non-root** | ⚠️ **Pre-existing deviation.** Neither `Dockerfile` nor `deploy/Dockerfile` has a `USER` directive; both run as root today. Not introduced by this feature and not fixed here (entangled with docker-socket group membership and `/data` ownership on existing installs). Recorded in [Complexity Tracking](#complexity-tracking). This feature does not worsen it. | ⚠️ Documented deviation |
| **Workflow: threat-model note required** | Provided in [research.md R6](./research.md#r6-authorization-redesign--ssrf-boundary): what is exposed, who can reach it before/after, mitigations, uniform rejection, residual risk — covering SSRF and host-key trust explicitly. | ✅ Pass |
| **Workflow: spec changelog** | `changelog-spec.md` exists. Any edit to `spec.md` during implementation requires a new `CH-NN` entry in the same commit. | ✅ Pass |
| **Workflow: migrations generated not hand-written** | **No migration.** Checked requirement-by-requirement across FR-001..FR-038 — endpoint grammar is validation over an existing `TEXT` column, authorization reads existing rows, version-negotiation state is deliberately in-memory, SSH credentials are filesystem paths from env vars, and legacy-config adoption writes rows into existing tables only ([R5](./research.md#r5-storage-schema-change-vs-validation-only)). The one migration previously planned belonged to multi-host and is deferred with it to #190. If implementation uncovers a need, it must come from `pnpm --filter backend db:generate`. | ✅ Pass |
| **Workflow: env vars documented** | Three new `HOMEDASH_SSH_*` variables added to `backend/src/config/env.ts` **and** `docs/getting-started.md` in the same PR. | ✅ Pass |
| **Workflow: stay in scope** | Multi-host was removed from this feature the moment it was deferred (CH-05); no multi-host design survives in the plan, only a signpost to #190. Adjacent problems found during research: root container user (deferred, see Complexity Tracking); `useDocker.ts` using bare `fetch`; Docker paths missing from `openapi.yaml`; `resolveDockerUrl()` never filtering on `connectionType`; and `DockerWidget.tsx:221` hard-coding the local socket for container actions. The last four are in scope because this feature rewrites those exact call sites and route contracts — the action-routing bug in particular is fixed *by* the #189 change rather than in addition to it. | ✅ Pass |

**Result: PASS**, with one documented pre-existing deviation carried into Complexity
Tracking. No unjustified violations; no gate blocks Phase 0 or Phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/043-docker-remote-auth/
├── spec.md                  # Feature specification (committed)
├── changelog-spec.md        # Spec changelog (committed)
├── checklists/              # Spec quality checklists (committed)
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   └── docker-endpoints.md  # Phase 1 output — route + authz contracts
├── logs/                    # Created at implementation start (constitution §V)
└── tasks.md                 # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── docker.ts                  # authz redesign; resolver fixed + reused by actions; delete ping
│   │   └── connections.ts             # single admin Test Connection path (already guarded)
│   ├── services/
│   │   ├── dockerService.ts           # endpoint parsing, version negotiation, transports
│   │   ├── dockerSshTransport.ts      # NEW: ssh dial-stdio duplex + http agent
│   │   ├── connectionService.ts       # testDockerConnection → negotiated container list
│   │   └── dockerWidgetAdoption.ts    # NEW: idempotent startup import of config.dockerUrl
│   ├── lib/
│   │   ├── validation.ts              # DockerEndpointSchema (closed set)
│   │   ├── url-validator.ts           # NEW export: isAllowedDockerEndpoint()
│   │   └── errors.ts                  # reuse existing ErrorCode/AppError shapes
│   └── config/
│       ├── env.ts                     # HOMEDASH_SSH_* vars
│       └── dataDir.ts                 # add 'ssh' to REQUIRED_SUBDIRS (0700)
└── tests/
    ├── unit/                          # dockerEndpoint, dockerApiVersion, dockerSshTransport, url-validator
    ├── integration/                   # dockerAuth, dockerContainers, dockerAction, dockerAdoption
    ├── contract/                      # openapi.test.ts (extended)
    └── fixtures/ssh-stub/             # NEW: fake `ssh` binary for transport tests

frontend/
└── src/
    ├── state/dashboards.ts            # DockerConfig: drop dockerUrl escape hatch (adopted server-side)
    ├── hooks/
    │   ├── useDocker.ts               # apiClient instead of bare fetch; widgetInstanceId-only;
    │   │                              #   drop useDockerPing; action takes widgetInstanceId
    │   └── useConnections.ts          # already targets the admin test routes
    └── components/
        ├── widgets/
        │   └── DockerWidget.tsx       # drop resolveMode/explicitUrl; stop hard-coding the local
        │                              #   socket for actions (L221); surface classified errors
        └── settings/
            └── DockerConnectionForm.tsx   # endpoint guidance + validation messaging (FR-020)

Dockerfile                             # + openssh-client (alpine production stage)
deploy/Dockerfile                      # + openssh-client (debian production stage)
docs/getting-started.md                # document HOMEDASH_SSH_* vars
specs/001-homelab-dashboard/contracts/openapi.yaml   # declare Docker paths + security
```

**Structure Decision**: Web application layout — the existing `backend/` +
`frontend/` pnpm monorepo. All backend work stays inside the established
`api/ → services/ → lib/ → db/` layering: routes do authorization and shape validation,
services own transport and negotiation, `lib/` owns reusable validation. The one new
backend module (`dockerSshTransport.ts`) is isolated so it can be unit-tested against a
stub `ssh` binary without touching route or DB code.

## Design Decisions

Full rationale and rejected alternatives are in [research.md](./research.md); summarised
here for reviewers.

| # | Decision | Where |
| --- | --- | --- |
| D1 | SSH via `ssh <host> docker system dial-stdio` + custom `createConnection` duplex; one dial per request; no new npm deps. Rejected `ssh2` (heavy, reimplements host-key trust) and backend-managed `ssh -L` (creates an unauthenticated LAN-reachable Docker port). | [R1](./research.md#r1-ssh-transport-mechanism) |
| D2 | Keys are **referenced, never stored**. New `HOMEDASH_SSH_KEY_PATH`, `HOMEDASH_SSH_KNOWN_HOSTS_PATH`, `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING`; defaults under `HOMEDASH_DATA_DIR/ssh` (dir 0700, key 0600 enforced by preflight); fail-closed host-key verification, no TOFU. | [R2](./research.md#r2-ssh-credential--host-key-management) |
| D3 | `openssh-client` added to both production image stages. Root-user deviation documented, not fixed. | [R3](./research.md#r3-container-image-changes) |
| D4 | Clamped version negotiation: probe unversioned `/version`, `clamp(PREFERRED, MinAPIVersion, ApiVersion)`, cache per endpoint ~10 min, one re-probe on client-version 400. Test Connection upgraded from `/_ping` to a negotiated container list. | [R4](./research.md#r4-docker-api-version-negotiation) |
| D5 | **No migration for the endpoint work** — validation-only over the existing `docker_url` column, with re-validation at read time so legacy bad values fail closed. | [R5](./research.md#r5-storage-schema-change-vs-validation-only) |
| D6 | `requireAuth` + server-side resolution on containers; `url` param removed; `POST /api/docker/ping` deleted in favour of the existing admin test route; new `isAllowedDockerEndpoint()` with a deliberately Docker-specific loopback policy. | [R6](./research.md#r6-authorization-redesign--ssrf-boundary) |
| D7 | Tests split unit/integration/contract with a stub `ssh` fixture; live host used only for documented manual verification. | [R7](./research.md#r7-test-strategy) |
| D8 | `unix://` stays first-class and behaviourally unchanged; previously-"working" invalid values now fail loudly (intentional, release-noted). | [R8](./research.md#r8-backwards-compatibility) |
| D9 | `POST /api/docker/action` **loses its caller-supplied `dockerUrl` body field** and resolves server-side from `widgetInstanceId`. Justified on #189 grounds alone: FR-016 requires every caller-supplied endpoint to be validated, and removing the field is cheaper and safer than validating it. It also fixes a live bug — `DockerWidget.tsx:221` hard-codes `unix:///var/run/docker.sock` for actions on connection-linked widgets, so start/stop currently targets the **local** daemon regardless of which host is displayed. No `connectionId` is needed: one widget resolves to one connection. | [R9](./research.md#r9-action-route-endpoint-resolution) |
| D10 | `resolveDockerUrl()` becomes the single resolution path for listing **and** actions, and is fixed to filter on `connectionType = 'docker'` (it currently filters on `widgetInstanceId` alone and takes an arbitrary `.get()`). Correct on its own terms today and a prerequisite for #190. | [R6](./research.md#r6-authorization-redesign--ssrf-boundary), [R10](./research.md#r10-deferred-to-190--multi-host) |
| D11 | Legacy `config.dockerUrl` widgets are adopted into real connections by an idempotent startup reconciliation. Re-justified on **FR-022/FR-023/SC-006**: a widget whose config carries `unix:///var/run/docker.sock` *is* an existing local-socket deployment, and #189 removes the `url` parameter it depends on — without adoption it would break, violating "no configuration change". Values failing the new grammar are left alone and reported. | [R8](./research.md#r8-backwards-compatibility), [R5](./research.md#r5-storage-schema-change-vs-validation-only) |
| D12 | **Multi-host deferred to [#190](https://github.com/streetratz/HomeDash/issues/190)** (CH-05). No schema change, no widget redesign, no fan-out in this feature. The prerequisite #190 needs — server-side resolution by connection identity — is delivered by D6/D9/D10. | [R10](./research.md#r10-deferred-to-190--multi-host) |

## Implementation Phases

Phase boundaries for `/speckit.tasks`; each gets a log file (see below).

| Phase | Scope | Exit criterion |
| --- | --- | --- |
| 01 | Endpoint grammar: `DockerEndpointSchema`, `isAllowedDockerEndpoint()`, parser rewrite (removing the silent socket fallthrough), read-time re-validation, failure classification | Unit tests green; FR-001..FR-011 covered |
| 02 | Version negotiation + `testDockerConnection` upgrade | Unit tests green; FR-026..FR-029 covered |
| 03 | SSH transport module + image `openssh-client` + env/dataDir/docs | Unit tests green against stub `ssh`; FR-030..FR-038 covered |
| 04 | Authorization: `requireAuth` on listing, `url` removed, `dockerUrl` removed from the action body, `resolveDockerUrl()` fixed and shared, ping route deleted, legacy `config.dockerUrl` adoption, OpenAPI paths declared | Integration + contract tests green; FR-012..FR-019, FR-022..FR-025 covered |
| 05 | Frontend: `useDocker.ts` on `apiClient` with `widgetInstanceId` only, action call sites corrected, classified errors surfaced, settings-form endpoint guidance, user-facing docs | FR-020, FR-021 covered; SC-003, SC-005 verified |
| 06 | Manual live verification against the SSH host | SC-008, SC-010, SC-011 verified manually per quickstart |

## Test & Error Logging

Per constitution §V, `specs/043-docker-remote-auth/logs/` is **created at the start of
implementation, not during planning**:

- `logs/readme.md` — created as the **first task of Phase 01**, before any build/test
  command is run, with the index of phase log files.
- `logs/NN-phase-<slug>.md` — one per phase in the table above, created at the start of
  that phase, each with a table of contents, a back-link to `readme.md`, and Overview /
  Commands Run / Errors & Fixes / Phase Checkpoint sections. For this plan that is
  exactly six files: `01-phase-endpoint-grammar.md`, `02-phase-version-negotiation.md`,
  `03-phase-ssh-transport.md`, `04-phase-authorization.md`, `05-phase-frontend.md`,
  `06-phase-live-verification.md`.
- `logs/NN-phase-<slug>/<tool>-run-<N>.log` — raw captured output for each command run,
  in the sidecar folder matching its phase file.

All of it is committed.

## Risks & Open Questions

| # | Risk / question | Impact | Mitigation |
| --- | --- | --- | --- |
| RK-1 | Spawning one `ssh` process per HTTP request may be costly on short widget poll intervals. | Perf | Measure in Phase 03. Version-negotiation caching already removes the extra probe. Connection reuse/pooling is deliberately deferred — add only if measurement justifies it. |
| RK-2 | `docker system dial-stdio` requires the remote user to have Docker access. | UX | Classified as a distinct FR-036 failure ("remote docker unavailable / permission denied") with actionable text, not a generic connection error. |
| RK-3 | An unseeded `known_hosts` makes every `ssh://` endpoint fail on first use. | UX | Intentional fail-closed design. `quickstart.md` documents seeding via `ssh-keyscan`, and the error message says exactly that. |
| RK-4 | Deleting `POST /api/docker/ping` is a breaking API change. | Compat | Internal-only route; the sole frontend caller is retargeted in the same PR. Release-noted. |
| RK-5 | Existing installs with non-conforming `docker_url` values start erroring. | Compat | Intentional (FR-008) — those endpoints were silently resolving to the local socket, which is the #181 bug. Error names the accepted forms. Release-noted. |
| RK-6 | Loopback is allowed by the Docker validator but denied by the art validator in the same file. | Security review confusion | Divergence is documented inline in `url-validator.ts` and in [R6](./research.md#r6-authorization-redesign--ssrf-boundary) with the host-networking rationale. |
| RK-7 | Startup adoption of legacy `config.dockerUrl` widgets rewrites persisted widget config. | Data safety | Idempotent, logged one line per widget, and skips any value that fails the new endpoint grammar (leaving the operator a visible #181 misconfiguration rather than importing a broken host). Covered by an integration test over a seeded legacy config. |
| RK-8 | Container actions currently target the local socket for connection-linked widgets (`DockerWidget.tsx:221`), so fixing it changes behaviour admins may have unknowingly relied on. | Correctness / UX | The current behaviour is a defect, not a feature — it acts on the wrong daemon. Release-noted, and covered by an integration test asserting the action reaches the resolved endpoint. |
| OQ-1 | Exact `PREFERRED` API version constant for clamping. | Low | Settle in Phase 02 against the oldest daemon we intend to support; must be ≤ the field set HomeDash actually parses (stable since v1.24). |
| OQ-2 | Whether `ssh://` endpoints should also accept a per-connection key path rather than one global key. | **Low** — reverted from Medium | The Medium rating existed only because multi-host made several hosts with distinct credentials plausible. With #190 deferred, a widget has one host and a single global key satisfies FR-031/FR-033 at this scale. `SshTransportConfig` still carries the shape for a per-connection override, so #190 can raise it again without a transport change. |
| OQ-3 | Container images run as root (pre-existing). | Security | Out of scope here; recommend a dedicated follow-up issue (see Complexity Tracking). |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Container images run as **root** (no `USER` directive in `Dockerfile` or `deploy/Dockerfile`), contrary to the constitution's deployment note | **Pre-existing**; not introduced by this feature. Correcting it requires solving docker-socket group membership, `HOMEDASH_DATA_DIR` ownership on already-deployed volumes, and the Synology host-networking path — a migration-bearing change of its own. | Adding `USER node` inside this PR would silently break existing installs' data-volume writes and local-socket access, coupling an unrelated deployment migration to a security fix. Deferred to a dedicated issue. This feature adds no new privileges, no new listening ports, and enforces owner-only key permissions regardless of uid. Rollback path: the deviation is status-quo, so there is nothing to roll back. |
| New OS package (`openssh-client`) in both production images | Required by FR-035 — `ssh://` endpoints cannot work without an SSH client in the image. | A pure-JS SSH implementation (`ssh2`) was rejected in [R1](./research.md#r1-ssh-transport-mechanism): it adds a heavyweight dependency and forces us to reimplement host-key verification, which is the security-critical part. Rollback path: remove the package line; `ssh://` endpoints then fail with the existing FR-035 "SSH client not available" error and all other endpoint forms are unaffected. |
