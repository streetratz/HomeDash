# Phase 1 Data Model — Docker Remote Endpoints & Authorization

**Feature**: `043-docker-remote-auth` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

**No database migration is required.** Verified requirement-by-requirement across
FR-001..FR-038 in
[research.md R5](./research.md#r5-storage-schema-change-vs-validation-only). The model
below describes the **existing** persisted entities plus the new in-memory value objects
that carry validation and negotiation state.

Multi-host Docker widgets — and the `widget_connections` index change they would have
needed — are deferred to
[#190](https://github.com/streetratz/HomeDash/issues/190) (spec changelog CH-05). One
widget resolves to one Docker connection throughout.

---

## Table of Contents

- [Persisted entities](#persisted-entities)
- [Value objects (new, in-memory)](#value-objects-new-in-memory)
- [Validation rules](#validation-rules)
- [State & lifecycle](#state--lifecycle)
- [Entity relationships](#entity-relationships)
- [Widget configuration (frontend)](#widget-configuration-frontend)

---

## Persisted entities

### `docker_connections`

Defined at `backend/src/db/schema/index.ts:825`. **No column, index, or constraint
change.**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text (pk) | Existing |
| `name` | text | Display name shown in settings |
| `dockerUrl` → `docker_url` | text NOT NULL | Now constrained by `DockerEndpointSchema` on write **and** re-validated on read (FR-008). Column type unchanged — the four endpoint forms are all opaque strings. |
| *(remaining existing columns)* | — | Untouched |

**Why no migration**: the defect was never a storage-shape problem. `docker_url` already
accepts any endpoint string; the bug was that nothing validated it and the parser
silently reinterpreted unrecognised values as a filesystem socket path.

### `widget_connections` — unchanged

Defined at `backend/src/db/schema/index.ts:834`, shared by the `pihole`, `docker` and
`unifi` connection types. `uniqueIndex('widget_conn_pk')` on
`(widget_instance_id, connection_type)` stays exactly as it is: it permits one Docker
link per widget, which is all this feature needs. Relaxing it is #190's problem.

### Widget instance → connection link

`resolveDockerUrl(widgetInstanceId)` (`backend/src/api/docker.ts:25`) resolves a widget
instance to its `dockerConnections.dockerUrl`. Two changes, no schema impact:

1. It becomes the **only** way any request — unauthenticated, authenticated, or admin —
   selects a Docker endpoint (FR-012, FR-014), including for container actions, which
   today take an endpoint from the request body.
2. It is fixed to filter on `connectionType = 'docker'`. The current query filters on
   `widgetInstanceId` alone and takes `.get()` (an arbitrary first row). Unobservable
   while the unique index holds, but wrong as written, and a trap for #190.

```text
resolveDockerUrl(widgetInstanceId)
  SELECT connection_id FROM widget_connections
   WHERE widget_instance_id = ? AND connection_type = 'docker'
  → docker_connections.docker_url → DockerEndpoint
```

---

## Value objects (new, in-memory)

### `DockerEndpoint` (discriminated union)

The parsed, validated result of `DockerEndpointSchema`. Replaces the current
`parseDockerUrl()` return shape, whose fallthrough branch is the root cause of #181.

| Variant | Discriminant | Fields | Transport |
| --- | --- | --- | --- |
| Unix socket | `kind: 'unix'` | `socketPath: string` | `http` + `options.socketPath` |
| Plain TCP | `kind: 'tcp'` | `host: string`, `port: number` (default `2375`) | `http` + `hostname`/`port` |
| TLS | `kind: 'https'` | `host: string`, `port: number` (default `2376`) | `https` + `hostname`/`port` |
| SSH | `kind: 'ssh'` | `user?: string`, `host: string`, `port: number` (default `22`) | `http` over `ssh … docker system dial-stdio` duplex |

There is **no default/fallback variant**. An input that matches no variant is a
validation error, never a silently-coerced socket path.

### `DockerApiVersion`

| Field | Type | Notes |
| --- | --- | --- |
| `apiVersion` | string | Daemon's current API version, from `/version` |
| `minApiVersion` | string | Daemon's minimum accepted version, from `/version` |
| `effective` | string | `clamp(PREFERRED, minApiVersion, apiVersion)` — the prefix used for all subsequent requests |
| `probedAt` | number (epoch ms) | Cache timestamp |

Cached in a `Map<endpointKey, DockerApiVersion>` where `endpointKey` is the normalised
endpoint string. TTL ≈ 10 minutes. Invalidated on a client-version `400`.

### `SshTransportConfig`

Derived from environment, never persisted, never serialised to an API response.

| Field | Source | Notes |
| --- | --- | --- |
| `keyPath` | `HOMEDASH_SSH_KEY_PATH` (default `${HOMEDASH_DATA_DIR}/ssh/id_ed25519`) | Path only. Key **contents** are never read into HomeDash memory — `ssh` opens the file. |
| `knownHostsPath` | `HOMEDASH_SSH_KNOWN_HOSTS_PATH` (default `${HOMEDASH_DATA_DIR}/ssh/known_hosts`) | |
| `strictHostKeyChecking` | `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING` (default `true`) | Explicit, documented opt-out only |
| `connectTimeoutMs` | Existing transport timeout (10 s baseline) | Bounds the whole dial |

### `DockerEndpointError` (classified failure)

Every failure maps to exactly one category so the UI can render actionable text
(FR-010, FR-011, FR-029, FR-036). Uses the existing `AppError`/`ErrorCode` machinery in
`backend/src/lib/errors.ts`.

| Category | Example cause | HTTP |
| --- | --- | --- |
| `invalid_endpoint` | `http://host:2375`, bare `host:2375`, empty | 400 |
| `endpoint_not_configured` | `widgetInstanceId` resolves to no Docker connection | 4xx (config), distinct from unreachable |
| `endpoint_unreachable` | TCP refused, DNS failure, SSH host unreachable | 502 |
| `ssh_auth_failed` | Key rejected by remote | 502 |
| `ssh_host_key_failed` | `known_hosts` mismatch or unseeded | 502 |
| `ssh_client_missing` | `ssh` binary absent from image (FR-035) | 500 (config) |
| `remote_docker_unavailable` | `docker system dial-stdio` not runnable / permission denied | 502 |
| `api_version_unsupported` | Daemon range excludes anything we can speak (FR-029) | 502 |

Categories are **never** collapsed into a generic "connection failed", and none of them
leak key paths' contents or credentials.

---

## Validation rules

Enforced by `DockerEndpointSchema` in `backend/src/lib/validation.ts`, replacing the
current `dockerUrl: z.string().min(1).max(2048)` in both
`CreateDockerConnectionSchema` and `UpdateDockerConnectionSchema`.

| Rule | Requirement |
| --- | --- |
| Scheme is one of `unix://`, `tcp://`, `https://`, `ssh://` | FR-001..FR-005 |
| `http://` and bare `host:port` are **rejected** with a message naming the accepted forms | FR-006, FR-008 |
| Missing port defaults: `tcp`→2375, `https`→2376, `ssh`→22 | FR-002..FR-004 |
| Max length 2048 retained | Existing |
| Host component is free of shell metacharacters (SSH argv safety) | FR-007 |
| Caller-supplied endpoints additionally pass `isAllowedDockerEndpoint()` | FR-016 |
| Stored values are **re-validated on read**; a non-conforming legacy value fails closed | FR-008, FR-023 |

### `isAllowedDockerEndpoint()` policy

New sibling export in `backend/src/lib/url-validator.ts`. **Deliberately different from
`isAllowedArtUrl()`** — see [research.md R6](./research.md#r6-authorization-redesign--ssrf-boundary).

| Target | Art policy | Docker policy | Why |
| --- | --- | --- | --- |
| Loopback (`127.0.0.0/8`, `::1`) | **Deny** | **Allow** | A local daemon is the normal Docker case, especially under host networking |
| RFC1918 / LAN | Deny | **Allow** | The entire point of the feature is LAN Docker hosts |
| Link-local (`169.254.0.0/16`, `fe80::/10`) | Deny | **Deny** | Cloud/metadata SSRF |
| `0.0.0.0` / `::` | Deny | **Deny** | Not a meaningful target |
| Non-resolvable host | Deny | **Deny** | Fail closed |
| `unix://` paths | n/a | **Allow** | No network egress at all |

---

## State & lifecycle

### Version negotiation

```text
request → cache hit & fresh? ──yes──▶ use cached `effective`
                │no
                ▼
        GET /version (unversioned)
                │
                ▼
   effective = clamp(PREFERRED, MinAPIVersion, ApiVersion)  →  cache, use
                │
                ▼ (later) 400 "client version too old"
        invalidate → re-probe once → still failing? → api_version_unsupported (FR-029)
```

### SSH dial lifecycle (FR-037, SC-011)

```text
spawn ssh -T … <host> docker system dial-stdio
  → wrap {stdin,stdout} as Duplex
  → http.request({ createConnection: () => duplex })
  → arm deadline timer
  ├─ response complete  → destroy duplex, child exits
  ├─ transport error    → destroy duplex, SIGKILL child
  └─ deadline exceeded  → SIGKILL child, reject with endpoint_unreachable
finally: timer cleared, child reaped — no orphaned processes under any path
```

---

## Entity relationships

```text
WidgetInstance ──(1, connection_type='docker')──▶ DockerConnection ──parse/validate──▶ DockerEndpoint
                                                 │
                                                 ├──▶ DockerApiVersion (cached per endpoint)
                                                 │
                                                 └──▶ Transport
                                                       ├─ unix   → http + socketPath
                                                       ├─ tcp    → http  + host:port
                                                       ├─ https  → https + host:port
                                                       └─ ssh    → SshTransportConfig + dial-stdio duplex
                                                                     │
                                                                     ▼
                                                              ContainerSummary[]
```

Version negotiation and transport selection are keyed **per endpoint**, not per install
(FR-027), so different widgets may point at hosts running different Engine releases over
different transports without interfering.

`ContainerSummary` (the widget's projection of `/containers/json`) is **unchanged**:
`id`, `names`, `image`, `state`, `status`, `ports`, `created`. All of these fields have
been stable since Docker API v1.24, which is why clamped negotiation is safe across the
daemon versions HomeDash will encounter.


---

## Widget configuration (frontend)

`DockerConfig` (`frontend/src/state/dashboards.ts:112`).

| Field | Before | After |
| --- | --- | --- |
| `dockerUrl?` | single endpoint escape hatch, selected by `resolveMode === 'url'` (`DockerWidget.tsx:146`) | **Removed.** Cannot survive #189, which forbids caller-supplied endpoints. Existing values are adopted into real `docker_connections` rows + links by an idempotent startup reconciliation, so no operator action is required (FR-022, FR-023, SC-006). |
| `pollIntervalSeconds?` | number | unchanged |
| `maxContainers?` | number | unchanged |
| `allowControls?` | boolean | unchanged |

The endpoint deliberately lives in `docker_connections` + `widget_connections`, **not**
in `config_json`: endpoint selection must be resolved from authoritative server-side
storage, which is the whole point of the #189 fix. The adoption pass writes **rows into
existing tables** and rewrites an existing `config_json` value — no DDL.

### Action call path (corrected)

`DockerWidget.tsx:221` currently passes `dockerUrl={explicitUrl || 'unix:///var/run/docker.sock'}`
into `useDockerAction()`, so for a connection-linked widget every start/stop/restart is
sent to the **local** daemon regardless of which host the widget displays. After this
feature the action payload is `{ widgetInstanceId, containerId, action }` and the
endpoint is resolved server-side, so the action necessarily targets the same host whose
containers were listed.
