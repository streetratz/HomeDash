# Data Model: User Management

**Feature**: 038-user-management
**Date**: 2026-06-22

## Table of Contents
- [Entities](#entities)
- [Schema Changes](#schema-changes)
- [Relationships](#relationships)
- [Validation Rules](#validation-rules)
- [State Transitions](#state-transitions)

---

## Entities

### User (existing — extended)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | UUID v4, generated on creation |
| username | TEXT | NOT NULL, UNIQUE INDEX | Immutable after creation |
| displayName | TEXT | NOT NULL | 1–100 characters |
| role | TEXT | NOT NULL, ENUM('admin', 'standard') | Default: 'standard' |
| passwordHash | TEXT | NOT NULL | argon2id hash, never exposed via API |
| lastLoginAt | TEXT | NULLABLE | ISO 8601 timestamp, NEW FIELD |
| createdAt | TEXT | NOT NULL | ISO 8601 timestamp |
| updatedAt | TEXT | NOT NULL | ISO 8601 timestamp |

### Session (existing — no changes)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | Session token |
| userId | TEXT | NOT NULL, FK → users.id (CASCADE) | Owning user |
| createdAt | TEXT | NOT NULL | ISO 8601 |
| expiresAt | TEXT | NOT NULL | ISO 8601 |
| lastSeenAt | TEXT | NOT NULL | ISO 8601, updated on activity |
| csrfSecret | TEXT | NOT NULL | Per-session CSRF secret |

### Group (existing — no changes)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL, UNIQUE INDEX | Group display name |
| slug | TEXT | UNIQUE INDEX | URL-safe identifier |
| description | TEXT | NULLABLE | Optional description |
| isBuiltIn | INTEGER | NOT NULL, DEFAULT false | System groups |
| createdAt | TEXT | NOT NULL | ISO 8601 |
| updatedAt | TEXT | NOT NULL | ISO 8601 |

### UserGroupMembership (existing — no changes)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| userId | TEXT | NOT NULL, FK → users.id (CASCADE) | Member user |
| groupId | TEXT | NOT NULL, FK → groups.id (CASCADE) | Target group |
| createdAt | TEXT | NOT NULL | ISO 8601 |
| | | UNIQUE(userId, groupId) | Prevents duplicates |

---

## Schema Changes

### Migration: Add `lastLoginAt` to `users`

```sql
ALTER TABLE users ADD COLUMN last_login_at TEXT;
```

**Drizzle schema change** in `backend/src/db/schema/index.ts`:
```ts
export const users = sqliteTable('users', {
  // ... existing fields ...
  lastLoginAt: text('last_login_at'),  // NEW — nullable
}, (t) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(t.username),
}));
```

**Migration notes**:
- Non-breaking: new nullable column, no default needed.
- Existing users will have `lastLoginAt = null` until their next login.
- Generate migration: `pnpm --filter backend drizzle-kit generate`
- Apply migration: automatic on app startup (Drizzle push/migrate).

---

## Relationships

```
┌──────────┐       1:N       ┌──────────────┐
│  users   │────────────────▶│   sessions   │
│          │                 │              │
│ id (PK)  │◀─── userId ────│ userId (FK)  │
└──────────┘                 └──────────────┘
     │
     │ 1:N
     ▼
┌────────────────────────┐       N:1       ┌──────────┐
│ user_group_memberships │────────────────▶│  groups   │
│                        │                 │           │
│ userId (FK)            │                 │ id (PK)   │
│ groupId (FK)           │◀─── groupId ───│           │
└────────────────────────┘                 └───────────┘
```

- **User → Sessions**: One user has many sessions. Cascade delete (user deletion removes all sessions).
- **User → UserGroupMemberships**: One user has many memberships. Cascade delete.
- **Group → UserGroupMemberships**: One group has many memberships. Cascade delete.
- **User ↔ Group**: Many-to-many through `user_group_memberships`.

---

## Validation Rules

### Display Name
- Required (non-empty after trimming whitespace)
- Maximum 100 characters
- Whitespace-only values treated as empty → validation error

### Username
- Required, unique (case-sensitive, enforced by unique index)
- Immutable after creation
- No specific format constraints in spec (follow existing pattern)

### Password
- Minimum 8 characters (all password operations: create, self-change, admin reset)
- Confirmation must match new password (self-service change only — frontend validation)
- Current password verification required for self-service change (server-side)
- Stored as argon2id hash (never returned in API responses)

### Role
- Must be one of: `'admin'`, `'standard'`
- Cannot demote the last admin (server-side count check)
- Admin cannot change their own role (prevents self-lockout)

### Group Assignments
- Array of valid group IDs
- Invalid group IDs silently ignored or return 400 (follow existing pattern)
- Empty array removes all group memberships

---

## State Transitions

### User Lifecycle

```
[Created by Admin] ──▶ Active ──▶ [Deleted by Admin]
                        │
                        ├── Display name updated (self or admin)
                        ├── Password changed (self or admin reset)
                        ├── Role changed (admin only, not self, not last admin)
                        └── Groups updated (admin only)
```

### Session Lifecycle (relevant to this feature)

```
[Login] ──▶ Active ──▶ [Expired / Logged out / Invalidated]
                              │
              Invalidation triggers:
              ├── User changes own password → invalidate OTHER sessions
              ├── Admin resets user password → invalidate ALL user sessions
              └── Admin deletes user → CASCADE deletes all sessions
```

### Admin Protection State Machine

```
On role change request:
  IF target is self → REJECT (409)
  IF current role is 'admin' AND new role is not 'admin':
    COUNT admins → IF count <= 1 → REJECT (409: last admin)
  ELSE → ALLOW

On user delete request:
  IF target is self → REJECT (409)
  IF target role is 'admin':
    COUNT admins → IF count <= 1 → REJECT (409: last admin)
  ELSE → ALLOW, cascade delete sessions
```
