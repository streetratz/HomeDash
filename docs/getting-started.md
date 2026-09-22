# Getting Started

## Prerequisites

- **Node.js** 20 LTS or later
- **pnpm** (package manager)

## Local Development

```bash
# Clone the repository
git clone https://github.com/streetratz/HomeDash.git
cd HomeDash

# Install dependencies
pnpm install

# Start backend + frontend in watch mode
pnpm dev
```

The app will be available at **http://localhost:5173** (frontend dev server proxies API calls to the backend on port 3000).

On first launch, you'll be prompted to create an admin account.

### Useful Commands

```bash
pnpm dev          # Start both backend + frontend in watch mode
pnpm test         # Run all tests (Vitest)
pnpm lint         # ESLint with zero-warning policy
pnpm typecheck    # TypeScript type checking (both workspaces)
pnpm format       # Prettier formatting
```

## Docker Deployment

### Build and Run

```bash
docker build -t homedash .
docker run -d \
  --name homedash \
  -p 3000:3000 \
  -v homedash-data:/app/data \
  -e HOMEDASH_SESSION_SECRET="$(openssl rand -hex 32)" \
  homedash
```

The app will be available at **http://your-server:3000**.

### Docker Compose

```yaml
services:
  homedash:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - homedash-data:/app/data
    environment:
      - HOMEDASH_SESSION_SECRET=${HOMEDASH_SESSION_SECRET:?set a persistent secret}
    restart: unless-stopped

volumes:
  homedash-data:
```

## Environment Variables

| Variable                   | Default            | Description                                              |
| -------------------------- | ------------------ | -------------------------------------------------------- |
| `HOST`                     | `0.0.0.0`          | Listen address                                           |
| `PORT`                     | `3000`             | Listen port                                              |
| `HOMEDASH_DATA_DIR`        | `./data`           | Directory for SQLite database and uploaded files         |
| `HOMEDASH_SESSION_SECRET`  | _(required)_       | Session signing and credential-encryption secret         |
| `ALLOWED_ORIGINS`          | _(empty)_          | Comma-separated CORS allowlist; empty = same-origin only |
| `TRUST_PROXY`              | _(unset)_          | Set when running behind a reverse proxy                  |
| `LOG_LEVEL`                | `info`             | Log verbosity: `debug`, `info`, `warn`, `error`          |

Generate the secret once and retain it across upgrades:

```bash
openssl rand -hex 32
```

Existing installations that use `SESSION_SECRET` remain supported. Do not change the
value when renaming it to `HOMEDASH_SESSION_SECRET`: encrypted integration credentials
are derived from this secret and cannot be decrypted with a different value. If both
variables are set, their values must match or HomeDash refuses to start.

When upgrading from a release where no session-secret variable was configured, stop
before changing the value: the old installation may have encrypted integration
credentials using its previous effective secret. Configure that same value explicitly
for the first upgraded start, then rotate it only after reconnecting encrypted
integrations. Production now fails closed instead of selecting a known default.
Development and test processes generate an ephemeral secret when neither variable is
present.

### SSH (Docker over `ssh://`)

Only needed if you add a Docker connection with an `ssh://` URL. HomeDash reaches
those daemons by running `ssh <host> docker system dial-stdio`, so the host must
already accept the key non-interactively and the user must be able to reach the
Docker socket there.

| Variable                                | Default                              | Description                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOMEDASH_SSH_KEY_PATH`                 | `$HOMEDASH_DATA_DIR/ssh/id_ed25519`  | Private key used for Docker SSH connections. Must be `0600` (or stricter) and owned by the server user, or the connection is refused.                                                                                                           |
| `HOMEDASH_SSH_KNOWN_HOSTS_PATH`         | `$HOMEDASH_DATA_DIR/ssh/known_hosts` | Known-hosts file used to verify the remote host key.                                                                                                                                                                                            |
| `HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING` | `true`                               | Host-key verification. Set to `false` or `0` to disable. **Disabling it means the daemon you reach is not necessarily the daemon you configured** — only do this on a trusted network, and prefer adding the host key to `known_hosts` instead. |

The `ssh/` directory is created inside `HOMEDASH_DATA_DIR` at startup with mode
`0700`. Mount it as a volume so keys survive container restarts:

```bash
ssh-keyscan dockerhost >> ./data/ssh/known_hosts
cp ~/.ssh/id_ed25519 ./data/ssh/id_ed25519 && chmod 600 ./data/ssh/id_ed25519
```

The official images ship `openssh-client`. If you build your own, `ssh` must be
on `PATH` or `ssh://` endpoints fail with a configuration error.

### Integration Credentials

Integration credentials (Spotify OAuth, Sonos OAuth, Docker hosts, Pi-hole API keys) are configured through the **Settings → Integrations** UI. These need no environment variables — the one exception is Docker over `ssh://`, whose key and known-hosts locations are set with the `HOMEDASH_SSH_*` variables above.

