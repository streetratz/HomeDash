# 015 — Integrations Hub

## Problem

Integration/connection settings are scattered across individual widget config forms. A user who wants to manage their Pi-hole API key, Docker host, or Spotify connection must find the specific widget on a dashboard and open its config panel. Meanwhile, **Settings > Integrations** only shows Calendar and Todo providers — an inconsistent, incomplete experience.

Users naturally navigate to **Settings** to manage connections. Today that page is half-built.

## Proposed Solution

Redesign **Settings > Integrations** into a full **Integrations Hub** — a centralized place to manage every external connection. Widget config forms retain display/presentation settings but delegate connection management to the hub.

### Design Principles

1. **Connection settings live in Settings** — URLs, API keys, OAuth tokens, credentials
2. **Display settings stay in widgets** — layout, polling interval, what to show/hide
3. **OAuth flows trigger from Settings** — connect/disconnect buttons for Spotify, Microsoft, Google
4. **Test connectivity from Settings** — every connection has a "Test" action
5. **Widgets reference connections** — widget config picks which connection to use (enables multi-instance)

---

## User Stories

### US-1: Centralized connection management
> As an admin, I want to manage all my integration connections (Pi-hole, Docker, Spotify, Calendar, Todo) from a single Settings page so I don't have to hunt through dashboards.

### US-2: Connection status at a glance
> As an admin, I want to see the health/status of all my connections in one place so I can quickly identify problems.

### US-3: OAuth from Settings
> As an admin, I want to connect/disconnect OAuth services (Spotify, Microsoft, Google) from the Integrations page, with the same flows that exist today but accessible from Settings.

### US-4: Widget connection picker
> As an admin, when configuring a widget that uses an external connection (Pi-hole, Docker), I want to pick from my saved connections rather than re-entering credentials.

### US-5: Multiple instances of the same integration
> As an admin, I want to add multiple Pi-hole servers or Docker hosts, and assign different widgets to different instances.

---

## Scope

