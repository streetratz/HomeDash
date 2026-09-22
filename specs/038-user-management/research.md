# Research: User Management

**Feature**: 038-user-management
**Date**: 2026-06-22

## Table of Contents
- [R-01: Schema Migration for lastLoginAt](#r-01-schema-migration-for-lastloginat)
- [R-02: Session Invalidation Pattern](#r-02-session-invalidation-pattern)
- [R-03: Self-Service Profile Update Pattern](#r-03-self-service-profile-update-pattern)
- [R-04: Admin CRUD Route Pattern](#r-04-admin-crud-route-pattern)
- [R-05: Last Admin Protection](#r-05-last-admin-protection)
- [R-06: Group Membership Management in User Edit](#r-06-group-membership-management-in-user-edit)
- [R-07: Password Validation Strategy](#r-07-password-validation-strategy)
- [R-08: Frontend Admin Tab Pattern](#r-08-frontend-admin-tab-pattern)

---

## R-01: Schema Migration for lastLoginAt

**Context**: The spec requires displaying "last login time" in the admin user list (FR-007). The current `users` table lacks a `lastLoginAt` field.

**Decision**: Add `lastLoginAt` column to the `users` table via Drizzle migration.

**Rationale**:
- The `sessions.lastSeenAt` field tracks session activity but not login events specifically.
- A dedicated `lastLoginAt` on the user record is simpler to query for the admin user list than aggregating session data.
- The field should be nullable (existing users won't have a value until they next log in).
- Updated on each successful login in the auth login handler.

**Alternatives considered**:
- *Derive from sessions table*: Would require `MAX(createdAt) FROM sessions WHERE userId = ?` per user — adds query complexity for the admin list endpoint. Rejected for simplicity.
- *Add a separate `user_events` table*: Over-engineered for this use case. Could be added later if full audit logging is needed.

**Implementation**:
- Add `lastLoginAt: text('last_login_at')` to the `users` schema (nullable, ISO 8601 string).
- Generate Drizzle migration: `pnpm drizzle-kit generate`.
- Update `POST /api/auth/login` to set `lastLoginAt` on successful authentication.

---

## R-02: Session Invalidation Pattern

**Context**: FR-005 requires invalidating all active sessions when a password is changed (by self or admin). The existing `sessionStore.ts` has `destroySession(id)` for single session removal.

**Decision**: Add a `destroyUserSessions(userId, excludeSessionId?)` function to `sessionStore.ts`.

**Rationale**:
- Direct `DELETE FROM sessions WHERE user_id = ? AND id != ?` is simple and efficient.
- The `excludeSessionId` parameter allows self-service password change to keep the current session active (optional — spec says "all other sessions").
- Consistent with the existing session store pattern.

**Alternatives considered**:
- *Token versioning*: Add a `passwordVersion` counter to users and check on each request. More complex, adds overhead to every request. Rejected — direct deletion is simpler for < 50 users.
- *Redis pub/sub for realtime invalidation*: Over-engineered. SQLite delete is immediate and sufficient.

**Implementation**:
```ts
export function destroyUserSessions(userId: string, excludeSessionId?: string): void {
  if (excludeSessionId) {
    db.delete(sessions).where(
      and(eq(sessions.userId, userId), ne(sessions.id, excludeSessionId))
    ).run();
  } else {
    db.delete(sessions).where(eq(sessions.userId, userId)).run();
  }
}
```

---

## R-03: Self-Service Profile Update Pattern

**Context**: Self-service display name update and password change need to be added. The existing `user.ts` has `GET/PUT /api/user/preferences` for theme/dashboard preferences.

**Decision**: Add two new endpoints to the existing `user.ts` route file:
- `PUT /api/user/profile` — update display name
- `PUT /api/user/password` — change password (requires current password)

**Rationale**:
- Follows the existing `user.ts` pattern: authenticated user routes scoped to the logged-in user.
- Separate endpoints for profile vs. password because password change has additional security requirements (current password verification, session invalidation).
- Display name update is a simple field patch; password change is a multi-step secure operation.

**Alternatives considered**:
- *Single PATCH /api/user/profile for everything*: Mixes concerns — display name is a simple update, password is a security operation. Rejected for clarity and security.
- *Extend PUT /api/user/preferences*: Preferences are theme/dashboard settings. Profile data (name, password) is semantically different. Rejected to avoid scope creep on an existing endpoint.

---

## R-04: Admin CRUD Route Pattern

**Context**: Admin user management requires list, create, update, delete, and password reset endpoints.

**Decision**: Create `backend/src/api/admin-users.ts` following the `admin-groups.ts` pattern exactly:
- `GET /api/admin/users` — list all users with group memberships
- `POST /api/admin/users` — create user
- `PUT /api/admin/users/:userId` — update user (display name, role, group assignments)
- `DELETE /api/admin/users/:userId` — delete user
- `PUT /api/admin/users/:userId/password` — reset password

**Rationale**:
- Mirrors the established `admin-groups.ts` pattern: `requirePermission` + `assertCsrf` + Zod validation + service calls.
- RESTful resource naming consistent with existing `/api/admin/groups`.
- Group assignment handled within the user update endpoint (receives array of groupIds, syncs memberships).

**Alternatives considered**:
- *Separate routes for group assignment*: Like `admin-group-members.ts`. More granular but adds unnecessary API surface. The user edit form submits all data at once. Rejected for simplicity.
- *GraphQL*: Not used anywhere in the project. Rejected.

---

## R-05: Last Admin Protection

**Context**: FR-013 (admin cannot delete self) and FR-015 (cannot remove/demote last admin) require server-side enforcement.

**Decision**: Implement two server-side guards:
1. **Self-deletion guard**: Compare `request.user.id` with target `userId` on DELETE. Return 409 Conflict.
2. **Last-admin guard**: Before role demotion or user deletion, count admins: `SELECT COUNT(*) FROM users WHERE role = 'admin'`. If count would drop to 0, return 409 Conflict.

**Rationale**:
- Server-side enforcement is mandatory — frontend checks are advisory only.
- 409 Conflict is semantically correct (the request conflicts with the current state of the resource).
- Checking admin count at operation time handles race conditions naturally (SQLite serializes writes).

**Alternatives considered**:
- *Return 403 Forbidden*: Semantically incorrect — the user has permission, the operation just conflicts with business rules. Rejected.
- *Soft-delete instead of hard-delete*: Over-engineered for < 50 users. Can be added later. Rejected.

---

## R-06: Group Membership Management in User Edit

**Context**: FR-010 requires admins to edit group assignments through the user edit form. Group management already exists via `admin-groups.ts` and `admin-group-members.ts`.

**Decision**: The admin user update endpoint (`PUT /api/admin/users/:userId`) accepts an optional `groupIds: string[]` field. When present, it syncs the user's group memberships (delete removed, insert added) within the same transaction.

**Rationale**:
- The user edit form presents a multi-select of groups. Submitting the full list of desired groups is simpler than tracking individual add/remove operations.
- Sync approach: delete all existing memberships, insert new ones. Simple and correct for small datasets.
- Wraps in a transaction with the user update for atomicity.

**Alternatives considered**:
- *Diff-based add/remove*: More efficient but more complex. For < 50 groups, the difference is negligible. Rejected for simplicity.
- *Separate API call for group assignment*: Requires multiple requests from the UI, adds complexity. Rejected.

---

## R-07: Password Validation Strategy

**Context**: FR-004 requires 8-character minimum for all password operations. Need consistent validation across self-service and admin endpoints.

**Decision**: Create a shared Zod schema for password validation, reused across all password-accepting endpoints.

**Rationale**:
- Single source of truth for password rules.
- Zod integrates with the existing validation pattern (`validate(schema, request.body)`).
- Client-side validation mirrors server-side for UX, but server is authoritative.

**Implementation**:
```ts
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
```

**Alternatives considered**:
- *Complexity rules (uppercase, number, symbol)*: Not specified in requirements. KISS for a household app. Can be added later.
- *Password strength meter (zxcvbn)*: Out of scope. Not in spec.

---

## R-08: Frontend Admin Tab Pattern

**Context**: Need to add a "Users" tab to Settings page and build the admin user management UI.

**Decision**: Follow the `GroupsTab.tsx` pattern exactly:
- New `UsersTab.tsx` component with a user list table (Card-based, not DataTable) and dialog-based create/edit/delete flows.
- New `frontend/src/state/users.ts` with TanStack Query hooks mirroring `rbac.ts` pattern.
- Settings page adds `{isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}` in the tab list.

**Rationale**:
- Consistent UI patterns reduce cognitive load and maintenance burden.
- Dialog-based CRUD avoids page navigation, consistent with existing admin UX.
- TanStack Query hooks provide cache invalidation and optimistic updates.

**Alternatives considered**:
- *Separate admin page (not a tab)*: Inconsistent with existing admin features living in Settings tabs. Rejected.
- *shadcn DataTable component*: Not used anywhere else in the project. The simpler Card + map pattern from GroupsTab is sufficient for < 50 users. Rejected for consistency.
