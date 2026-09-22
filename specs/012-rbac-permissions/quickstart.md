# Quickstart — RBAC: User Groups and Granular Permissions

## Overview

This feature replaces HomeDash's binary admin/user role system with group-based RBAC. Users are assigned to one or more groups, each group has a configurable set of permissions, and the user's effective permissions are the additive union of all their groups' permissions.

## What Changes

### For Existing Users (Upgrade)

**Nothing breaks.** On upgrade:
- The migration automatically creates three built-in groups: **Administrators**, **Users**, **Viewers**
- Existing `admin` users → Administrators group (full access)
- Existing `standard` users → Users group (view + interact)
- The legacy `role` column on users is preserved (read-only) for rollback safety
- No manual steps required

### For Administrators

**New admin section: Groups & Permissions** (under Settings):
1. **View groups** — see all groups, their permissions, and member counts
2. **Create custom groups** — name, description, and pick permissions from 5 categories
3. **Edit groups** — change name, description, or permissions for custom groups (and Users/Viewers)
4. **Delete custom groups** — removes the group; members lose only that group's unique permissions
5. **Assign users to groups** — from the user management page or group detail page
6. **Per-dashboard access** (P2) — restrict which groups can view/edit specific dashboards

### For All Users

- **Permission-aware UI** (P2) — controls you can't use are hidden; direct URL access shows "access denied"
- **View My Permissions** (P3) — see your groups and effective permissions on the profile page

## Permission Categories

| Category     | View                      | Manage                                |
|--------------|---------------------------|---------------------------------------|
| Dashboards   | View dashboard list       | Create, edit, delete dashboards       |
| Widgets      | View widget settings      | Add, edit, remove widgets             |
| Settings     | View system settings      | Modify system settings                |
| Users        | View user list            | Create/edit/delete users, manage groups |
| Integrations | View integrations         | Add, edit, remove integrations        |

## New Environment Variables

None. This feature uses the existing database and authentication infrastructure.

## New API Endpoints

| Method | Path                                          | Permission Required   | Purpose                     |
|--------|-----------------------------------------------|-----------------------|-----------------------------|
| GET    | `/api/admin/groups`                            | `users:view`          | List all groups             |
| POST   | `/api/admin/groups`                            | `users:manage`        | Create a custom group       |
| GET    | `/api/admin/groups/:groupId`                   | `users:view`          | Get group details           |
| PATCH  | `/api/admin/groups/:groupId`                   | `users:manage`        | Update group                |
| DELETE | `/api/admin/groups/:groupId`                   | `users:manage`        | Delete custom group         |
| GET    | `/api/admin/groups/:groupId/members`           | `users:view`          | List group members          |
| POST   | `/api/admin/groups/:groupId/members`           | `users:manage`        | Add member to group         |
| DELETE | `/api/admin/groups/:groupId/members/:userId`   | `users:manage`        | Remove member from group    |
| GET    | `/api/admin/users/:userId/groups`              | `users:view` or self  | List user's groups          |
| GET    | `/api/admin/dashboards/:id/access`             | `dashboards:manage`   | Get dashboard ACL (P2)      |
| PUT    | `/api/admin/dashboards/:id/access`             | `dashboards:manage`   | Set dashboard ACL (P2)      |

The existing `GET /api/auth/me` response is extended with `groups`, `permissions`, and `isAdmin` fields.

## Database Changes

Four new tables:
- `groups` — named permission groups
- `group_permissions` — category:level pairs per group
- `user_group_memberships` — user ↔ group many-to-many
- `dashboard_access_rules` — per-dashboard group access (P2)

Migration is fully automatic and idempotent. See `data-model.md` for complete schema.

## Threat Model Notes

- **Server-side enforcement**: All permission checks happen on the backend. Frontend hiding is cosmetic only (NFR-001).
- **CSRF protection**: All state-changing RBAC endpoints require the existing `x-csrf-token` header.
- **Admin lockout prevention**: The system prevents removing the last user from the Administrators group.
- **No privilege escalation**: Only users with `users:manage` can modify groups/memberships. The Administrators group always has full access and its permissions cannot be reduced.
- **Legacy role preserved**: The `users.role` column is kept for rollback; it is not used for authorization decisions after migration.
