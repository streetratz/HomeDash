# Phase 1 Quickstart — Docker Remote Endpoints & Authorization

**Feature**: `043-docker-remote-auth` | **Plan**: [plan.md](./plan.md)

How to configure, verify and test this feature. The live-host recipes are for
**developer/manual verification only** — no automated test may depend on them
([research.md R7](./research.md#r7-test-strategy)).

---

## Table of Contents

- [Endpoint formats](#endpoint-formats)
- [Configuring an SSH endpoint](#configuring-an-ssh-endpoint)
- [New environment variables](#new-environment-variables)
- [Running the automated tests](#running-the-automated-tests)
- [Manual verification against a live host](#manual-verification-against-a-live-host)
- [Troubleshooting](#troubleshooting)

---

## Endpoint formats

Exactly four forms are accepted. Anything else is rejected with a message naming these.

| Form | Example | Default port |
| --- | --- | --- |
| Unix socket | `unix:///var/run/docker.sock` | n/a |
| Plain TCP | `tcp://192.168.1.50:2375` | `2375` |
| TLS | `https://192.168.1.50:2376` | `2376` |
| SSH | `ssh://user@192.168.1.50` | `22` |

**Rejected**: `http://host:2375`, bare `host:2375`, empty. These previously "worked" by
silently resolving to the local Unix socket — that fallthrough is the #181 bug and is
removed.

Existing `unix:///var/run/docker.sock` connections (the common Synology case) keep
working with no change (FR-022, FR-023).

---

## Configuring an SSH endpoint

1. **Generate a dedicated key** (do not reuse a personal key):

   ```bash
   ssh-keygen -t ed25519 -N '' -C 'homedash' -f ./homedash_docker_ed25519
   ```

2. **Authorise it on the Docker host**, for a user that can reach the Docker socket:

   ```bash
   ssh-copy-id -i ./homedash_docker_ed25519.pub user@docker-host
   ```

3. **Place the key in the HomeDash data volume** with owner-only permissions (HomeDash
   refuses a group/world-readable key):

   ```bash
   install -d -m 700 "$HOMEDASH_DATA_DIR/ssh"
   install -m 600 ./homedash_docker_ed25519 "$HOMEDASH_DATA_DIR/ssh/id_ed25519"
   ```

4. **Seed `known_hosts`** — host-key checking is strict and fails closed, so this step
   is mandatory:

   ```bash
   ssh-keyscan -H docker-host >> "$HOMEDASH_DATA_DIR/ssh/known_hosts"
   chmod 600 "$HOMEDASH_DATA_DIR/ssh/known_hosts"
   ```

5. **Add the connection** in Settings → Connections → Docker as
   `ssh://user@docker-host`, then press **Test Connection**. A green result now means
   container listing genuinely works, not merely that `/_ping` answered (FR-028).

HomeDash never accepts, stores, or returns private key material — it only references the
path (FR-033).

---

## Upgrading an existing widget

A widget already linked to a Docker connection keeps working with no reconfiguration
(FR-022, FR-023, SC-006).

A widget that used the old `dockerUrl` config field is adopted automatically at startup:
HomeDash creates a named connection, links it to the widget, and removes the field. This
is required because #189 removes the `url` request parameter that field depended on. If
the stored value is not one of the four accepted forms, it is **left alone and
reported**, so you see the #181 misconfiguration rather than importing a broken host.

> **One host per widget.** Displaying several Docker hosts in a single widget is deferred
> to [#190](https://github.com/streetratz/HomeDash/issues/190).

### Container actions

Start/stop/restart now carry only `{ widgetInstanceId, containerId, action }` — the
endpoint is resolved server-side. This fixes a defect where actions on a
connection-linked widget were dispatched to the **local** Docker daemon regardless of
which host the widget was displaying.

---

## New environment variables

All three must be documented in `docs/getting-started.md` in the implementing PR and are
read only via `backend/src/config/env.ts`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOMEDASH_SSH_KEY_PATH` | `${HOMEDASH_DATA_DIR}/ssh/id_ed25519` | Private key for `ssh://` endpoints |
| `HOMEDASH_SSH_KNOWN_HOSTS_PATH` | `${HOMEDASH_DATA_DIR}/ssh/known_hosts` | Host-key trust store |
| `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING` | `true` | Explicit, documented opt-out only |

The production images gain `openssh-client` (`apk add` for `Dockerfile`, `apt-get
install` for `deploy/Dockerfile`). Without it, `ssh://` endpoints fail with a distinct
"SSH client not available in this image" error (FR-035); all other forms are unaffected.

---

## Running the automated tests

```bash
pnpm --filter backend test:unit          # endpoint grammar, version clamp, ssh argv/cleanup
pnpm --filter backend test:integration   # authorization matrix, server-side resolution
pnpm --filter backend test:contract      # OpenAPI paths + /api/docker/ping absence
pnpm --filter backend typecheck
pnpm --filter backend openapi:lint
pnpm lint                                # compare findings against `main` — pre-existing noise
```

The SSH transport tests run against a **stub `ssh` binary** in
`backend/tests/fixtures/ssh-stub/`, which replays canned Docker HTTP responses and
canned failure modes. No test reaches the network or requires a real Docker host.

---

## Manual verification against a live host

For SC-008, SC-010 and SC-011 only. Requires the developer's `docker-host` SSH
host alias.

### Confirm the transport works at all

```bash
printf 'GET /_ping HTTP/1.1\r\nHost: docker\r\nConnection: close\r\n\r\n' \
  | ssh -T docker-host 'docker system dial-stdio'
# → HTTP/1.1 200 OK … Api-Version: 1.52 … Server: Docker/29.1.3 (linux)
```

### Confirm the version clamp is necessary and correct

```bash
ssh docker-host 'docker version --format "API={{.Server.APIVersion}} MIN={{.Server.MinAPIVersion}}"'
# → API=1.52 MIN=1.44   ⇒ the hardcoded /v1.43/ is below MIN and is rejected with HTTP 400
```

### Exercise a plain-TCP endpoint without opening a port on the remote host

The remote host's 2375/2376 are closed by design. Materialise a local TCP Docker API
over the SSH tunnel:

```bash
ssh -nNT -L 23750:/var/run/docker.sock docker-host &
# then configure HomeDash with: tcp://127.0.0.1:23750
```

This also exercises the deliberate loopback-allowed policy of
`isAllowedDockerEndpoint()`.

### Confirm actions reach the displayed host

With a widget pointed at the SSH host, restart a container from the widget and confirm
on the remote host that the container actually restarted:

```bash
ssh docker-host 'docker ps --format "{{.Names}}\t{{.Status}}" | head'
```

Before this feature the action would have been sent to the local daemon instead.

### Confirm no orphaned ssh processes (SC-011)

```bash
ps -ax | grep -c '[d]ial-stdio'   # expect 0 between polls, and after errors/timeouts
```

> Note: `timeout(1)` is not available on macOS by default — use `ssh -o ConnectTimeout=N`
> when adding timeouts to these commands.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Unsupported Docker endpoint format" | `http://` or bare `host:port` stored from before this change | Re-enter the endpoint using one of the four accepted forms |
| "Host key verification failed" | `known_hosts` unseeded or the host key changed | Re-run `ssh-keyscan` (step 4). Never disable strict checking to work around a *changed* key |
| "SSH client not available in this image" | Running an image built before `openssh-client` was added | Rebuild/pull the current image |
| "Permission denied (publickey)" | Key not authorised on the remote, or wrong remote user | Re-run `ssh-copy-id`; confirm the user can run `docker ps` on the host |
| "daemon supports API 1.44–1.52; HomeDash requested …" | Daemon raised `MinAPIVersion` beyond anything we can speak | Report — the clamp bounds should prevent this; indicates a daemon outside the supported range |
| Action hits the wrong daemon | `dockerUrl` still being taken from the request body | Regression of the #189 lockdown — report |
| Test Connection green but widget empty | Should no longer be possible — the test now performs a real container listing | If observed, this is a regression of FR-028/SC-009 |
