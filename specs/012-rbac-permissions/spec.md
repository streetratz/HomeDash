# Feature Specification: RBAC — User Groups and Granular Permissions

**Feature Branch**: `012-rbac-permissions`  
**Created**: 2025-07-24  
**Status**: Draft  
**GitHub Issue**: #26  
**Input**: User description: "Replace the current binary admin/user role system with a proper group-based RBAC model, allowing fine-grained control over who can do what."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Backward-Compatible Migration (Priority: P1)

When the system is upgraded, the existing binary admin/user role data is automatically migrated to the new group-based model. Existing admins are placed in the built-in "Administrators" group and existing standard users are placed in the built-in "Users" group. No manual intervention is required and no user loses access to anything they could previously access.

**Why this priority**: Without a safe migration, every other story is blocked. Existing deployments must upgrade without disruption.

**Independent Test**: Can be fully tested by upgrading a database that has existing admin and standard-user accounts and verifying each user retains identical capabilities afterward.

**Acceptance Scenarios**:

1. **Given** an existing HomeDash instance with users in the "admin" role, **When** the system is upgraded, **Then** each admin user is a member of the "Administrators" group with full access.
2. **Given** an existing HomeDash instance with users in the "user" role, **When** the system is upgraded, **Then** each standard user is a member of the "Users" group with view-and-interact access.
3. **Given** a freshly upgraded instance, **When** any user logs in, **Then** they experience no change in what they can see or do compared to before the upgrade.

---

### User Story 2 — Manage User Groups (Priority: P1)

An administrator can create, view, edit, and delete user groups. Each group has a name, an optional description, and a configurable set of permissions drawn from defined permission categories. The three built-in groups (Administrators, Users, Viewers) cannot be deleted but their permissions can be viewed (and for Users/Viewers, edited).

**Why this priority**: Groups are the core building block of the entire RBAC model; every other story depends on groups existing.

**Independent Test**: Can be fully tested by logging in as an admin, creating a custom group, assigning permissions, editing the group, and deleting it.

**Acceptance Scenarios**:

1. **Given** an authenticated administrator, **When** they create a new group named "Power Users" with dashboard-management and widget-config permissions, **Then** the group appears in the group list with those permissions.
2. **Given** an existing custom group, **When** an admin edits its permissions to add settings access, **Then** the updated permissions are saved and reflected immediately.
3. **Given** an existing custom group with no members, **When** an admin deletes it, **Then** the group is removed from the system.
4. **Given** a built-in group (Administrators, Users, or Viewers), **When** an admin attempts to delete it, **Then** the system prevents deletion and displays an explanation.

---

### User Story 3 — Assign Users to Groups (Priority: P1)

An administrator can assign any user to one or more groups. A user's effective permissions are the additive union of all permissions from every group they belong to. An administrator can also remove a user from a group.

**Why this priority**: Without user-to-group assignment, groups have no effect. This completes the minimum viable permission model.

**Independent Test**: Can be fully tested by assigning a user to two groups with different permissions and verifying the user can perform actions allowed by either group.

**Acceptance Scenarios**:

1. **Given** a user who belongs only to "Viewers", **When** an admin also adds them to "Power Users" (which has widget-config permission), **Then** the user can both view dashboards and configure widgets.
2. **Given** a user who belongs to two groups, **When** an admin removes them from one group, **Then** the user loses only the permissions unique to the removed group.
3. **Given** an admin attempting to remove the last administrator from the "Administrators" group, **When** they confirm the action, **Then** the system prevents the removal and displays a warning that at least one administrator must exist.

---

### User Story 4 — Per-Dashboard Access Control (Priority: P2)

An administrator (or any user with dashboard-management permission) can restrict which groups may view or edit a specific dashboard. By default, a newly created dashboard is accessible to all groups. Access can be narrowed to specific groups for viewing and a (possibly different) subset for editing.

**Why this priority**: Dashboard-level access control is a high-value differentiator but the system is usable with only group-level permissions (P1 stories).

**Independent Test**: Can be fully tested by creating a dashboard, restricting it to one group, and verifying users outside that group cannot see it.

**Acceptance Scenarios**:

