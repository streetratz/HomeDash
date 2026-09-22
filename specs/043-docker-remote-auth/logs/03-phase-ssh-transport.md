# Phase 3: SSH Transport — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [Design: why spawn `ssh`](#design-why-spawn-ssh)
- [Commands Run](#commands-run)
- [Run 1 — first execution of the new tests](#run-1--first-execution-of-the-new-tests)
- [Run 2 — phase gate](#run-2--phase-gate)
- [Errors & Fixes](#errors--fixes)
- [T037 — spawn cost vs the poll budget](#t037--spawn-cost-vs-the-poll-budget)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

`tasks.md` Phase 4 (T024–T038). Adds the `ssh://` transport, the third of the
three independent root causes behind
[#181](https://github.com/streetratz/HomeDash/issues/181): before Phase 2 an
`ssh://` URL was silently coerced to a socket path by `parseDockerUrl()`, so an
SSH endpoint quietly talked to the *local* daemon. Phase 2 made that input a
hard error; this phase makes it work.

Files added:

- `backend/src/services/dockerSshTransport.ts` — the transport
- `backend/tests/unit/dockerSshTransport.test.ts` — 36 tests
- `backend/tests/fixtures/ssh-stub/ssh-stub.mjs` — a stub `ssh` binary

Files changed: `backend/src/config/env.ts` (3 vars),
`backend/src/config/dataDir.ts` (`ssh/` at `0700`),
`backend/src/services/dockerService.ts` (transport selection),
`Dockerfile`, `deploy/Dockerfile`, `docs/getting-started.md`.

## Design: why spawn `ssh`

Per `research.md` R1, and unchanged by implementation: spawn the system `ssh`
running `docker system dial-stdio`, wrap the child's stdio as a `Duplex`, and
hand that to `http.request()` through `createConnection`. This is what the
Docker CLI itself does. Zero new dependencies.

The two rejected alternatives are worth restating because both look easier:

- **`ssh2`** — means reimplementing `known_hosts` parsing, key format support,
  and agent handling, all of which OpenSSH already does correctly.
- **`ssh -L` port forward** — materialises an **unauthenticated Docker API on a
  local TCP port** for the lifetime of the forward. That is a worse hole than
  the bug being fixed, and it is exactly the shape of #189.

Response framing is by `Content-Length`. This matters: the daemon's dial-stdio
channel commonly emits a trailing `{"message":"context canceled"}` after a
complete response, and a naive read-to-EOF appends it to the JSON body. The
`ok-trailing` stub mode exists solely to hold that behaviour down.

## Commands Run

| # | Command | Output |
|---|---------|--------|
| 1 | `pnpm --filter backend exec vitest run tests/unit/dockerSshTransport.test.ts` | [vitest-run-1.log](./03-phase-ssh-transport/vitest-run-1.log) — 31/36 |
| 2 | `pnpm --filter backend exec vitest run tests/unit/dockerSshTransport.test.ts` | [vitest-run-2.log](./03-phase-ssh-transport/vitest-run-2.log) — 36/36 |
| 3 | `node -e '<spawn benchmark>'` | [spawn-cost.log](./03-phase-ssh-transport/spawn-cost.log) |
| 4 | `pnpm --filter backend test:unit` | [test-unit.log](./03-phase-ssh-transport/test-unit.log) |
| 5 | `pnpm typecheck` | [typecheck.log](./03-phase-ssh-transport/typecheck.log) |
| 6 | `pnpm lint` | [lint.log](./03-phase-ssh-transport/lint.log) |

## Run 1 — first execution of the new tests

`31 passed | 5 failed`. All five failures were the error-classification cases
(`host-key`, `auth`, `unreachable`, `no-docker`, `socket-denied`) — see below.

## Run 2 — phase gate

Against the baselines in [readme.md](./readme.md):

| Gate | Baseline | This phase | Verdict |
|------|----------|-----------|---------|
| `pnpm --filter backend test:unit` | pass | **174 passed**, exit 0 | ✅ +36 |
| `pnpm typecheck` | 23 errors | **23 errors**, exit 2 | ✅ identical |
| `pnpm lint` | 82 problems (55 E / 27 W) | **82 problems (55 E / 27 W)**, exit 1 | ✅ identical |

## Errors & Fixes

### 1. The classified SSH error lost a race against `ECONNRESET`

**Symptom:** every failure-mode test got `{ code: 'ECONNRESET' }` — "socket hang
up" — instead of `DOCKER_SSH_AUTH_FAILED`, `DOCKER_REMOTE_UNAVAILABLE`, etc.

**Cause:** the first draft emitted a custom `'ssh-exit'` event on the `Duplex`
from the child's `close` handler, and `req.on('error')` preferred it if it had
already arrived. It never had. When `ssh` dies, the socket tears down and
`http.request` reports `ECONNRESET` **before** the child is reaped and its
stderr is complete. The symptom always beat the cause.

**Fix:** stop racing. The dial handle now *records* the classified failure
(`failure: () => Error | undefined`) and `req.on('error')` awaits `handle.done`
— the child's exit — before choosing `handle.failure() ?? err`. The custom event
is gone.

This ordering is also why the classification is recorded rather than thrown: a
non-zero exit *after* a complete response is the documented `context canceled`
quirk, and only a request that itself failed ever consults `failure()`.

### 2. `import.meta` in the test file (TS1343)

The test resolved the stub via `fileURLToPath(import.meta.url)`, which the
CommonJS test tsconfig rejects. Replaced with
`path.resolve(process.cwd(), 'tests/fixtures/ssh-stub/ssh-stub.mjs')` — vitest
runs with the backend package as cwd.

### 3. The `Socket` cast was unnecessary

The implementation cast the `Duplex` with
`as unknown as import('node:net').Socket`, flagged twice by lint
(`no-unnecessary-type-assertion` + `consistent-type-imports`). **`http.request`'s
`createConnection` accepts a `Duplex` directly** — the cast was defensive and
wrong. Removed. This resolved the one open risk from the design: the Duplex
wiring needed no coercion at all.

## T037 — spawn cost vs the poll budget

`n=20, min=5.53ms, p50=7.27ms, p95=23.79ms` for local process spawn
([spawn-cost.log](./03-phase-ssh-transport/spawn-cost.log)).

Against a 30s poll budget, a per-poll spawn costs ~0.02% of the interval. The
dominant cost of an `ssh://` poll is the SSH handshake and the network, not
`fork`/`exec`, and connection pooling would not change that without also
introducing connection lifecycle state this feature does not need.

**Pooling stays deferred.** Revisit only if the poll interval drops below ~5s.

## Phase Checkpoint

- [x] T024–T038 complete
- [x] `ssh://` endpoints reach a remote daemon through `docker system dial-stdio`
- [x] Failures are classified to distinct codes (auth / host key / unreachable /
      client missing / remote unavailable) rather than a generic socket error
- [x] Key permissions enforced (`0600` or stricter) before spawn
- [x] Host-key checking on by default; opt-out documented with its consequence
- [x] `openssh-client` present in both production images
- [x] Three `HOMEDASH_SSH_*` vars documented, and the "no environment variables
      needed" claim in `getting-started.md` qualified
- [x] No `backend/drizzle/*.sql` touched — feature remains migration-free
- [x] Gate at baseline, no new problems

**Not done, deliberately:** no test contacts a real host. Live verification
against `docker-host` is Phase 7, manual.
