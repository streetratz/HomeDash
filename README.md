# HomeDash

<!-- VERSION-BADGES-START -->
![Main Version](https://img.shields.io/badge/main-v3.2.14-blue)
![Release Version](https://img.shields.io/badge/release-v3.2.12-green)
<!-- VERSION-BADGES-END -->
![GHCR Image](https://img.shields.io/badge/ghcr.io-streetratz%2Fhomedash-purple)

A self-hosted, LAN-first home lab dashboard that brings your services, media, and smart home controls into a single, beautiful interface. Runs entirely on your local network — no cloud dependency required.

---

## What Is HomeDash?

HomeDash is a customizable dashboard for home labs. Create multiple dashboards with drag-and-drop widget layouts, connect your home services, and control everything from one place — on desktop or mobile.

- **Fully self-hosted** — runs on Docker or bare metal; your data stays on your network
- **Multi-user with RBAC** — admin, user, and viewer roles with group-based permissions
- **Mobile-friendly** — responsive layouts with separate mobile and desktop dashboards
- **Dark & light themes** — automatic or manual theme switching
- **Offline-capable** — works without internet (local integrations)

---

## Widgets

HomeDash ships with **15 widget types** that you can place on any dashboard:

| Widget | What It Does |
|--------|-------------|
| **Sonos Music** | Control Sonos speakers — play/pause, skip, volume, room grouping, browse & play from Spotify/radio/library. Fullscreen mode with queue management. |
| **Spotify** | Now-playing display, playback controls, device picker, search & play tracks/albums/playlists |
| **Pi-hole DNS** | View DNS blocking stats, query counts, blocklist size, and system health of your Pi-hole instance |
| **Docker Containers** | Monitor container status (running/stopped/paused) with optional start/stop/restart controls |
| **Calendar** | Upcoming events from iCalendar URLs or uploaded `.ics` files — including static birthday calendars |
| **Weather** | Current conditions for any location with °C/°F toggle |
| **Todo List** | Task lists with sorting, grouping, and completion tracking. Optional Microsoft To Do sync. |
| **Links List** | Quick-access bookmarks in grid or list layout with icons from the selfh.st icon library |
| **App Shortcuts** | Application launcher grid with configurable columns and icon display |
| **Photo Frame** | Rotating slideshow from local folders with crossfade transitions, shuffle, and captions |
| **Clock / Date** | Time and date display for any timezone; 12/24-hour format with optional seconds |
| **Markdown / Notes** | Formatted text display — notes, documentation, reference info |
| **Iframe Embed** | Embed any web page (Grafana, Portainer, router UI, etc.) with custom aspect ratio |
| **System Status** | Health monitoring for any HTTP/TCP service with polling and status indicators |

### Adding Widgets

1. Open a dashboard in **Edit Mode** (admin only)
2. Click **Add Widget** and select the type
3. Configure it (each widget has its own settings panel)
4. Drag to position and resize on the grid
5. Save the layout

---

## Integrations

Configure integrations from **Settings → Integrations**:

### Sonos
Control your Sonos speakers from HomeDash with two connection modes:
- **Local mode** — direct UPnP/LAN control, no internet or Sonos account needed
- **Cloud mode** — connect via Sonos OAuth for official API access

Features: play/pause/skip, volume per speaker, accurate stereo-pair and room grouping, confirmed local-mode queue clearing, admin group separation, browse Spotify playlists, saved albums, followed artists, saved tracks, radio stations, and music library, shuffle/repeat, and a fullscreen controller. Cloud mode clearly identifies controls that require direct local Sonos access.

### Spotify
Connect your Spotify Premium account via OAuth to get:
- Now-playing with album art and progress
- Playback controls and volume
- Device selection and transfer
- Search and play any track, album, or playlist
- Paginated browsing of saved playlists, albums, followed artists, and tracks

### Docker
Add Docker hosts (local socket or remote TCP) to monitor and control containers. A
widget can show multiple ordered hosts, and each host loads independently. Test
connections before saving.

### Pi-hole
Connect one or more Pi-hole instances to view DNS stats, blocking status, and system health.

### Calendars
Add an iCalendar (`.ics`) URL for a live feed, upload a static `.ics` file, or create a
local birthday calendar. Local birthdays can be added or edited manually, previewed and
imported from `first_name,last_name,month,day,birth_year,notes` CSV files, and exported
as CSV or ICS.
Birthday month/day values are date-only and do not shift with browser timezones.

### Photos
Point to local directories containing images to power the Photo Frame widget with slideshow display.

---

## Dashboards & Layout

- **Multiple dashboards** — create separate dashboards for different screens or purposes
- **Device targeting** — assign dashboards to web-only, mobile-only, or both
- **Grid layout** — drag-and-drop widget placement with resizable tiles
- **Backgrounds** — solid colors or uploaded images with fit/fill/cover display modes
- **Export / Import** — share dashboard configurations as JSON files
- **Duplicate** — clone an existing dashboard as a starting point
- **Public defaults** — set which dashboard unauthenticated visitors see
- **Per-widget public visibility** — integration widgets are hidden from
  anonymous visitors unless an administrator explicitly exposes them; public
  widgets are always read-only

---

## Appearance & Customization

Customize from **Settings → Appearance** (admin only):

- **Branding** — upload a custom logo (appears as favicon and in the header)
- **Header & Footer** — title text, header height, footer message
- **Clock Strip** — display up to 6 timezone clocks in the header (1 home + 5 additional)
- **Screensaver** — idle detection with configurable timeout and transition effects (fade, blur, slide)
- **Themes** — light or dark mode; applies system-wide with no flash on load

---

## Users & Permissions

HomeDash supports multiple users with group-based access control:

- **First-run setup** creates the initial admin account
- **Three built-in groups**: Administrators (full access), Users (view & interact), Viewers (read-only)
- **Custom groups** — create additional groups with specific permission sets
- **Additive permissions** — users in multiple groups get the union of all permissions
- **Per-user preferences** — each user can set their own theme and default dashboard

### Admin Password Reset

If you're locked out of the admin account, use the built-in reset script:

```bash
# Docker — reset password only (keeps existing username)
docker exec -it homedash node backend/dist/scripts/reset-admin.js --password "newpassword"

# Docker — change username AND password
docker exec -it homedash node backend/dist/scripts/reset-admin.js --username newadmin --password "newpassword"

# Local development
cd backend && npx tsx scripts/reset-admin.ts --password "newpassword"
```

| Flag | Behaviour |
|------|-----------|
| `--password` only | Resets password, keeps existing admin username |
| `--username --password` | Renames the admin account AND resets password |
| No flags | Interactive prompts (keeps username, prompts for password) |

> **Note:** All existing sessions are invalidated after a reset. Restart the container for changes to take effect.

---

## Deployment

HomeDash uses **GitHub Container Registry (GHCR)** for automated Docker deployments.

> 📖 **Full pipeline documentation:** See [`RELEASE-LIFECYCLE.md`](./RELEASE-LIFECYCLE.md) for the complete branching strategy, tagging, promotion steps, and rollback procedures.

### How It Works

```
Develop on main → Manual "Promote to Release"
  → Promotes the exact Main Version → Commits to main → Fast-forwards release
  → Creates git tag + GitHub Release (auto-changelog)
  → GHCR builds image tagged: latest + version + SHA
  → Watchtower auto-pulls on NAS
```

1. All development happens on `main` (feature branches merge here)
2. [`versions.json`](./versions.json) stores both version tracks. Each merged PR uses
   `pnpm version:bump-main` to advance only `main` and its blue badge by one patch step,
   leaving the deployed `release` and package version unchanged
3. When ready to deploy, go to **Actions** → **"Promote to Release"** → **Run workflow**
4. The workflow validates all version mirrors, then copies exact `versions.json.main`
   into `versions.json.release`, `package.json`, and the Release Version badge; Main
   Version remains unchanged
5. The workflow commits to `main`, then fast-forwards `release`
6. The Docker build triggers, pushing to GHCR with tags:
   - `ghcr.io/streetratz/homedash:latest` (always current)
   - `ghcr.io/streetratz/homedash:0.2.0` (pinned version)
   - `ghcr.io/streetratz/homedash:a1b2c3d` (commit SHA)
7. Watchtower on the NAS detects the new `latest` and recreates the container

### First-Time NAS Setup

1. **Create a GitHub PAT** with `read:packages` scope:
   - GitHub → Avatar → Settings → Developer settings → Personal access tokens
   - Click **"Generate new token (classic)"** (not fine-grained)
   - Note: `homedash-nas-pull`, Expiration: No expiration, Scope: `read:packages`

2. **Authenticate Docker on the NAS:**

   **Option A — docker login** (preferred if available):
   ```bash
   docker login ghcr.io -u streetratz --password-stdin <<< "ghp_YOUR_PAT"
   ```
   This creates `/root/.docker/config.json` automatically.

   **Option B — manual config** (Synology NAS / no docker login):
   ```bash
   mkdir -p /root/.docker
   echo '{"auths":{"ghcr.io":{"auth":"'$(echo -n "streetratz:ghp_YOUR_PAT" | base64)'"}}}' \
     > /root/.docker/config.json
   ```

   Then copy the credentials for Watchtower:
   ```bash
   cp /root/.docker/config.json /path/to/homedash/docker-config.json
   ```

   > **Synology note:** SSH in as root (`sudo -i`). The Docker credential file
   > lives at `/root/.docker/config.json` — Synology does not store it in `~/.docker`
   > for non-root users.

3. **Update your docker-compose.yml** — see `docker-compose.example.yml` for reference:
   - Set `image: ghcr.io/streetratz/homedash:latest`
   - Add Watchtower service with the credentials volume mount
   - Add label `com.centurylinklabs.watchtower.enable=true` to homedash service

4. **Start everything:**
   ```bash
   docker-compose up -d
   ```

### Manual / Local Build (Alternative)

For local builds without GHCR (using `deploy/` directory):
```bash
docker build --platform linux/amd64 -f deploy/Dockerfile -t homedash:latest .
docker save homedash:latest | gzip > homedash-image.tar.gz
# Transfer to NAS and: docker load < homedash-image.tar.gz
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, Docker deployment, environment variables, development setup |
| [Operations Guide](docs/operations.md) | Admin password reset, break-glass procedures, database management |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query v5 |
| Backend | Fastify, Drizzle ORM, SQLite (better-sqlite3), Zod validation |
| Auth | Session-based with HttpOnly cookies, CSRF protection, OAuth2 (Spotify, Sonos) |
| Deployment | Docker (multi-stage build) or bare metal with Node.js 24 |

---

## License

MIT
