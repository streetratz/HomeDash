# Data Model — RBAC: User Groups and Granular Permissions

## Table of Contents

- [Entity: Group](#entity-group)
- [Entity: Group Permission](#entity-group-permission)
- [Entity: User–Group Membership](#entity-usergroup-membership)
- [Entity: Dashboard Access Rule](#entity-dashboard-access-rule)
- [Modified Entity: Users (existing)](#modified-entity-users-existing)
- [Permission Categories & Levels](#permission-categories--levels)
- [Relationships Diagram](#relationships-diagram)
- [Seed Data](#seed-data)
- [Migration Notes](#migration-notes)

---

## Entity: Group

| Field       | Type    | Constraints                          | Notes                                      |
|-------------|---------|--------------------------------------|--------------------------------------------|
| id          | TEXT    | PK, UUID                            | Server-generated UUID                      |
| name        | TEXT    | NOT NULL, UNIQUE, 1–50 chars         | Validated at service layer via Zod          |
| description | TEXT    | NULLABLE, max 200 chars              | Optional human-readable description        |
| isBuiltIn   | INTEGER | NOT NULL, DEFAULT 0 (boolean mode)   | 1 for Administrators/Users/Viewers         |
| createdAt   | TEXT    | NOT NULL, ISO8601                    | Server-generated timestamp                 |
| updatedAt   | TEXT    | NOT NULL, ISO8601                    | Updated on any group edit                  |

**Validation rules**:
- `name`: 1–50 characters, unique, trimmed, no leading/trailing whitespace
- `description`: 0–200 characters
- Built-in groups (`isBuiltIn = 1`) cannot be deleted (FR-005)
- Administrators group permissions cannot be modified (assumption: always full access)

**Indexes**: `groups_name_idx` UNIQUE on `name`

---

## Entity: Group Permission

| Field    | Type | Constraints                                       | Notes                              |
|----------|------|---------------------------------------------------|------------------------------------|
| id       | TEXT | PK, UUID                                          | Server-generated UUID              |
| groupId  | TEXT | NOT NULL, FK → groups.id (CASCADE DELETE)          | Which group holds this permission  |
| category | TEXT | NOT NULL, enum                                     | Permission category (see below)    |
| level    | TEXT | NOT NULL, enum: 'view' \| 'manage'                | Access level within category       |

**Validation rules**:
- `category` must be one of the defined permission categories
- `level` must be 'view' or 'manage'
- Each (groupId, category) pair should have at most one row; 'manage' implies 'view'
- When `level` = 'manage', the group has full control for that category (including view)

**Indexes**: `group_permissions_group_id_idx` on `groupId`; `group_permissions_unique_idx` UNIQUE on `(groupId, category)`

---

## Entity: User–Group Membership

| Field     | Type | Constraints                                       | Notes                         |
|-----------|------|---------------------------------------------------|-------------------------------|
| id        | TEXT | PK, UUID                                          | Server-generated UUID         |
| userId    | TEXT | NOT NULL, FK → users.id (CASCADE DELETE)           | The user                      |
| groupId   | TEXT | NOT NULL, FK → groups.id (CASCADE DELETE)          | The group                     |
| createdAt | TEXT | NOT NULL, ISO8601                                  | When membership was created   |

**Validation rules**:
- Each (userId, groupId) pair must be unique — a user cannot be added to the same group twice
- The last member of the Administrators group cannot be removed (FR-013)
- When a group is deleted, memberships are cascade-deleted

**Indexes**: `user_group_memberships_user_id_idx` on `userId`; `user_group_memberships_unique_idx` UNIQUE on `(userId, groupId)`

---

## Entity: Dashboard Access Rule

| Field       | Type | Constraints                                       | Notes                                  |
|-------------|------|---------------------------------------------------|----------------------------------------|
| id          | TEXT | PK, UUID                                          | Server-generated UUID                  |
| dashboardId | TEXT | NOT NULL, FK → dashboards.id (CASCADE DELETE)      | Target dashboard                       |
| groupId     | TEXT | NOT NULL, FK → groups.id (CASCADE DELETE)          | Which group gets access                |
| accessLevel | TEXT | NOT NULL, enum: 'view' \| 'edit'                  | Level of access granted                |

**Validation rules**:
- Each (dashboardId, groupId, accessLevel) must be unique
- When no rules exist for a dashboard, all groups have access (FR-016)
- Administrators group bypasses all rules (FR-017) — enforced at query level, not stored

**Indexes**: `dashboard_access_rules_dashboard_id_idx` on `dashboardId`; `dashboard_access_rules_unique_idx` UNIQUE on `(dashboardId, groupId, accessLevel)`

**State transitions**: A dashboard transitions between two access states:
- **Open** (default): No rows in `dashboard_access_rules` → all groups can view and edit (subject to group permissions)
- **Restricted**: One or more rows → only listed groups have the specified access level

---

## Modified Entity: Users (existing)

The existing `users` table is **not** structurally modified. The `role` column is preserved read-only per FR-021.

| Field | Change | Notes |
|-------|--------|-------|
| role  | Kept as-is | Legacy column; not used for authorization after migration. Preserved for rollback safety. |

The `AuthUser` type in `authMiddleware.ts` will be extended with:
```typescript
interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'standard';       // legacy, kept for compatibility
  permissions: Set<string>;          // NEW: effective permissions from groups
  groupIds: string[];                // NEW: group IDs user belongs to
  isAdmin: boolean;                  // NEW: shorthand for "member of Administrators group"
}
```

---

## Permission Categories & Levels

Per FR-007 and FR-008:

| Category              | Slug              | View                              | Manage                                    |
|-----------------------|-------------------|-----------------------------------|-------------------------------------------|
| Dashboard Management  | `dashboards`      | View dashboard list and content   | Create, edit, delete, reorder dashboards  |
| Widget Configuration  | `widgets`         | View widget settings              | Add, edit, remove, configure widgets      |
| System Settings       | `settings`        | View system settings              | Modify shell, clock, screensaver settings |
| User Management       | `users`           | View user list                    | Create, edit, delete users; manage groups |
| Integrations          | `integrations`    | View connected integrations       | Add, edit, remove OAuth/CalDAV accounts   |

**Permission string format**: `{slug}:{level}` — e.g., `dashboards:manage`, `settings:view`

**Additive union (FR-010)**: When computing effective permissions, `manage` supersedes `view` for the same category. If Group A grants `dashboards:view` and Group B grants `dashboards:manage`, the user has `dashboards:manage`.

---

## Relationships Diagram

```
users ──< user_group_memberships >── groups ──< group_permissions
                                       │
                                       │
dashboards ──< dashboard_access_rules >┘
```

- `users` 1:N `user_group_memberships` N:1 `groups` (many-to-many)
- `groups` 1:N `group_permissions` (one-to-many)
- `dashboards` 1:N `dashboard_access_rules` N:1 `groups` (many-to-many)

---

## Seed Data

### Built-in Groups

| Name           | isBuiltIn | Permissions                                                                                |
|----------------|-----------|--------------------------------------------------------------------------------------------|
| Administrators | 1         | All categories at 'manage' level                                                           |
| Users          | 1         | `dashboards:view`, `widgets:view`, `settings:view`, `integrations:view`                    |
| Viewers        | 1         | `dashboards:view`                                                                          |

### Migration Mapping (FR-019)

| Legacy `role` | Target Group   |
|---------------|----------------|
| `admin`       | Administrators |
| `standard`    | Users          |

---

## Migration Notes

1. **New tables**: `groups`, `group_permissions`, `user_group_memberships`, `dashboard_access_rules`
2. **Seed on migration**: Insert 3 built-in groups + their permission rows using `INSERT OR IGNORE`
3. **User mapping**: `INSERT OR IGNORE INTO user_group_memberships SELECT ... FROM users WHERE role = 'admin'` (and similarly for 'standard' → Users)
4. **Legacy column**: `users.role` is NOT dropped — preserved for rollback
5. **Idempotency**: All seed/mapping SQL uses `INSERT OR IGNORE` keyed on unique constraints