1. **Given** a dashboard with default access, **When** an admin restricts view access to the "Power Users" group only, **Then** users not in "Power Users" no longer see that dashboard in their list.
2. **Given** a dashboard restricted to "Power Users" for editing, **When** a user in "Viewers" navigates to it (if they have view access), **Then** they can see the dashboard but cannot modify it.
3. **Given** a dashboard with group restrictions, **When** an admin reverts it to "all groups", **Then** every authenticated user can see and interact with the dashboard according to their group permissions.
4. **Given** a user in the "Administrators" group, **When** any dashboard has group restrictions, **Then** the administrator can always view and edit every dashboard regardless of restrictions.

---

### User Story 5 — Permission-Aware UI (Priority: P2)

The user interface reflects each user's effective permissions. Actions the user is not permitted to perform are hidden or visually disabled. Navigation only shows areas the user can access. Attempting a forbidden action via direct URL returns a clear "access denied" message rather than an error.

**Why this priority**: Without UI enforcement, users see options they cannot use, leading to confusion. This story makes the RBAC model visible to end users.

**Independent Test**: Can be fully tested by logging in as a user with limited permissions and verifying that restricted actions are hidden and direct URL access is denied gracefully.

**Acceptance Scenarios**:

1. **Given** a user with only view permissions, **When** they open the dashboard list, **Then** they see no "create dashboard" or "edit" controls.
2. **Given** a user without user-management permission, **When** they navigate to the user-management URL directly, **Then** they see a clear "You do not have permission to access this page" message.
3. **Given** a user whose group membership changes while they are logged in, **When** they perform their next action, **Then** the UI reflects the updated permissions without requiring a manual logout/login.

---

### User Story 6 — View My Permissions (Priority: P3)

Any authenticated user can view their own effective permissions and the groups they belong to from their profile or account page. This helps users understand what they can and cannot do.

**Why this priority**: Self-service visibility reduces admin support burden but is not required for the RBAC model to function.

**Independent Test**: Can be fully tested by logging in as any user and navigating to the profile page to see listed groups and effective permissions.

**Acceptance Scenarios**:

1. **Given** an authenticated user belonging to two groups, **When** they visit their profile, **Then** they see both group names and a consolidated list of their effective permissions.
2. **Given** a user whose group membership was just changed by an admin, **When** they refresh their profile, **Then** the updated groups and permissions are displayed.

---

### Edge Cases

- What happens when the last member is removed from the "Administrators" group? The system must prevent this to avoid lockout.
- What happens when a group is deleted that still has members? Members lose only the permissions unique to that group; the system must confirm this action with the admin before proceeding.
- What happens when a user belongs to zero groups? They can authenticate but have no permissions — they see an empty state explaining they need group assignment and should contact an administrator.
- What happens when two groups grant conflicting levels of access to the same dashboard (e.g., one grants view, another grants edit)? Permissions are additive, so the user receives the highest level of access.
- What happens when a permission category is referenced by a group but the corresponding feature is not yet available (future-proofing)? The permission is stored but has no effect until the feature exists.

## Requirements *(mandatory)*

### Functional Requirements

#### Group Management

- **FR-001**: System MUST provide three built-in groups on initial setup: "Administrators" (full access), "Users" (view and interact), and "Viewers" (read-only).
- **FR-002**: System MUST allow administrators to create custom groups with a name (unique, 1–50 characters), optional description (up to 200 characters), and a set of permissions.
- **FR-003**: System MUST allow administrators to edit the name, description, and permissions of any custom group.
- **FR-004**: System MUST allow administrators to delete custom groups, with a confirmation step that lists affected members.
- **FR-005**: System MUST prevent deletion of built-in groups.
- **FR-006**: System MUST allow administrators to view the permission configuration of built-in groups.

#### Permission Model

- **FR-007**: System MUST define the following permission categories: dashboard management, widget configuration, system settings, user management, and integrations.
- **FR-008**: Each permission category MUST support at minimum two levels: "view" and "manage" (full control).
- **FR-009**: A group's effective permissions MUST be the explicit set of permissions assigned to it — no implicit inheritance between groups.
- **FR-010**: When a user belongs to multiple groups, the user's effective permissions MUST be the additive union (most permissive wins) of all their groups' permissions.

