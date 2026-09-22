# 015 — Integrations Hub: Implementation Plan

## Approach

Phased rollout that progressively centralizes connection management without breaking existing widget configs. Each phase is independently shippable.

---

## Phase 1: Foundation — Backend Connection Models

**Goal:** Create the data model and API layer for centralized connections.

### Tasks
1. **DB schema migration** — Add `docker_connections` table, add `name` column to `pihole_instances`, create `widget_connections` join table
2. **Data migration** — Migrate existing pihole_instances to remove widget coupling; extract Docker URLs from configJson into docker_connections
3. **Connection CRUD routes** — `/api/admin/connections/pihole` and `/api/admin/connections/docker` (full CRUD + test)
4. **Connection listing route** — `GET /api/admin/connections` (aggregates all types + OAuth accounts)
5. **Widget connection linking** — Update widget save/load to use `widget_connections` join table
6. **Backward compat** — Existing pihole/docker routes still work during transition

---

## Phase 2: Settings UI — Integrations Hub Page

**Goal:** Redesign IntegrationsTab with grouped integration cards.

### Tasks
1. **IntegrationsTab layout** — Grouped sections: DNS & Network, Media, Productivity, Infrastructure
2. **ConnectionCard component** — Reusable card showing status, name, URL, actions (test/edit/remove)
3. **Pi-hole connection form** — Add/edit dialog with URL, API token, name, test connection
4. **Docker connection form** — Add/edit dialog with host URL, name, test connection
5. **Spotify section** — Connect/disconnect OAuth (reuse existing SpotifyConfigForm connection UI)
6. **Calendar & Todo sections** — Wrap existing ConnectedAccounts + CalendarSourceList + TodoAccountManager in new card layout
7. **Connection status indicators** — Green/red/yellow dots with last-tested timestamp
8. **Frontend hooks** — `useConnections()`, `usePiholeConnections()`, `useDockerConnections()`

---

## Phase 3: Widget Form Migration

**Goal:** Replace credential fields in widget config forms with connection pickers.

### Tasks
1. **ConnectionPicker component** — Dropdown that lists saved connections of a given type, with "Add new" link to Settings
2. **PiholeConfigForm refactor** — Remove URL/token fields, add ConnectionPicker, keep display options
3. **DockerConfigForm refactor** — Remove URL field, add ConnectionPicker, keep display options
4. **SpotifyConfigForm refactor** — Remove connect/disconnect, show read-only status + "Manage in Settings" link
5. **Update pihole-service.ts** — Resolve connection by connectionId via widget_connections, not by widgetInstanceId
6. **Update Docker API** — Resolve Docker URL from docker_connections table
7. **E2E verify** — All widgets still work after migration

---

## Phase 4: Polish & Cleanup

### Tasks
1. **Empty states** — Helpful messaging when no connections exist ("Add your first Pi-hole connection")
2. **Validation** — Prevent deleting connections that are in use by widgets (or warn + confirm)
3. **Remove legacy paths** — Clean up old direct-credential widget config routes
4. **Tests** — Connection CRUD tests, migration tests, widget-connection linking tests
5. **Spec checklist** — Update and verify acceptance criteria

---

## Dependencies

- Phase 2 depends on Phase 1 (needs backend routes)
- Phase 3 depends on Phase 2 (needs Settings UI to exist so "Add new" link works)
- Phase 4 can overlap with Phase 3

## Risk Areas

- **Migration safety** — Must not lose existing Pi-hole/Docker configs during migration
- **Session management** — Pi-hole session cache keys change from widgetInstanceId to connectionId
- **Multi-widget sharing** — Multiple widgets using same Pi-hole connection must share session cache
