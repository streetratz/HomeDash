# Phase 6: Live Verification — Implementation Log

[← Back to Index](./readme.md)

## Contents

- [Overview](#overview)
- [Setup](#setup)
- [Commands Run](#commands-run)
- [T067 — the version clamp, proven against the real daemon](#t067--the-version-clamp-proven-against-the-real-daemon)
- [T068 — `ssh://` end to end](#t068--ssh-end-to-end)
- [T069 — plain TCP over a loopback forward](#t069--plain-tcp-over-a-loopback-forward)
- [T070 — the action reaches the remote host](#t070--the-action-reaches-the-remote-host)
- [T071 — no orphaned SSH clients](#t071--no-orphaned-ssh-clients)
- [T072 — local socket and legacy adoption](#t072--local-socket-and-legacy-adoption)
- [T073 — test result vs. widget listing](#t073--test-result-vs-widget-listing)
- [T074 — the negative tests fail against `main`](#t074--the-negative-tests-fail-against-main)
- [T075 — final gate](#t075--final-gate)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

`tasks.md` Phase 7 (T066–T073). SC-008, SC-010 and SC-011 assert things about a
real Docker daemon, and no unit test can prove them. These runs are **manual and
developer-local**: `docker-host` is a personal machine, there is no CI, and
nothing here is or ever becomes automated.

Target: `docker-host.home.arpa`, Docker Engine reporting `API=1.52 MIN=1.44`, 18
containers (`docker ps -a`).

## Setup

Every run used a **throwaway HomeDash instance**, never the developer's working
database:

```bash
install -d -m 700 /tmp/homedash-live/ssh
install -m 600 ~/.ssh/id_ed25519_ubuntu_server /tmp/homedash-live/ssh/id_ed25519
ssh-keyscan -H docker-host.home.arpa > /tmp/homedash-live/ssh/known_hosts
chmod 600 /tmp/homedash-live/ssh/known_hosts
HOMEDASH_DATA_DIR=/tmp/homedash-live pnpm --filter backend dev
```

That is the [quickstart.md](./../quickstart.md#configuring-an-ssh-endpoint)
recipe executed verbatim — it is itself under test here. The data dir was
deleted afterwards.

## Commands Run

| # | Task | Sidecar | Result |
|---|------|---------|--------|
| 1 | T067 daemon version | [t067-docker-version.log](./06-phase-live-verification/t067-docker-version.log) | `API=1.52 MIN=1.44` |
| 2 | T067 clamp, live | [t067-version-clamp-live.log](./06-phase-live-verification/t067-version-clamp-live.log) | ✅ 1.43 → 400, 1.44 → 200 |
| 3 | T068 key + known_hosts | [t068-key-setup.log](./06-phase-live-verification/t068-key-setup.log) | ✅ both `0600` |
| 4 | T068 test + create | [t068-ssh-connection.log](./06-phase-live-verification/t068-ssh-connection.log) | ✅ "Connected to Docker" |
| 5 | T068 listing | [t068-container-list.log](./06-phase-live-verification/t068-container-list.log) | ✅ 18 containers |
| 6 | T069 tcp loopback | [t069-tcp-loopback.log](./06-phase-live-verification/t069-tcp-loopback.log) | ✅ identical 18 |
| 7 | T070 remote restart | [t070-restart-remote.log](./06-phase-live-verification/t070-restart-remote.log) | ✅ remote host restarted |
| 8 | T071 orphan check | [t071-no-orphans.log](./06-phase-live-verification/t071-no-orphans.log) | ✅ no growth |
| 9 | T072 unix socket | [t072-unix-socket.log](./06-phase-live-verification/t072-unix-socket.log) | ✅ 18 containers |
| 10 | T072 adoption | [t072-adoption.log](./06-phase-live-verification/t072-adoption.log) | ✅ adopted, idempotent |
| 11 | T073 consistency | [t073-test-vs-widget.log](./06-phase-live-verification/t073-test-vs-widget.log) | ✅ no PASS-then-empty |

## T067 — the version clamp, proven against the real daemon

This is the cleanest available proof of one of #181's three root causes. Through
the SSH forward, against the live daemon:

```
$ curl /v1.43/containers/json          # the version HomeDash used to hard-code
{"message":"client version 1.43 is too old. Minimum supported API version is
1.44, please upgrade your client to a newer version"}
HTTP 400

$ curl /v1.44/containers/json?all=1    # clamp(preferred 1.24, MIN 1.44, API 1.52)
HTTP 200
containers: 18
```

The pre-change code could not have worked against this host — not "worked
unreliably", *could not have worked*. `clampApiVersion` raising the preferred
`1.24` up to the daemon's `MinAPIVersion` is exactly what makes the difference,
and the 200/18 above is the negotiated version being exercised.

## T068 — `ssh://` end to end

```
POST /api/admin/connections/docker/test  {"dockerUrl":"ssh://operator@docker-host.home.arpa"}
→ {"success":true,"message":"Connected to Docker"}

GET  /api/docker/containers?widgetInstanceId=live-widget-1
→ count: 18
   downloaders-prowlarr-1  running  Up 8 hours
   downloaders-radarr-1    running  Up 8 hours
   downloaders-sonarr-1    running  Up 8 hours
   portainer-portainer-1   created  Created
   workouts                exited   Exited (137) 21 hours ago
```

18 matches `ssh docker-host 'docker ps -a -q | wc -l'` exactly, and the
list includes `created` and `exited` containers — so this is the full remote
inventory, not a running-only subset. **SC-010 met.**

## T069 — plain TCP over a loopback forward

```bash
ssh -nNT -L 23750:/var/run/docker.sock docker-host
```

`tcp://127.0.0.1:23750` tested green and listed **18 containers, with an
identical set of names to the `ssh://` run**. This exercises the plain-TCP
branch and the deliberate loopback-allowed policy (RK-6) without opening a
single port on the remote host. **SC-008 met.**

## T070 — the action reaches the remote host

The sharpest test of RK-8: before 043 an action fell back to the local socket,
so a "restart" in the widget restarted a container on *this Mac* while appearing
to act on the displayed remote host.

```
target = downloaders-prowlarr-1
BEFORE (on docker-host): downloaders-prowlarr-1   Up 8 hours
POST /api/docker/action {widgetInstanceId, containerId, action:"restart"} → {"ok":true}
AFTER  (on docker-host): downloaders-prowlarr-1   Up 5 seconds
```

The uptime reset happened **on the remote host**. The action body carries no
URL at all — the endpoint is resolved server-side from the widget's connection.

## T071 — no orphaned SSH clients

Counting live `docker system dial-stdio` children across three successful polls,
one forced error, and one forced timeout:

| Point | Count |
|-------|-------|
| baseline | 0 |
| during/after 3 successful polls | 0 |
| after `ssh://nosuchhost.invalid` (DNS failure) | 0 |
| after `ssh://192.0.2.1` (20s connect timeout, TEST-NET-1) | 0 |

Both failure paths returned a classified message rather than hanging:

```
Could not reach ssh://nosuchhost.invalid:22 over SSH: ssh: Could not resolve hostname …
SSH dial to ssh://192.0.2.1:22 failed (exit 255): ssh: connect to host 192.0.2.1 port 22: Operation timed out
```

**Counting caveat, recorded honestly.** The first harness reported a constant
`1` at every point including the baseline — the `grep` was matching its own
wrapper's command line, not an ssh child. Re-counting with the pattern built via
`printf` returns `0`, both during the runs and after everything was stopped. The
figure that matters either way is the *delta*, which was zero throughout.
`timeout(1)` is unavailable on macOS, so `ssh -o ConnectTimeout=N` (already
built by `buildSshArgs`) provided the bound. **SC-011 met.**

## T072 — local socket and legacy adoption

**The `unix://` path.** Docker Desktop was not running on this Mac, so rather
than skip the regression case it was exercised against a real daemon through an
SSH *unix-socket* forward:

```bash
ssh -nNT -L /tmp/hd-docker-proxy.sock:/var/run/docker.sock docker-host
```

`unix:///tmp/hd-docker-proxy.sock` tested green and listed 18 containers. The
socket transport is unchanged and still works. **SC-006 (first half) met.**

**Legacy adoption.** A pre-043 widget was inserted by hand — URL in
`config_json`, no `widget_connections` row — and the server restarted with no
operator action of any kind:

| | Before | After |
|---|--------|-------|
| `config_json` | `{"dockerUrl":"unix:///tmp/hd-docker-proxy.sock","maxContainers":10}` | `{"maxContainers":10}` |
| `widget_connections` rows | 0 | 1 → `docker` |
| `docker_connections` rows | 3 | 4 |

```
[docker-adoption] widget legacy-widget-1: legacy dockerUrl adopted into a connection
```

The adopted widget then listed 18 containers. A **second** restart logged
nothing and left both counts unchanged — the pass is idempotent, as FR-023
requires. **SC-006 met.**

## T073 — test result vs. widget listing

FR-028/SC-009 forbid a state where Test Connection reports success and the
widget then shows nothing. Every endpoint form, live:

| Endpoint | Test | Widget |
|----------|------|--------|
| `ssh://operator@docker-host.home.arpa` | PASS | 18 containers |
| `tcp://127.0.0.1:23750` | PASS | 18 containers |
| `unix:///tmp/hd-docker-proxy.sock` | PASS | 18 containers |
| `ssh://nosuchhost.invalid` | FAIL | (not configurable) |
| `tcp://127.0.0.1:1` | FAIL | (not configurable) |
| `http://docker-host.home.arpa:2375` | FAIL | (not configurable) |
| `docker-host.home.arpa:2375` | FAIL | (not configurable) |

Every PASS produced containers; no PASS produced an empty widget. The two
rejected-format rows are the T061 guidance cases failing at the point of entry,
which is where they should fail. **SC-009 met.**

## T074 — the negative tests fail against `main`

SC-007 asks for proof that the new tests actually detect the old behaviour — a
test that passes both before and after proves nothing. `main`'s `backend/src`
was swapped in (via `git worktree add /tmp/hd-main main`) and the four new
integration files run against it:

| | vs `main` | vs this branch |
|---|-----------|----------------|
| `dockerAuth.test.ts` | 8 of 15 failed | 15 passed |
| `dockerContainers.test.ts` | 8 of 9 failed | 9 passed |
| `dockerAction.test.ts` | 3 of 7 failed | 7 passed |
| `dockerAdoption.test.ts` | file failed to load | 6 passed |
| **total** | **19 failed / 12 passed** | **37 passed** |

Sidecar: [t074-against-main.log](./06-phase-live-verification/t074-against-main.log).

Three of those failures are worth quoting, because they *are* the bugs:

```
✗ ignores a caller-supplied url parameter entirely (FR-014)
  expected '…' not to contain 'evil.example'
  +   {"error":"Docker connection failed: getaddrinfo ENOTFOUND evil.example"}
```

That is `main` **dialling an attacker-supplied host** on an unauthenticated
route — #189 reproduced, not merely argued.

```
✗ never silently falls back to unix:///var/run/docker.sock
  expected '…' not to contain '/var/run/docker.sock'
  +   {"error":"Docker connection failed: connect ENOENT /var/run/docker.sock"}
```

`main` resolving a widget's *remote* connection to the **local socket** — the
third root cause of #181.

```
✗ rejects an unauthenticated caller with 401   (got 200)
```

`dockerAdoption.test.ts` cannot even load against `main` — the module under
test does not exist there. Recorded as a file-level failure rather than
counted as behavioural evidence.

## T075 — final gate

Compared against the T003 baselines. The rule is **no NEW problems**, never
"clean".

| Check | Baseline | Final | Verdict |
|-------|----------|-------|---------|
| `pnpm lint` | 82 problems (55 E / 27 W) | **81 (54 E / 27 W)** | ✅ one below |
| `pnpm typecheck` | 23 errors | 23 errors | ✅ identical |
| `pnpm --filter backend test` | 3 failed / 600 passed | **3 failed / 603 passed** | ✅ same 3 |
| `pnpm --filter frontend test:unit` | 21 passed | 37 passed | ✅ +16 |
| `pnpm --filter backend openapi:lint` | 5 E / 39 W | 5 E / 39 W | ✅ identical |
| `pnpm build` | succeeds | succeeds | ✅ |

The three remaining backend failures are the pre-existing
`calendar-phase7.test.ts` iCal sync cases, unrelated to this feature.

**A flake, recorded rather than hidden.** The first full backend run showed
**five** failures — the three above plus two in `auth.test.ts`
("expected 401 to be 200" on valid credentials, i.e. the login rate limiter
already exhausted). Investigated rather than re-run blindly:
`auth.test.ts` alone passes 13/13; the four new Docker files plus `auth.test.ts`
pass 50/50; `rateLimit.test.ts` plus `auth.test.ts` pass 15/15. A second full
run reproduced exactly the 3-failure baseline. This is the same shared-limiter
ordering flake already noted for `rateLimit.test.ts` in the index, not a
regression from this feature. Both runs are kept:
[t075-backend-test.log](./06-phase-live-verification/t075-backend-test.log) and
[t075-backend-test-run2.log](./06-phase-live-verification/t075-backend-test-run2.log).

## Errors & Fixes

No product defects surfaced in this phase. Three harness problems were fixed:

1. **A `tsx` probe of `clampApiVersion` failed on import side effects** (the
   module graph wants a configured environment). Replaced with something
   strictly better: curling the live daemon at `/v1.43/` and `/v1.44/`, which
   proves the clamp's *consequence* rather than its arithmetic.
2. **The orphan count was self-matching** — see the T071 caveat.
3. **An earlier SSH forward on `:23750` was dead but still held its shell slot**;
   the port was closed and every curl returned `HTTP 000`. Restarted, verified
   with `nc -z` before use.

## Phase Checkpoint

- T066–T073 complete. SC-006, SC-008, SC-009, SC-010, SC-011 verified live.
- All three of #181's root causes are now disproven against the real host: the
  hard-coded `/v1.43/` (400 on this daemon), the silent socket coercion, and the
  local-socket fallback on actions.
- No automated test contacts `docker-host`. The throwaway data dir, both SSH
  forwards and all temp scripts were removed; zero `dial-stdio` processes remain.
- One side effect on the remote host, intended by T070: `downloaders-prowlarr-1`
  was restarted and is running.
- T074–T075 also recorded here per `tasks.md`: the negative tests fail against
  `main` (19 failures) and pass on this branch (37), and the final gate sits at
  or below every T003 baseline.
- `spec.md` was not edited during implementation — the last spec change was
  CH-05, committed before Phase 2 — so T077 is a deliberate no-op.

[← Back to Index](./readme.md)
