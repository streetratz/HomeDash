# Research — RBAC: User Groups and Granular Permissions

## Table of Contents

- [R-01: Permission Storage Strategy](#r-01-permission-storage-strategy)
- [R-02: Migration Strategy for Binary Roles → Groups](#r-02-migration-strategy-for-binary-roles--groups)
- [R-03: Permission Check Performance](#r-03-permission-check-performance)
- [R-04: Session Invalidation on Group Change](#r-04-session-invalidation-on-group-change)
- [R-05: Dashboard-Level ACL Pattern](#r-05-dashboard-level-acl-pattern)
- [R-06: Frontend Permission Gating Pattern](#r-06-frontend-permission-gating-pattern)

---

## R-01: Permission Storage Strategy

**Question**: Should permissions be stored as a normalized join table (group ↔ permission rows) or as a JSON column on the groups table?

**Decision**: Normalized join table (`group_permissions`) with `group_id`, `category`, and `level` columns.

**Rationale**: The permission set is small and well-defined (5 categories × 2 levels = 10 possible values), but a normalized table enables:
- Direct SQL queries for "which groups have permission X?" (needed for dashboard ACL filtering)
- Clean Drizzle ORM relations without JSON parsing
- Index-backed lookups for permission checks
- Easy future expansion if permission categories grow

**Alternatives considered**:
- **JSON column on groups**: Simpler schema but cannot be indexed, requires parsing in every query, and Drizzle has no typed JSON column support for SQLite. Rejected.
- **Bitfield/bitmask**: Compact but fragile — adding new permissions requires careful bit position management and is error-prone in migrations. Rejected.

---

## R-02: Migration Strategy for Binary Roles → Groups

**Question**: How should the Drizzle migration handle the transition from `users.role` to group-based RBAC?

**Decision**: Two-phase Drizzle migration:
1. **Schema migration** (Drizzle-generated): Create `groups`, `group_permissions`, `user_group_memberships` tables.
2. **Data migration** (custom SQL in the same migration file): Seed built-in groups, map existing `admin` → Administrators, `standard` → Users.

The legacy `users.role` column is preserved as read-only per FR-021 for rollback safety.

**Rationale**: Drizzle's `generate` produces schema DDL but not data seeding. A custom SQL block appended to the generated migration handles the seed + mapping atomically. SQLite transactions ensure the migration is all-or-nothing.

**Alternatives considered**:
- **Application-level seeding on startup**: Races possible if multiple instances start simultaneously; also couples boot logic to migration state. Rejected for the core seed (acceptable for runtime validation/repair).
- **Separate Drizzle migration for data**: Drizzle doesn't natively support data-only migration files. Using a second schema migration to trigger custom SQL is awkward. Rejected.

**Idempotency (FR-020)**: The seed SQL uses `INSERT OR IGNORE` (SQLite) for built-in groups and `INSERT OR IGNORE` for user→group mappings, keyed on user_id + group_id unique constraint.

---

## R-03: Permission Check Performance

**Question**: How should per-request permission checks work without adding noticeable latency (NFR-006)?

**Decision**: Eager-load effective permissions into the session on login/session-load and cache them on `request.user`. The auth middleware joins through `user_group_memberships` → `group_permissions` and computes the additive union once per request, storing the result as a `Set<string>` on the `AuthUser` object.

**Rationale**: better-sqlite3 is synchronous and fast — a single joined query for a user's permissions adds <1ms to request processing. Caching per-request (not per-session-store) means group changes take effect on the next request (FR: SC-005) without session invalidation.

**Alternatives considered**:
- **Memoize in session store (Redis-style)**: HomeDash uses SQLite, not Redis. Adding an in-memory cache requires invalidation logic. Overkill for <1ms queries. Rejected.
- **Lazy-load on first permission check per request**: Adds complexity (nullable permission set, checking if loaded). Since the middleware already does a DB join for session lookup, adding the permission join is trivial. Rejected.

---

## R-04: Session Invalidation on Group Change

**Question**: When an admin changes a user's group membership, how quickly do the new permissions take effect?

**Decision**: No explicit session invalidation needed. Permissions are loaded fresh on every request via the auth middleware's session lookup query. Per SC-005, the next request after a group change reflects updated permissions.

**Rationale**: The session store (`getSession()`) already joins `sessions` → `users`. Extending this join to include `user_group_memberships` → `group_permissions` means permissions are always current. This is possible because better-sqlite3 queries are synchronous and sub-millisecond.

**Alternatives considered**:
- **WebSocket push to force UI refresh**: Adds infrastructure complexity; the spec only requires "next action" to reflect changes, not real-time push. Can be added later. Rejected for MVP.
- **Session version counter**: Increment a version on the user row when groups change; invalidate cached permissions if version mismatches. Unnecessary when we load fresh every request. Rejected.

---

## R-05: Dashboard-Level ACL Pattern

**Question**: How should per-dashboard access control (P2, FR-015–018) be modeled?

**Decision**: A `dashboard_access_rules` table with columns: `dashboard_id`, `group_id`, `access_level` (enum: 'view', 'edit'). When no rows exist for a dashboard, it is accessible to all groups (FR-016). When rows exist, only listed groups have access at the specified level. Administrators bypass all restrictions (FR-017).

**Rationale**: This is a standard ACL pattern. The join from dashboards → access_rules → user's groups is efficient in SQLite. An empty rule set = "public to all authenticated users" avoids needing to create rules for every group on every dashboard.

**Alternatives considered**:
- **JSON ACL column on dashboards**: Cannot be indexed or joined. Would require loading all dashboards and filtering in application code. Rejected.
- **Separate view_groups and edit_groups JSON arrays**: Partially normalized but still un-indexable. Rejected.

---

## R-06: Frontend Permission Gating Pattern

**Question**: How should the React frontend conditionally render UI elements based on permissions?

**Decision**: 
1. The `/api/auth/me` endpoint returns the user's effective permissions as an array of permission strings (e.g., `["dashboards:manage", "settings:view"]`).
2. A React context (`PermissionsContext`) provides a `hasPermission(category, level)` helper.
3. Components use `hasPermission()` to conditionally render or disable controls.
4. Route-level guards redirect to an "access denied" page for direct URL access.

**Rationale**: TanStack Query already caches the `/api/auth/me` response. Adding permissions to this payload means no additional network request. A context provider is the standard React pattern for cross-cutting concerns.

**Alternatives considered**:
- **Separate `/api/permissions` endpoint**: Adds a network request and requires cache coordination with the auth state. Unnecessary when `/api/auth/me` can include permissions. Rejected.
- **Higher-order component (HOC) pattern**: Less idiomatic in modern React than hooks + context. Rejected.
