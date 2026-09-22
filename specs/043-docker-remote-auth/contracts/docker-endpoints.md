# Phase 1 Contracts — Docker HTTP Routes & Authorization

**Feature**: `043-docker-remote-auth` | **Plan**: [../plan.md](../plan.md)

Authoritative route contracts for the Docker integration after this feature. These must
be mirrored into `specs/001-homelab-dashboard/contracts/openapi.yaml` (which currently
declares **no** Docker paths) and asserted by
`backend/tests/contract/openapi.test.ts` (FR-025).

Legend — **Auth**: `none` = no guard (defect), `session` = `requireAuth`,
`admin` = `requireAdmin`, `+csrf` = `assertCsrf`.

---

## Table of Contents

- [Summary of changes](#summary-of-changes)
- [GET /api/docker/containers](#get-apidockercontainers)
- [POST /api/docker/ping — REMOVED](#post-apidockerping--removed)
- [POST /api/docker/action](#post-apidockeraction)
- [POST /api/admin/connections/docker/test](#post-apiadminconnectionsdockertest)
- [POST /api/admin/connections/docker/:id/test](#post-apiadminconnectionsdockeridtest)
- [Error contract](#error-contract)

---

## Summary of changes

| Route | Auth before | Auth after | Change |
| --- | --- | --- | --- |
| `GET /api/docker/containers` | **none** | `session` | Guard added; caller-supplied `url` parameter **removed**; endpoint resolved server-side |
| `POST /api/docker/ping` | **none** | — | **Route deleted** (redundant with the admin test route) |
| `POST /api/docker/action` | `admin` + `csrf` | `admin` + `csrf` | Unchanged guard; caller-supplied `dockerUrl` **removed** in favour of server-side resolution from `widgetInstanceId` |
| `POST /api/admin/connections/docker/test` | `admin` + `csrf` | `admin` + `csrf` | Unchanged guard; now exercises **container listing**, not just `/_ping` |
| `POST /api/admin/connections/docker/:id/test` | `admin` + `csrf` | `admin` + `csrf` | Same as above |

---

## GET /api/docker/containers

**Auth**: `session` (`requireAuth` as a `preHandler`, evaluated **before** any endpoint
resolution or outbound call).

### Request

| Param | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `widgetInstanceId` | query | string | **yes** | The only way to select an endpoint |
| `all` | query | boolean | no | Existing behaviour; defaults to `true` |
| ~~`url`~~ | query | — | — | **Removed** (FR-014). Supplying it is ignored; the request is served from the resolved endpoint only. |

Resolution goes through `resolveDockerUrl()`, which is additionally fixed to filter on
`connectionType = 'docker'` — it currently filters on `widgetInstanceId` alone and takes
an arbitrary first row.

### Responses

| Status | Meaning |
| --- | --- |
| `200` | `{ containers: ContainerSummary[] }` |
| `400` | `widgetInstanceId` missing or malformed |
| `401` | No authenticated session — uniform body, emitted before resolution (FR-019, SC-002) |
| `4xx` | `endpoint_not_configured` — widget resolves to no connection, or the stored endpoint fails re-validation (FR-008, FR-010) |
| `502` | `endpoint_unreachable` / `ssh_*` / `api_version_unsupported` — daemon reachable-but-failing, distinct from misconfiguration (FR-011) |

**Invariant**: there is **no** silent fallback to `unix:///var/run/docker.sock` on any
path (FR-009). An unresolvable endpoint is an error, never a local-socket default.

---

## POST /api/docker/ping — REMOVED

This route is **deleted** (FR-013, FR-015). It was unauthenticated, accepted a
caller-supplied `url`, and duplicated
[`POST /api/admin/connections/docker/test`](#post-apiadminconnectionsdockertest), which
is already correctly guarded by `requireAdmin` + `assertCsrf`.

- Expected response after this feature: `404`.
- The contract test asserts the path is **absent** from the OpenAPI document.
- The sole frontend caller (`useDockerPing` in `frontend/src/hooks/useDocker.ts`) is
  retargeted to the admin test route in the same PR.

Rationale: removing the surface is strictly stronger than guarding it — there is no
route left for a future refactor to accidentally un-guard.

---

## POST /api/docker/action

**Auth**: `admin` + `csrf` (unchanged — FR-017 forbids weakening this).

### Request body

| Field | Type | Notes |
| --- | --- | --- |
| `widgetInstanceId` | string | **New.** The endpoint is resolved from this, server-side, via the same `resolveDockerUrl()` used by container listing |
| ~~`dockerUrl`~~ | — | **Removed.** After this feature **no** route accepts an endpoint from a caller — admin or not. FR-016 requires every caller-supplied endpoint to be validated; removing the field is cheaper and safer than validating it |
| `containerId` | string | Existing |
| `action` | `start` \| `stop` \| `restart` | Existing |

No `connectionId` discriminator is needed: one widget resolves to one Docker connection
in this feature. If [#190](https://github.com/streetratz/HomeDash/issues/190) later
introduces multiple hosts per widget it can add one without changing the resolution
model, because the endpoint is already never caller-supplied.

**This also fixes a live defect.** `frontend/src/components/widgets/DockerWidget.tsx:221`
passes `dockerUrl={explicitUrl || 'unix:///var/run/docker.sock'}` into
`useDockerAction()`, so for a connection-linked widget every start/stop/restart is
currently dispatched to the **local** daemon rather than the host being displayed.
Server-side resolution removes the possibility.

### Responses

`200` on success; `400` invalid body; `4xx` `endpoint_not_configured` when the widget
resolves to no Docker connection; `401`/`403` unauthenticated or non-admin; `403`
missing/invalid CSRF; `502` endpoint failure categories as above.

---

## POST /api/admin/connections/docker/test

**Auth**: `admin` + `csrf` (already implemented inline in
`backend/src/api/connections.ts`).

The single admin "Test Connection" path. Accepts a caller-supplied endpoint for
pre-save testing.

### Request body

| Field | Type | Notes |
| --- | --- | --- |
| `dockerUrl` | string | Validated by `DockerEndpointSchema` + `isAllowedDockerEndpoint()` |

### Behaviour change (FR-028, SC-009)

`testDockerConnection()` (`backend/src/services/connectionService.ts:367`) currently
calls `pingDocker()`, which hits the **unversioned** `/_ping`. That is why the current
UI reports success against a daemon the widget cannot read.

It must instead:

1. negotiate the API version (`GET /version`, clamp, cache), then
2. perform a **versioned container listing** (e.g. `/v{effective}/containers/json?limit=1`).

A test that returns `success: true` therefore guarantees the widget will also work.

### Responses

`200` `{ success: boolean, message: string }`, where `message` carries the classified
error category text on failure; `400` invalid endpoint; `401`/`403` auth/CSRF.

---

## POST /api/admin/connections/docker/:id/test

**Auth**: `admin` + `csrf`. Identical to the above but resolves the endpoint from the
stored connection `:id` instead of the request body. Same negotiated-container-listing
behaviour change applies.

---

## Error contract

All errors use the existing `ApiErrorBody` shape from `backend/src/lib/errors.ts`. The
`DockerEndpointError` categories in [data-model.md](../data-model.md#dockerendpointerror-classified-failure)
map onto `ErrorCode` values; each carries operator-actionable text.

Required properties:

- **Uniform rejection** — `401`/`403` bodies are constant and are emitted *before* any
  endpoint resolution, DNS lookup, socket open, or `ssh` spawn, so neither body content
  nor response timing reveals which endpoints are configured (FR-019, SC-002).
- **Distinguishable failures** — misconfiguration (`4xx`) is never reported as
  unreachability (`502`) and vice versa (FR-010, FR-011).
- **Actionable version errors** — an `api_version_unsupported` message names the
  daemon's supported range, e.g. *"daemon supports API 1.44–1.52; HomeDash requested
  1.43"* (FR-029).
- **No credential leakage** — no error body, log line, or API response ever contains
  private key material. Key **paths** may appear; key **contents** never do (FR-033).