#### User–Group Assignment

- **FR-011**: System MUST allow administrators to assign a user to one or more groups.
- **FR-012**: System MUST allow administrators to remove a user from a group.
- **FR-013**: System MUST prevent removing the last user from the "Administrators" group to avoid total lockout.
- **FR-014**: System MUST allow a user to view their own group memberships and effective permissions.

#### Dashboard Access Control

- **FR-015**: System MUST allow users with dashboard-management permission to assign view-access and edit-access groups to each dashboard.
- **FR-016**: By default, a newly created dashboard MUST be accessible to all groups.
- **FR-017**: Members of the "Administrators" group MUST always have full access to all dashboards regardless of per-dashboard restrictions.
- **FR-018**: Users who lack view access to a dashboard MUST NOT see it in any dashboard listing or navigation.

#### Migration & Backward Compatibility

- **FR-019**: On upgrade, the system MUST automatically create the three built-in groups and map existing "admin" role users to the "Administrators" group and "user" role users to the "Users" group.
- **FR-020**: The migration MUST be idempotent — running it multiple times produces the same result.
- **FR-021**: After migration, the legacy `role` column MUST be preserved (read-only) for rollback safety until explicitly removed in a future release.

#### Authorization Enforcement

- **FR-022**: Every protected action MUST check the requesting user's effective permissions before executing.
- **FR-023**: Unauthorized requests MUST return a clear "access denied" response (not a generic error).
- **FR-024**: The UI MUST hide or disable controls for actions the current user is not permitted to perform.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: The RBAC system MUST not reduce existing authentication or authorization guarantees. Permission checks MUST occur on the server side; client-side hiding is cosmetic only.
- **NFR-002 (LAN-only)**: The RBAC feature MUST not require internet access for any core function, consistent with HomeDash's LAN-first deployment model.
- **NFR-003 (Privacy)**: The RBAC feature MUST not add telemetry or external callbacks by default.
- **NFR-004 (UX)**: Group and permission management UI MUST be usable on both desktop and mobile viewports.
- **NFR-005 (Operability)**: All permission-denied events and group-membership changes MUST be logged with sufficient detail to diagnose access issues on a NAS deployment.
- **NFR-006 (Performance)**: Permission checks MUST not add noticeable latency to page loads or actions from the user's perspective.

### Key Entities

- **Group**: Represents a named collection of permissions. Has a unique name, optional description, a flag indicating whether it is built-in, and a set of assigned permissions.
- **Permission**: Represents a specific capability within a category (e.g., "dashboard-management:manage"). Defined by a category and an access level.
- **User–Group Membership**: Represents the many-to-many relationship between users and groups. A user can belong to multiple groups; a group can contain multiple users.
- **Dashboard Access Rule**: Represents which groups can view and which groups can edit a specific dashboard. Each dashboard can have zero or more access rules (zero means "all groups").

## Assumptions

- The existing authentication mechanism (login/session) remains unchanged; this feature only affects authorization.
- Permission categories are system-defined and not user-extensible in this release. New categories will be added in future releases as new features are introduced.
- "Integrations" permissions govern access to integration settings and configuration, not per-integration fine-grained control (that can be a future enhancement).
- The built-in "Administrators" group always has full, irrevocable access to everything — its permissions cannot be reduced.
- Session/token refresh handles permission changes: after a group membership change, the next request the user makes will reflect the new permissions (no forced logout required).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can create a new user group and assign permissions in under 2 minutes.
- **SC-002**: An administrator can assign a user to a group in under 30 seconds.
- **SC-003**: Existing HomeDash instances upgrade to the RBAC model with zero manual steps — all existing users retain their prior access levels automatically.
- **SC-004**: A user with restricted permissions sees only the features and dashboards they are allowed to access — zero forbidden-action buttons or links visible in the UI.
- **SC-005**: Permission changes take effect on the user's very next interaction — no logout/login cycle required.
- **SC-006**: Per-dashboard access restrictions correctly hide dashboards from unauthorized users with 100% consistency across all dashboard listings and navigation paths.
- **SC-007**: The system prevents administrator lockout — it is impossible to remove the last user from the Administrators group.
