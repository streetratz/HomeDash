# Phase 4: Authorization — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [The five defects](#the-five-defects)
- [Commands Run](#commands-run)
- [Run 1 — phase gate](#run-1--phase-gate)
- [Errors & Fixes](#errors--fixes)
- [Design notes](#design-notes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

`tasks.md` Phase 5 (T039–T056) — the MVP security fix, closing
[#189](https://github.com/streetratz/HomeDash/issues/189).

The shape of the change: **no route anywhere accepts a Docker endpoint from a
caller**, except the two admin connection-test routes whose entire purpose is to
validate a destination before it is saved. Everything else resolves the endpoint
server-side from the widget's stored connection.

## The five defects

1. **`GET /api/docker/containers` was unauthenticated.** The comment justifying
   it — "Docker socket is local" — was false the moment the endpoint became
   caller-influenced, and had been false since remote connections existed.
2. **It accepted `?url=`.** Anyone could aim the server's Docker client at any
   address and read the response, which is SSRF with a JSON parser attached.
3. **`POST /api/docker/ping` was unauthenticated.** An unauthenticated port
   scanner: supply a `tcp://` URL, learn from the 200/502 whether something is
   listening. It duplicated the already-correct admin test route, so it was
   deleted rather than guarded.
4. **`resolveDockerUrl()` matched on `widgetInstanceId` alone.**
   `widget_connections` is keyed by `(widgetInstanceId, connectionType)`, so a
   widget with a Pi-hole link and no Docker link resolved the Pi-hole row's
   `connectionId` and looked it up in `docker_connections`.
5. **Every failure path fell back to `unix:///var/run/docker.sock`.** A widget
   pointed at a broken remote host silently listed *this* machine's containers.
   Combined with the action route taking `dockerUrl` from the body — and the
   widget sending `explicitUrl || 'unix:///var/run/docker.sock'` — a widget
   linked to a remote host **displayed remote containers but stopped local
   ones**.

## Commands Run

| # | Command | Output |
|---|---------|--------|
| 1 | `pnpm --filter backend test` | [test-all.log](./04-phase-authorization/test-all.log) |
| 2 | `pnpm typecheck` | [typecheck.log](./04-phase-authorization/typecheck.log) |
| 3 | `pnpm lint` | [lint.log](./04-phase-authorization/lint.log) |
| 4 | `pnpm --filter backend openapi:lint` | [openapi-lint.log](./04-phase-authorization/openapi-lint.log) |

## Run 1 — phase gate

| Gate | Baseline | This phase | Verdict |
|------|----------|-----------|---------|
| `pnpm --filter backend test` | 3 failures (`calendar-phase7`) | **603 passed / 3 failed**, same three | ✅ +82 tests |
| `pnpm typecheck` | 23 errors | **23 errors** | ✅ identical |
| `pnpm lint` | 82 problems (55 E / 27 W) | **82 problems (55 E / 27 W)** | ✅ identical |
| `pnpm --filter backend openapi:lint` | 5 errors, 39 warnings | **5 errors, 39 warnings** | ✅ identical, no Docker findings |

The `rateLimit.test.ts` flake did not reproduce in this run.

## Errors & Fixes

### 1. A sync `preHandler` hangs the request forever

**Symptom:** every *authenticated* `GET /api/docker/containers` timed out. The
401 cases passed. Direct calls to `listContainers()` failed in 9ms, so the
service was fine.

**Cause:** `requireAuth` is synchronous and returns `void`. Fastify's hook
runner calls a hook, and if the return value is not a thenable it assumes
**callback style** and waits for `done()` — which a void function never calls.
The request never proceeds and never replies. `requireAdmin` is `async`, which
is why the action route was unaffected, and why this was never noticed: this was
the first use of `requireAuth` as a `preHandler` anywhere in the codebase.

**Fix:** added `requireAuthHook` — an `async` wrapper — in `requireRole.ts`, and
documented why it must stay async. `requireAuth` stays synchronous because every
other caller invokes it inline inside a handler.

This one is worth remembering: the failure mode is a hang, not an error, so it
looks like a slow network call rather than a wiring mistake.

### 2. Tests reached the machine's real Docker daemon

The first fixture used `unix:///var/run/docker.sock`, which *exists* on this
machine. The suite would have passed or failed depending on whether Docker
Desktop was running. All fixtures now use `unix:///tmp/homedash-test-no-such-
docker.sock`, which cannot exist and fails in single-digit milliseconds.

### 3. `role: 'user'` is not a role

The user enum is `'admin' | 'standard'`. Fixed in the fixture.

### 4. Seven new lint errors, all from one line

`runDockerWidgetAdoption(app.log)` produced six `no-unsafe-*` errors because
**`app.log` is typed `any`** in this codebase — lines 123 and 125 of `server.ts`
already error at baseline for the same reason. Rather than add to that debt the
adoption pass defaults to `console`, whose `.warn` is permitted by the
`no-console` rule. console→pino remains tracked as #184.

The seventh was `const { dockerUrl: _removed, ...rest }` — the `_` prefix does
not exempt a destructured binding under this config. Replaced with a copy and
`delete`.

### 5. Four new OpenAPI warnings

Each new operation lacked `operationId`. Added; the document returned to exactly
the baseline 5 errors / 39 warnings with **no finding against any Docker path**.

## Design notes

**`notConfigured` is 409, not 404.** The widget exists; it just has no Docker
connection. A 404 would be indistinguishable from "no such widget", which is
precisely the ambiguity FR-010 exists to remove.

**Uniform 401s.** The auth guard runs as a `preHandler`, before resolution, so
an anonymous request for a real widget and one for a fabricated ID produce
byte-identical bodies. `dockerAuth.test.ts` asserts this by comparing serialised
bodies rather than describing it in prose.

**The adoption pass is not a migration.** It writes rows into existing tables and
performs no DDL, so it has no schema version and is safe on every boot. It also
refuses to import a value that fails the grammar (RK-7): importing it would
create a connection that can never be dialled *and* destroy the only copy of
what the user typed. Those values are left in place and reported once per boot.

**Loopback stays allowed.** `isAllowedDockerEndpoint()` blocks link-local and
unspecified addresses — the cloud-metadata pivots — but `tcp://127.0.0.1:2375`
is a legitimate Docker deployment (it is the SSH-forwarded case), and blocking
it would break the documented setup. The SSRF defence here is that the endpoint
is not caller-supplied in the first place.

**Frontend contract alignment was pulled into this phase.** Removing `?url=`,
`POST /api/docker/ping` and the body's `dockerUrl` breaks `useDocker.ts`
immediately, so the hooks were updated here to keep the tree coherent. Error
*surfacing* and settings guidance remain Phase 6. This also fixes
`DockerWidget.tsx:221`, the live action-routing bug.

## Phase Checkpoint

- [x] T039–T056 complete
- [x] No unauthenticated Docker route remains
- [x] No caller-supplied endpoint on any non-admin route
- [x] `POST /api/docker/ping` deleted, and asserted absent from both the server
      and the OpenAPI document
- [x] `resolveDockerUrl()` filters on `connectionType` and is the single
      resolution path
- [x] No fallback to the local socket on any path, asserted directly
- [x] Legacy `config.dockerUrl` adopted idempotently; bad values preserved
- [x] 82 new tests; gate at baseline on all four checks
- [x] No `backend/drizzle/*.sql` touched — feature remains migration-free

**#189 is closed by this phase.**