### In Scope (MVP)
- Redesign IntegrationsTab with grouped integration cards
- Move Pi-hole connection config (URL + API key) into Settings
- Move Docker connection config (host URL) into Settings
- Spotify connect/disconnect accessible from Settings (already partially there via OAuth)
- Calendar & Todo connections stay as-is but visually unified
- System Status service URLs remain in widget config (they're per-widget by nature)
- Connection health indicators (last test result, connected/disconnected status)
- "Test Connection" action for each integration
- Widget config forms show a connection picker dropdown instead of credential fields

### Out of Scope (Future)
- Bulk health check / monitoring dashboard
- Import/export of connection configs
- Connection sharing across users (connections are admin-managed, globally available)
- Notifications on connection failures
- Auto-discovery of services on LAN

---

## Integration Categories & Cards

### DNS & Network
| Integration | Connection Fields | Storage | Test Method |
|---|---|---|---|
| **Pi-hole** | Base URL, API Password | `pihole_instances` table (encrypted) | `POST /api/pihole/config/:id/test` |

### Media
| Integration | Connection Fields | Storage | Test Method |
|---|---|---|---|
| **Spotify** | OAuth (connect/disconnect) | `oauth_accounts` table | `GET /api/spotify/status` |

### Productivity
| Integration | Connection Fields | Storage | Test Method |
|---|---|---|---|
| **Calendar (Microsoft)** | OAuth (connect/disconnect) | `oauth_accounts` table | Account status check |
| **Calendar (Google)** | OAuth (connect/disconnect) | `oauth_accounts` table | Account status check |
| **Calendar (iCal)** | URL, sync interval, color | `calendar_sources` table | Fetch URL |
| **Todo (Microsoft)** | OAuth (connect from Calendar) | `oauth_accounts` table | Sync check |

### Infrastructure
| Integration | Connection Fields | Storage | Test Method |
|---|---|---|---|
| **Docker** | Host URL (socket/TCP) | New `docker_connections` table | `POST /api/docker/ping` |

---

## UI Layout

```
Settings > Integrations
┌──────────────────────────────────────────────────┐
│  DNS & Network                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ 🛡 Pi-hole                                  │  │
│  │ ● Connected — http://192.168.1.45           │  │
│  │ Last tested: 2 min ago                      │  │
│  │                    [Test] [Edit] [Remove]   │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Media                                            │
│  ┌────────────────────────────────────────────┐  │
│  │ 🎵 Spotify                                  │  │
│  │ ● Connected as john@example.com             │  │
│  │                    [Disconnect]             │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 🎵 Spotify        [+ Connect Spotify]       │  │
│  │ No accounts connected                       │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Productivity                                     │
│  ┌────────────────────────────────────────────┐  │
│  │ 📅 Calendars          [+ Add iCal Source]   │  │
│  │ ● Microsoft (john@outlook.com) — Active     │  │
│  │ ● Google (john@gmail.com) — Active          │  │
│  │ ● Work Calendar (iCal) — Last sync 5m ago   │  │
│  │                                             │  │
│  │ 📋 Todo                                     │  │
│  │ ● Microsoft To Do (3 lists synced)          │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Infrastructure                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ 🐳 Docker                    [+ Add Host]   │  │
│  │ ● Local — unix:///var/run/docker.sock       │  │
│  │   12 containers, last ping 30s ago          │  │
│  │                    [Test] [Edit] [Remove]   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Edit Dialogs
Clicking "Edit" or "Add" opens an inline expandable section or a sheet/dialog with:
- Connection-specific fields (URL, token, etc.)
- Test Connection button with status feedback
- Save / Cancel actions

---

## Data Model Changes

### New Table: `docker_connections`
```sql
CREATE TABLE docker_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Docker',
  dockerUrl TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Modified: `pihole_instances`
- Add `name` column (`TEXT NOT NULL DEFAULT 'Pi-hole'`) for display in connection picker
- Remove `widgetInstanceId` foreign key → connections are now global, not widget-bound
- Add `userId` column for ownership tracking (admin who created it)

### New Table: `widget_connections` (join table)
```sql
CREATE TABLE widget_connections (
  widgetInstanceId TEXT NOT NULL REFERENCES app_widget_instances(id) ON DELETE CASCADE,
  connectionType TEXT NOT NULL, -- 'pihole' | 'docker'
  connectionId TEXT NOT NULL,   -- references pihole_instances.id or docker_connections.id
  PRIMARY KEY (widgetInstanceId, connectionType)
);
```

### Migration Strategy
- Existing `pihole_instances` rows: keep data, add `name` column, create `widget_connections` entries from existing `widgetInstanceId`
- Existing Docker widgets: extract `dockerUrl` from `configJson` → create `docker_connections` row + `widget_connections` entry

---

## API Changes

### New Routes
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/connections` | List all connections (grouped by type) |
| `GET` | `/api/admin/connections/:type` | List connections of a specific type |

### Modified Routes
| Route | Change |
|---|---|
| `PUT /api/pihole/config/:widgetInstanceId` | Accept optional `connectionId` to link existing connection, OR create new |
| Docker routes | Accept `connectionId` param instead of inline URL |

### Pi-hole Connection CRUD
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/connections/pihole` | List all Pi-hole connections |
| `POST` | `/api/admin/connections/pihole` | Create new Pi-hole connection |
| `PUT` | `/api/admin/connections/pihole/:id` | Update Pi-hole connection |
| `DELETE` | `/api/admin/connections/pihole/:id` | Delete Pi-hole connection |
| `POST` | `/api/admin/connections/pihole/:id/test` | Test Pi-hole connection |

### Docker Connection CRUD
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/connections/docker` | List all Docker connections |
| `POST` | `/api/admin/connections/docker` | Create new Docker connection |
| `PUT` | `/api/admin/connections/docker/:id` | Update Docker connection |
| `DELETE` | `/api/admin/connections/docker/:id` | Delete Docker connection |
| `POST` | `/api/admin/connections/docker/:id/test` | Test Docker connection |

### OAuth (unchanged but accessible)
Existing routes remain. The Integrations Hub UI just links to them:
- `GET /api/auth/oauth/microsoft` → Connect Microsoft
- `GET /api/auth/oauth/google` → Connect Google
- `GET /api/spotify/login` → Connect Spotify

---

## Widget Config Form Changes

### PiholeConfigForm
**Before:** URL + API token + poll interval + display options all in one form
**After:**
- Connection picker dropdown (lists saved Pi-hole connections)
- "Add new connection" link → opens Settings > Integrations
- Display options only: show health, show blocklist count, poll interval override

### DockerConfigForm
**Before:** Docker URL + poll interval + max containers + allow controls
**After:**
- Connection picker dropdown (lists saved Docker connections)
- "Add new connection" link → opens Settings > Integrations  
- Display options only: poll interval, max containers, allow controls

### SpotifyConfigForm
**Before:** Connect/disconnect button + display options
**After:**
- Connection status display (read-only, shows account)
- "Manage in Settings" link → opens Settings > Integrations
- Display options only: show album art, compact mode

### CalendarConfigForm / TodoConfigForm
**Unchanged** — they already reference sources/accounts managed elsewhere. Just ensure the "Manage connections" link points to the right place.

---

## Acceptance Criteria

- [ ] Settings > Integrations shows all integration types grouped by category
- [ ] Pi-hole connections can be created, edited, tested, and deleted from Settings
- [ ] Docker connections can be created, edited, tested, and deleted from Settings
- [ ] Spotify connect/disconnect works from Settings page
- [ ] Calendar & Todo connections remain accessible from Settings (as today)
- [ ] Each connection shows status indicator (connected/disconnected/error)
- [ ] Widget config forms show connection picker instead of credential fields
- [ ] Existing Pi-hole and Docker widgets migrate to new connection model
- [ ] OAuth flows (Microsoft, Google, Spotify) are triggerable from the hub
- [ ] All connection credentials remain encrypted at rest
- [ ] Admin-only access enforced on all connection management