## Public Dashboard Visibility

An administrator can select separate public dashboards for web and mobile
visitors. Self-contained widgets such as clocks, weather, calendars, links,
notes, iframes, and photo frames appear with that dashboard.

Integration widgets are **hidden by default**. In dashboard edit mode, open a
widget's settings and choose its **Public dashboard visibility**:

- **Hidden** — anonymous visitors do not receive the widget or its data.
- **Read-only** — anonymous visitors can see a server-projected snapshot.
- **Visible** — currently identical to Read-only; anonymous controls remain
  disabled.

Pi-hole, UniFi, Sonos, stocks, and app shortcuts support public snapshots.
Docker, Spotify, Todo, System Status, and unrecognized widget types remain
private. Public responses never include integration credentials, account
identity, management metadata, or mutation controls.

## Docker Connections

Docker hosts are configured in **Settings → Integrations → Docker**. A widget
never holds an address itself — it is linked to a connection, and the server
resolves the address from that link. This is why the Docker endpoints require a
signed-in session: the container list is not public data.

A Docker widget can link multiple saved hosts. Open the widget configuration,
select the hosts to include, and use the arrow controls to set their display
order. Each host loads independently, so an unavailable host does not hide
containers from the others.

### Accepted endpoint formats

Exactly four forms are accepted. A scheme is always required.

| Form        | Example                       | Default port |
| ----------- | ----------------------------- | ------------ |
| Unix socket | `unix:///var/run/docker.sock` | n/a          |
| Plain TCP   | `tcp://192.168.1.50:2375`     | `2375`       |
| TLS         | `https://192.168.1.50:2376`   | `2376`       |
| SSH         | `ssh://user@192.168.1.50`     | `22`         |

`http://host:2375` and a bare `host:2375` are **rejected**. Earlier versions
appeared to accept them, but silently fell back to the local Docker socket — so
the widget showed _this_ machine's containers while looking correctly
configured. If a connection is rejected, re-enter it with one of the four
schemes above; nothing else needs changing.

Existing `unix:///var/run/docker.sock` connections keep working unchanged.
On upgrade, older persisted absolute socket paths such as
`/var/run/docker.sock` are normalized once to the explicit `unix://` form.
New connection submissions still require a scheme.

### Connecting over SSH

Use this when the Docker daemon is not exposed on the network — it is the safest
of the four, since nothing new is published.

1. **Generate a dedicated key.** Don't reuse a personal key:

   ```bash
   ssh-keygen -t ed25519 -N '' -C 'homedash' -f ./homedash_docker_ed25519
   ```

2. **Authorise it** for a user that can reach the Docker socket on that host:

   ```bash
   ssh-copy-id -i ./homedash_docker_ed25519.pub user@docker-host
   ```

3. **Place the key in the data volume**, owner-readable only — HomeDash refuses
   a group- or world-readable key:

   ```bash
   install -d -m 700 "$HOMEDASH_DATA_DIR/ssh"
   install -m 600 ./homedash_docker_ed25519 "$HOMEDASH_DATA_DIR/ssh/id_ed25519"
   ```

4. **Seed `known_hosts`.** Host-key checking is strict and fails closed, so this
   step is mandatory:

   ```bash
   ssh-keyscan -H docker-host >> "$HOMEDASH_DATA_DIR/ssh/known_hosts"
   chmod 600 "$HOMEDASH_DATA_DIR/ssh/known_hosts"
   ```

5. **Add the connection** as `ssh://user@docker-host` and press **Test
   Connection**. A green result means container listing genuinely works, not
   merely that the daemon answered a ping.

HomeDash never accepts, stores, or returns private key material — it only
references the path.

### When a widget shows an error

The messages are deliberately distinct, because the fixes are:

| Message                   | Where to fix it                                              |
| ------------------------- | ------------------------------------------------------------ |
| No Docker connection      | Link the widget to a connection in Settings                  |
| Invalid Docker endpoint   | Re-enter the address using one of the four forms             |
| Docker host unreachable   | On the host — the address is valid, the daemon didn't answer |
| SSH authentication failed | The key isn't authorised for that user on the host           |
| SSH host key not verified | Add the host to `known_hosts` (step 4 above)                 |
| Incompatible Docker API   | The daemon is too old for any API version HomeDash speaks    |

A widget in any of these states shows no containers at all. It will never fall
back to the local daemon.

## Project Structure

```
backend/     Fastify API server (TypeScript, Drizzle ORM, SQLite)
frontend/    React + Vite SPA (TypeScript, Tailwind, shadcn/ui)
specs/       Feature specifications and design documents
docs/        Operational documentation
```

## Data & Persistence

All persistent data lives in `HOMEDASH_DATA_DIR`:

- `homedash.db` — SQLite database (users, dashboards, widgets, settings)
- `uploads/` — uploaded images (logos, backgrounds)

Back up this directory to preserve all your data.
