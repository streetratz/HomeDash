# Phase 0 Research — Docker Remote Endpoints & Authorization

**Feature**: `043-docker-remote-auth` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All findings below were verified empirically against the HomeDash source tree and a live
Docker Engine 29.1.3 host (`docker-host`, ApiVersion 1.52 / MinAPIVersion 1.44)
during planning. No NEEDS CLARIFICATION items remain.

---

## Table of Contents

- [R1. SSH transport mechanism](#r1-ssh-transport-mechanism)
- [R2. SSH credential + host-key management](#r2-ssh-credential--host-key-management)
- [R3. Container image changes](#r3-container-image-changes)
- [R4. Docker API version negotiation](#r4-docker-api-version-negotiation)
- [R5. Storage: schema change vs validation-only](#r5-storage-schema-change-vs-validation-only)
- [R6. Authorization redesign & SSRF boundary](#r6-authorization-redesign--ssrf-boundary)
- [R7. Test strategy](#r7-test-strategy)
- [R8. Backwards compatibility](#r8-backwards-compatibility)
- [R9. Action-route endpoint resolution](#r9-action-route-endpoint-resolution)
- [R10. Deferred to #190 — multi-host](#r10-deferred-to-190--multi-host)

---

## R1. SSH transport mechanism

**Decision** — Implement `ssh://` endpoints by spawning the system `ssh` client running
`docker system dial-stdio` on the remote host, wrapping the child process's
stdin/stdout into a Node `Duplex`, and handing that duplex to `http.request()` via a
custom `createConnection`. One spawn per HTTP request; no connection pooling in v1.

**Verification** — Confirmed working end-to-end during planning:

```
printf 'GET /_ping HTTP/1.1\r\nHost: docker\r\nConnection: close\r\n\r\n' \
  | ssh -T docker-host 'docker system dial-stdio'
→ HTTP/1.1 200 OK / Api-Version: 1.52 / Server: Docker/29.1.3 (linux)
```

`GET /containers/json?all=true` over the same transport also returned `200 OK`.

**Rationale**

- This is exactly what the Docker CLI itself does for `DOCKER_HOST=ssh://…`, so the
  remote-side contract is stable and well-supported.
- **Zero new npm dependencies.** The constitution requires deliberate, pinned
  dependencies; `node:child_process` + `node:http` + `node:stream` are already in use.
- Host-key verification, key parsing, agent handling, `~/.ssh/config`, and cipher
  negotiation are delegated to OpenSSH — a far better-audited implementation than
  anything we would assemble, and it satisfies FR-032 without custom crypto code.
- Process lifetime is trivially bounded: the dial dies with the request (FR-037,
  SC-011).

**Alternatives considered**

| Option | Why rejected |
| --- | --- |
| `ssh2` npm library | Heavy new dependency with a native-adjacent crypto surface. We would have to reimplement `known_hosts` parsing/verification, key-format handling and `ssh_config` semantics ourselves — more code, more risk, for no functional gain. |
| Backend-managed `ssh -L` local port forward | Materialises an **unauthenticated Docker API on a local TCP port of the HomeDash host** for the forward's lifetime. Under the constitution's host-networking Synology deployment (§III) that port is reachable from the LAN — a strictly worse security posture than the defect we are fixing. Also requires forward lifecycle/orphan management and port allocation. |
| `ssh <host> "curl --unix-socket /var/run/docker.sock …"` | Requires `curl` on every remote host; loses HTTP framing; awkward for streaming and for non-200 status handling. |
| Require the operator to expose `tcp://`/`https://` instead | Does not satisfy FR-030; the motivating environment (#181) has 2375/2376 closed by design, which is the correct hardening posture. |

**Design notes for implementation**

- `ssh` argv (FR-031, FR-032, FR-034): `-T`, `-o BatchMode=yes`, `-a` (no agent
  forwarding), `-x` (no X11), `-o ClearAllForwardings=yes`, `-o ConnectTimeout=<n>`,
  `-o StrictHostKeyChecking=yes`, `-o UserKnownHostsFile=<path>`, `-o IdentitiesOnly=yes`,
  `-i <key>`, `-o LogLevel=ERROR`, then `<user>@<host>` `-p <port>` and the remote
  command.
- Failure classification (FR-036) keys off the child exit code plus stderr patterns:
  host unreachable / authentication rejected / host-key verification failed / remote
  `docker` unavailable. Each maps to a distinct actionable message; none echoes key
  material.
- Missing `ssh` binary surfaces as `ENOENT` on spawn → distinct "SSH client not
  available in this image" configuration error (FR-035).
- A single overall deadline arms a timer that `SIGKILL`s the child and destroys the
  duplex; cleanup runs in a `finally` so it fires on success, error and timeout alike.
- Observed quirk worth guarding: with `Connection: close` the daemon may emit a
  trailing `{"message":"context canceled"}` after the response on some routes. The
  client must frame responses by `Content-Length`/chunked encoding (which Node's
  HTTP parser does) and must not treat trailing bytes as body.

---

## R2. SSH credential + host-key management

**Decision** — HomeDash **references** operator-provided credentials; it never accepts,
stores, or returns private key material (FR-033). Three new environment variables, read
only through `backend/src/config/env.ts`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOMEDASH_SSH_KEY_PATH` | `${HOMEDASH_DATA_DIR}/ssh/id_ed25519` | Private key used for `ssh://` endpoints. |
| `HOMEDASH_SSH_KNOWN_HOSTS_PATH` | `${HOMEDASH_DATA_DIR}/ssh/known_hosts` | Host-key trust store for `StrictHostKeyChecking=yes`. |
| `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING` | `true` | Documented, explicit opt-out only. |

`ssh` is added to `REQUIRED_SUBDIRS` in `backend/src/config/dataDir.ts`, created `0700`.

**Rationale**

- Keeping key material outside the database means a database backup/export can never
  leak it, and there is no API path that could ever read it back.
- Anchoring the default under `HOMEDASH_DATA_DIR` means the existing single-volume
  Docker deployment story keeps working: operators drop the key into the volume they
  already mount. No new mount is required, though a read-only mount of an external key
  is equally supported by overriding the variable.
- Defaulting `StrictHostKeyChecking` to `yes` with a **pre-seeded** `known_hosts` is a
  fail-closed posture: an empty/missing `known_hosts` makes the first connection fail
  loudly rather than silently trusting whatever answered (no TOFU).
- A startup/edge preflight rejects a key whose mode is group- or world-accessible
  (`mode & 0o077 !== 0`) with a clear remediation message — OpenSSH would refuse
  anyway, but with a far less discoverable error.

**Alternatives considered**

- *Store the key in SQLite (encrypted or not)*: rejected — violates FR-033, creates a
  key-at-rest problem HomeDash has no KMS for, and widens backup blast radius.
- *Accept key upload through the admin UI*: rejected for the same reasons, plus it
  puts private key bytes through the HTTP layer and log pipeline.
- *Rely on the container's `~/.ssh` and ambient `ssh_config`*: rejected — implicit,
  undocumented, and unreproducible across the two Dockerfiles.

**Logging** — key path may be logged; key contents and `known_hosts` contents never
are. `ssh` stderr is captured for classification and is truncated + emitted at `warn`
without echoing argv values that contain paths to secrets.

**Docs obligation** — all three variables must be documented in
`docs/getting-started.md` in the same PR (backend/AGENTS.md). Note that
`docs/getting-started.md:84` currently states integrations need no environment
variables; that sentence must be qualified, since SSH-based Docker endpoints are the
first integration that does.

---

## R3. Container image changes

**Decision** — Add an OpenSSH client to the **production stage** of both images
(FR-035):

- `Dockerfile` (Alpine, `node:22-alpine`): `apk add --no-cache openssh-client`
- `deploy/Dockerfile` (Debian, `node:22-slim`): `apt-get install -y
  --no-install-recommends openssh-client` followed by `rm -rf /var/lib/apt/lists/*`

**Non-root finding (pre-existing constitution deviation)** — Neither `Dockerfile` nor
`deploy/Dockerfile` contains a `USER` directive; **both images run as root today.** The
constitution's deployment notes require a non-root user unless documented and reviewed.

This deviation is **pre-existing and not introduced by this feature**, and fixing it is
entangled with (a) group membership for `/var/run/docker.sock` access, (b) ownership of
the `HOMEDASH_DATA_DIR` volume on existing installs, and (c) the Synology host-networking
deployment. Per root AGENTS.md rule 8 (stay in scope) it is **not** fixed here; it is
recorded in the plan's Complexity Tracking with a recommendation to raise a separate
issue. This feature does not worsen it: no new listening ports, no new privileges, and
the SSH key preflight enforces owner-only permissions regardless of which uid runs.

---

## R4. Docker API version negotiation

**Decision** — Replace the hardcoded `/v1.43/` prefix with **clamped negotiation,
cached per endpoint**:

1. Probe unversioned `GET /version` → `{ ApiVersion, MinAPIVersion }`.
2. `effective = clamp(PREFERRED, MinAPIVersion, ApiVersion)` where `PREFERRED` is the
   version HomeDash's response parsing is written against.
3. Issue all subsequent calls as `/v{effective}/…`.
4. Cache `{ effective, probedAt }` keyed by normalised endpoint, TTL ~10 minutes.
5. On a `400` whose body indicates a client-version mismatch, invalidate the cache and
   re-probe exactly once; a second failure returns the FR-029 error naming the
   daemon's supported range.

**Verification** — against Engine 29.1.3 (Api 1.52 / Min 1.44):
`/v1.43/containers/json` → `400 client version 1.43 is too old`;
`/v1.44/containers/json` → `200`; unversioned `/containers/json` → `200`;
`/_ping` → `200` (which is precisely why the current connection test passes while the
widget fails). `clamp(1.43, 1.44, 1.52) = 1.44` → verified `200`.

**Rationale**

- Clamping keeps the response **shape** deterministic: HomeDash always requests the
  oldest version it understands that the daemon still accepts, so field semantics do
  not drift host-to-host.
- `/version` is itself unversioned, so the probe always succeeds regardless of skew —
  it is the only safe bootstrap call.
- Caching keeps the extra round-trip off the widget's polling path (FR-027).

**Alternatives considered**

- *Send every request unversioned*: simplest, and verified to work — but the daemon
  then serves its **newest** API version, so a HomeDash install silently receives
  different response shapes from a 1.41 host and a 1.52 host. Rejected for
  predictability, though unversioned remains the fallback if `/version` is unreachable.
- *Bump the hardcoded version to 1.44*: pure deferral; breaks again the moment a
  daemon raises `MinAPIVersion` past it, which is exactly how #181 happened.
- *Negotiate from the `Api-Version` response header on `/_ping`*: the header gives the
  daemon's current version but **not** `MinAPIVersion`, so it cannot produce FR-029's
  "supported range" message.

**Coupled fix (FR-028, SC-009)** — `testDockerConnection` in
`backend/src/services/connectionService.ts:367` currently only calls `pingDocker()`.
It must be changed to perform a negotiated, versioned container listing (e.g.
`/v{effective}/containers/json?limit=1`), otherwise "Test Connection" keeps reporting
success against a daemon the widget cannot actually read.

---

## R5. Storage: schema change vs validation-only

**Decision** — **No database migration.** This is validation-and-parsing only.

**Rationale** — `backend/src/db/schema/index.ts:825` defines
`dockerConnections.dockerUrl` as `text('docker_url').notNull()`. An arbitrary-length
opaque string already accommodates all four endpoint forms
(`unix://`, `tcp://`, `https://`, `ssh://`). The defect is that
`backend/src/lib/validation.ts` (~L351/L360) types it as
`z.string().min(1).max(2048)` with **no format validation**, and that
`parseDockerUrl()` silently treats anything unrecognised as a socket path.

The change is therefore:

- a shared `DockerEndpointSchema` (closed set, FR-001..FR-006) used by the create and
  update schemas;
- re-validation at *read* time so a legacy non-conforming stored value fails closed
  with an actionable error rather than silently resolving to the local socket (FR-008);
- no column, index, or table change → nothing for `drizzle-kit` to generate.

**Re-verified after the #190 scope reduction**, requirement by requirement, that nothing
in the remaining FR-001..FR-038 set needs DDL:

| Requirement group | Storage need | DDL? |
| --- | --- | --- |
| FR-001..FR-008 endpoint grammar | Validation over the existing `docker_url TEXT NOT NULL` | No |
| FR-009..FR-011 no silent fallback | Control flow only | No |
| FR-012..FR-019 authorization | Route guards + resolution from existing `widget_connections` rows | No |
| FR-020/FR-021 guidance & docs | None | No |
| FR-022/FR-023 compatibility | Legacy `config.dockerUrl` adoption writes **rows** into existing `docker_connections` / `widget_connections` and rewrites an existing `config_json` value — no new column, and one Docker link per widget, so the existing unique index is satisfied | No |
| FR-024/FR-025 testing | None | No |
| FR-026..FR-029 version negotiation | Per-endpoint cache is in-memory, intentionally not persisted (it must not survive a daemon upgrade) | No |
| FR-030..FR-038 SSH transport | Key and `known_hosts` are **filesystem paths from env vars**, never database rows ([R2](#r2-ssh-credential--host-key-management)); per-connection key storage is explicitly deferred | No |

The only migration this feature ever contemplated belonged to multi-host
(`widget_conn_pk` relaxation + `sort_order`) and left with it to #190
([R10](#r10-deferred-to-190--multi-host)). **This feature is migration-free**, which is
the outcome backend/AGENTS.md prefers.

Should a migration become necessary during implementation it MUST be produced by
`pnpm --filter backend db:generate` and never hand-written (backend/AGENTS.md).

---

## R6. Authorization redesign & SSRF boundary

**Key discovery** — a correct, admin-guarded Docker administration surface **already
exists** in `backend/src/api/connections.ts`: `GET/POST/PUT/DELETE
/api/admin/connections/docker`, plus `POST /api/admin/connections/docker/test` and
`POST /api/admin/connections/docker/:id/test`. Every one calls `requireAdmin` and (for
mutations) `assertCsrf`. The frontend already consumes these via
`frontend/src/hooks/useConnections.ts`.

**Decision**

| Route | Change |
| --- | --- |
| `GET /api/docker/containers` | Add `preHandler: [requireAuth]`. **Remove** the caller-supplied `url` parameter entirely; accept only `widgetInstanceId` and resolve the endpoint server-side via `resolveDockerUrl()` (FR-012, FR-014). |
| `resolveDockerUrl()` (`docker.ts:25-40`) | Becomes the single resolution path for **both** listing and actions, and is fixed to filter on `connectionType = 'docker'`. The current query filters on `widgetInstanceId` alone and takes `.get()` — an arbitrary first row. Unobservable today (one link per widget per type), but wrong as written, and a trap for [#190](#r10-deferred-to-190--multi-host). |
| `POST /api/docker/ping` | **Delete.** It is an unauthenticated duplicate of the already-correct `POST /api/admin/connections/docker/test`. Removing the surface is strictly better than guarding it (FR-013, FR-015). `frontend/src/hooks/useDocker.ts` `useDockerPing` is retargeted to the admin route. |
| `POST /api/docker/action` | Keep `requireAdmin` + `assertCsrf` (FR-017). Its caller-supplied `dockerUrl` body field is **removed** in favour of server-side resolution from `widgetInstanceId` — see [R9](#r9-action-route-endpoint-resolution). |
| `POST /api/admin/connections/docker[/:id]/test` | Already correctly guarded; becomes the single admin "Test Connection" path, and is upgraded per R4 to exercise container listing. |

**Rationale** — deleting `/api/docker/ping` removes an entire class of future
regression rather than adding a guard that a later refactor could drop. Server-side
resolution means the *only* endpoints HomeDash will ever dial on a non-admin request
are ones an admin already persisted, which collapses the SSRF surface for
authenticated-but-unprivileged users to zero.

**SSRF boundary (FR-016)** — add `isAllowedDockerEndpoint()` as a **new sibling export
in `backend/src/lib/url-validator.ts`**, alongside the existing art helpers.

> **Deliberate policy divergence — do not "fix" this.** The existing
> `isAllowedArtUrl()` blocklist denies `127.0.0.0/8` and `::1`, which is correct for
> outbound album-art fetches. It is **wrong** for Docker: under the constitution's
> host-networking Synology deployment, a loopback Docker endpoint
> (`tcp://127.0.0.1:2375`, or an operator's local SSH forward) is the *normal* local
> case. The Docker validator therefore has its own policy and must not be collapsed
> into the art policy.

Docker endpoint policy:

- `unix://` — no network egress at all; accept any absolute path (path traversal is
  irrelevant: the process either can open the socket or cannot).
- `tcp://` / `https://` — resolve the host, then apply per-address checks: **allow**
  loopback and RFC1918/LAN ranges (the whole point of the feature); **deny**
  `169.254.0.0/16` and `fe80::/10` (cloud/link-local metadata), `0.0.0.0` / `::`, and
  any non-IP-resolvable host.
- `ssh://` — no direct socket dial by HomeDash; the host is handed to `ssh`. Validate
  the user/host/port grammar and reject shell-metacharacter-bearing values so nothing
  can be smuggled into argv.

**Threat-model note** (required by backend/AGENTS.md for auth/networking changes):

- **What is exposed**: container inventory (names, images, state, published ports) and
  HomeDash's ability to make outbound connections / execute `ssh` to a configured host.
- **Who can reach it today**: *any device on the LAN, unauthenticated* — `GET
  /api/docker/containers` and `POST /api/docker/ping` have no `preHandler` and accept a
  caller-supplied `url`. That is issue #189: container enumeration plus an
  unauthenticated outbound-request primitive (SSRF) from the HomeDash host.
- **Who can reach it after this change**: container listing requires an authenticated
  session and resolves only admin-persisted endpoints; every caller-supplied endpoint
  and all SSH configuration requires admin + CSRF.
- **How it is mitigated**: default-deny `preHandler`s; removal (not merely guarding) of
  the redundant ping route; server-side endpoint resolution; a closed-set endpoint
  grammar; `isAllowedDockerEndpoint()` as the SSRF boundary; bounded timeouts on every
  transport; hardened `ssh` invocation (`BatchMode`, no agent forwarding, no port
  forwarding, no tty, `StrictHostKeyChecking=yes`); key referenced rather than stored,
  owner-only permissions enforced, never logged or returned by any API.
- **Uniform rejection** (FR-019, SC-002): authorization failures return a constant
  shape and are emitted **before** endpoint resolution or any outbound call, so
  response content and timing cannot be used to probe which endpoints exist.
- **Residual risk**: an admin can still point HomeDash at any host they can reach —
  inherent to the feature and gated on the highest privilege HomeDash has. Container
  images run as root (pre-existing, R3). Host-key trust depends on the operator seeding
  `known_hosts`; the fail-closed default makes that omission loud rather than silent.

---

## R7. Test strategy

There is **no CI on pull requests** in this repository, and the live SSH host
(`docker-host`) is a developer-local resource. **No automated test may depend on
it.** The SSH transport is tested against a stub `ssh` executable (a fixture script on
a test-controlled `PATH`/command override) that replays canned Docker HTTP responses and
canned failure modes.

| Layer | File | Covers |
| --- | --- | --- |
| unit | `backend/tests/unit/dockerEndpoint.test.ts` | Endpoint grammar, defaults, rejection of `http://`, bare `host:port`, empty — FR-001..FR-008, SC-004 |
| unit | `backend/tests/unit/dockerApiVersion.test.ts` | Clamp arithmetic, cache TTL/invalidation, mismatch error text — FR-026, FR-027, FR-029 |
| unit | `backend/tests/unit/url-validator.test.ts` (extend) | Docker policy incl. the deliberate loopback-allowed divergence — FR-016 |
| unit | `backend/tests/unit/dockerSshTransport.test.ts` | `ssh` argv construction, failure classification, timeout + child cleanup against the stub — FR-031..FR-037, SC-011 |
| integration | `backend/tests/integration/dockerAuth.test.ts` | Negative matrix: unauthenticated, authenticated non-admin, missing CSRF, caller-supplied URL rejected, uniform rejection shape — FR-024, SC-001, SC-002, SC-005 |
| integration | `backend/tests/integration/dockerContainers.test.ts` | Server-side resolution; 502-unreachable vs 4xx-misconfigured distinction; no silent local fallback — FR-009..FR-011, SC-006 |
| contract | `backend/tests/contract/openapi.test.ts` (extend) | Docker paths present with declared auth; `/api/docker/ping` absent — FR-025 |
| frontend | `frontend/src/hooks/useDocker.test.ts` | Uses `apiClient` (not bare `fetch`), retargeted ping |
| frontend E2E | Playwright | Endpoint-format validation messaging in the connection form — SC-003 |

`specs/001-homelab-dashboard/contracts/openapi.yaml` currently declares **no** Docker
paths; they must be added (with security requirements) so the contract test is
meaningful, and `pnpm --filter backend openapi:lint` must stay clean relative to `main`.

**Manual/dev verification only** (SC-008, SC-010, SC-011), documented in
[quickstart.md](./quickstart.md): `ssh://` against the live host, and
`tcp://127.0.0.1:23750` materialised by
`ssh -nNT -L 23750:/var/run/docker.sock docker-host`.

---

## R8. Backwards compatibility

**Decision** — `unix:///var/run/docker.sock` remains a first-class endpoint form, is the
documented default, and its code path is behaviourally unchanged (FR-022). Stored
connections already in a conforming form continue to work with no operator action and
no data edit (FR-023).

The one intentional break: stored values that were never valid but *happened* to work
via the silent socket fallthrough (e.g. bare `host:2375`, or `http://host:2375`) now
fail closed with an actionable message naming the accepted forms (FR-008). Those
endpoints were not actually functioning as the operator intended — they were resolving
to the local socket — so failing loudly is the correct remedy for #181 rather than a
regression. It must be called out in release notes.

---

## R9. Action-route endpoint resolution

**Decision** — `POST /api/docker/action` drops its caller-supplied `dockerUrl` body
field and resolves the endpoint **server-side** from `widgetInstanceId`, through the same
`resolveDockerUrl()` used by container listing.

**Justification is purely #189.** `ContainerActionSchema`
(`backend/src/api/docker.ts:18-22`) accepts `dockerUrl: z.string().min(1)` from the
request body. The route is correctly guarded by `requireAdmin` + `assertCsrf`, so this is
not an unauthenticated hole — but it is still an arbitrary caller-supplied destination
reaching `parseDockerUrl()`, and FR-016 requires **every** caller-supplied endpoint to be
validated, not merely the unauthenticated ones. Leaving one admin-reachable
endpoint-from-body field while removing the other two would also leave the exact shape of
the #189 defect in the codebase for a future refactor to copy. Removing the field is
cheaper than validating it, and it costs no capability: administrators configure
endpoints in connection settings, never per action.

**A live defect this also fixes.** `frontend/src/components/widgets/DockerWidget.tsx:221`
passes `dockerUrl={explicitUrl || 'unix:///var/run/docker.sock'}` into
`useDockerAction()`. So for a widget linked to a **connection** (the `resolveMode ===
'widgetInstanceId'` path, where `explicitUrl` is empty), start/stop/restart is dispatched
to the **local** socket regardless of which host the widget is actually displaying. On a
Synology box that mounts the host socket, an admin clicking "stop" on a remote
container's row stops (or fails against) a same-named *local* container. This was found
while re-verifying the action path and is not covered by an existing test. Server-side
resolution removes the class of bug entirely — the action necessarily targets the host
whose containers were listed.

**No `connectionId` parameter is needed.** One widget resolves to exactly one Docker
connection in this feature, so `widgetInstanceId` is a sufficient and unambiguous key.
The body becomes `{ widgetInstanceId, containerId, action }`. If #190 later introduces
multiple hosts per widget it can add a `connectionId` discriminator without changing the
resolution model, because the endpoint is already never supplied by the caller.

**Alternatives considered.**

- *Keep `dockerUrl` but run it through `isAllowedDockerEndpoint()`.* Satisfies FR-016
  literally, but preserves an admin-only SSRF primitive for no user-visible benefit and
  leaves the `DockerWidget.tsx:221` bug intact. Rejected.
- *Accept either `dockerUrl` or `widgetInstanceId`.* Two code paths, one of which is the
  insecure one, is how the defect survives. Rejected.

---

## R10. Deferred to #190 — multi-host

Displaying more than one Docker host in a single widget is **out of scope**, deferred to
[#190](https://github.com/streetratz/HomeDash/issues/190) (spec changelog CH-05). The
requirements that drove it (formerly FR-039..FR-046, SC-012..SC-014) have been removed
from `spec.md`.

Three analyses produced during planning were moved to that issue rather than deleted,
because they are the expensive part of the work and remain valid:

1. **Schema**: `widget_connections` enforces `uniqueIndex('widget_conn_pk')` on
   `(widget_instance_id, connection_type)` at `backend/src/db/schema/index.ts:834`, which
   is what blocks multiple Docker links. The relaxation to
   `(widget_instance_id, connection_type, connection_id)` plus a `sort_order` column was
   assessed as behaviour-neutral for the `pihole` and `unifi` types that share the table,
   because both enforce single-link in service code (`linkWidgetConnection()` deletes by
   `(widget, type)` before inserting) rather than relying on the index.
2. **UI**: grouped sections with a sticky per-host header were preferred over a tab strip
   on vertical cost in a resizable tile, overflow behaviour at 5+ hosts, long-name
   truncation, and not hiding one host's failures behind another host's tab.
3. **Polling**: client-side fan-out (one request per host) was preferred over server-side
   `Promise.allSettled` aggregation, because aggregation still gates the response on the
   slowest host.

**What this feature must not break for #190.** The prerequisite is that the Docker
endpoint is resolved server-side from connection identity rather than supplied by the
caller — which is exactly what [R6](#r6-authorization-redesign--ssrf-boundary) and
[R9](#r9-action-route-endpoint-resolution) deliver. In addition, the `connectionType`
filter fix described in R6 is retained here even though it is unobservable today: with
the unique index still in place a widget can only hold one link per type, but
`resolveDockerUrl()` filtering on `widgetInstanceId` alone with an arbitrary `.get()`
(`backend/src/api/docker.ts:25-40`) becomes a live correctness hazard the moment #190
relaxes that index. Fixing it now is correct on its own terms and removes a trap from the
deferred work.
