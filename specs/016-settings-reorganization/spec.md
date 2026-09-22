# 016 — Settings Reorganization

## Problem

The Settings page has grown organically and settings are scattered across tabs and separate pages in ways that don't match user expectations:

- **"General" is a junk drawer** — theme (user), dashboard prefs (user), logo (admin) lumped together
- **"Shell & Appearance" does too much** — branding, layout dimensions, clock strip, public dashboard defaults, repo URL
- **Dashboard management and Group/RBAC management live on separate pages** (`/admin/dashboards`, `/admin/groups`) — breaks the mental model of Settings as the one-stop admin hub
- **Photo source CRUD is buried inside Screensaver settings** — the PhotoFrame widget also consumes photo sources but there's no obvious place to manage them independently
- **Clock Strip was duplicated** between Shell & Appearance and Customization before partial cleanup

## Solution

Reorganize Settings into 5 clearly separated tabs with consistent patterns:

```
General | Appearance | Dashboards | Groups & Access | Integrations
```

### Tab 1: General (all users)
Simple card layout. User-level preferences only.
- **User Preferences** — Theme toggle
- **My Dashboard Preferences** — Web/mobile dashboard picker

### Tab 2: Appearance (admin, sidebar layout)
Left sidebar navigation for visual/layout settings.

| Group | Item | Content |
|---|---|---|
| Layout | Branding | Logo upload, site title, font, font size |
| Layout | Header & Clock | Header height, clock strip (enable, alignment, timezones, display config, extra clocks) |
| Layout | Footer | Footer text, repo URL |
| Behavior | Screensaver | Enable, idle timeout, source picker dropdown, transition, interval, clock format, weather |

Screensaver no longer manages photo source CRUD — it only picks from the shared pool via a dropdown.

### Tab 3: Dashboards (admin, card/list layout)
Absorbs the current `/admin/dashboards` page.
- **Dashboard list** — Full CRUD (create, edit, duplicate, delete, reorder)
- **Public Defaults** — Unauthenticated web/mobile dashboard picker (moved from Shell)

### Tab 4: Groups & Access (admin, card/list layout)
Absorbs the current `/admin/groups` page.
- **Groups list** — CRUD for groups
- **Membership** — Assign users to groups
- **Permissions** — Group permission configuration

### Tab 5: Integrations (admin, sidebar layout)
Left sidebar navigation for external service connections.

| Group | Item | Content |
|---|---|---|
| Infrastructure | Docker | Connection CRUD, test |
| Infrastructure | Pi-hole | Connection CRUD, test |
| Media | Photo Sources | Folder source CRUD, rescan, image counts |
| Media | Spotify | OAuth connect/disconnect, status |
| Productivity | Calendars | Calendar sync settings |
| Productivity | Todo | Todo provider settings |

## Route Changes

| Old Route | New Route | Action |
|---|---|---|
| `/settings?tab=general` | `/settings?tab=general` | Unchanged |
| `/settings?tab=shell` | `/settings?tab=appearance` | Rename |
| `/settings?tab=customization` | `/settings?tab=integrations` | Rename |
| `/admin/dashboards` | `/settings?tab=dashboards` | Move + redirect |
| `/admin/groups` | `/settings?tab=groups` | Move + redirect |

Old routes (`/admin/dashboards`, `/admin/groups`, `?tab=shell`, `?tab=customization`) redirect to their new locations for backward compatibility.

## Migration Summary

| Setting | From | To |
|---|---|---|
| Theme toggle | General | General (stays) |
| My dashboard prefs | General | General (stays) |
| Logo upload | General | Appearance > Branding |
| Site title/font/size | Shell & Appearance | Appearance > Branding |
| Header height | Shell & Appearance | Appearance > Header & Clock |
| Clock strip (all) | Customization > Clock Strip | Appearance > Header & Clock |
| Footer/repo URL | Shell & Appearance | Appearance > Footer |
| Screensaver (behavior) | Customization > Screensaver | Appearance > Screensaver |
| Photo source CRUD | Inside Screensaver tab | Integrations > Photo Sources |
| Public default dashboards | Shell & Appearance | Dashboards |
| Dashboard CRUD | `/admin/dashboards` page | Dashboards tab |
| Groups/RBAC | `/admin/groups` page | Groups & Access tab |

## Non-Goals
- No backend API changes (all existing endpoints remain, just consumed from different UI locations)
- No database schema changes
- No new features — purely reorganization of existing UI
- No changes to widget config forms (they already pick connections/sources correctly)

## Risks
- **Shell settings API is monolithic** — one PUT saves everything. Panels that save subsets must merge with current server state to avoid resetting other fields. Already solved pattern from Clock Strip panel.
- **Large refactor surface** — touching many files. Mitigated by phased approach and comprehensive typecheck/lint/test after each phase.
