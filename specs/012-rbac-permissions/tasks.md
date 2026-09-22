# Tasks: RBAC — User Groups and Granular Permissions

**Input**: Design documents from `/specs/012-rbac-permissions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/rbac-api.yaml ✅, quickstart.md ✅

**Tests**: Tests are EXPECTED for all backend/auth/data changes per constitution. This feature modifies authorization, so every phase includes test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`, `backend/drizzle/`
- **Frontend**: `frontend/src/`
- **Monorepo**: pnpm workspaces (backend + frontend)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Permission constants, types, and Drizzle schema — the foundation every story needs

- [ ] T001 [P] Create permission constants, types, and helpers (categories, levels, permission strings, `computeEffectivePermissions()`) in `backend/src/lib/permissions.ts`
- [ ] T002 [P] Create Zod validation schemas for group input, permission entries, and membership input in `backend/src/lib/validation.ts` (extend existing file or new `backend/src/lib/rbac-validation.ts`)
- [ ] T003 Add Drizzle schema definitions for `groups`, `group_permissions`, `user_group_memberships`, and `dashboard_access_rules` tables in `backend/src/db/schema/index.ts`
- [ ] T004 Generate and customize Drizzle migration with schema DDL + seed SQL (3 built-in groups, their permissions, user mapping from legacy roles) in `backend/drizzle/0009_rbac_groups.sql`
- [ ] T005 [P] Add `requirePermission()` middleware helper alongside existing `requireRole()` in `backend/src/auth/requireRole.ts`

**Checkpoint**: Schema, types, and migration ready — all RBAC tables exist, built-in groups seeded, permission helpers available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth middleware loads permissions per-request; `/api/auth/me` returns groups/permissions — every story depends on this

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Extend `getSession()` in `backend/src/auth/sessionStore.ts` to JOIN through `user_group_memberships` → `group_permissions` and compute additive permission union per R-03
- [ ] T007 Extend `AuthUser` type in `backend/src/auth/authMiddleware.ts` to include `permissions: Set<string>`, `groupIds: string[]`, and `isAdmin: boolean`
- [ ] T008 Update `GET /api/auth/me` response in `backend/src/api/auth.ts` to include `groups`, `permissions`, and `isAdmin` fields per MeResponse contract
- [ ] T009 [P] Create `usePermissions` hook with `PermissionsContext` and `hasPermission(category, level)` helper in `frontend/src/hooks/usePermissions.ts`
- [ ] T010 [P] Create `<PermissionGate>` conditional render wrapper component in `frontend/src/components/PermissionGate.tsx`
- [ ] T011 Wire `PermissionsContext` provider into the app — load permissions from `/api/auth/me` via TanStack Query in `frontend/src/state/bootstrap.ts`

### Tests for Foundational Phase ⚠️

- [ ] T012 [P] Unit tests for `computeEffectivePermissions()` and permission helpers (additive union, manage-supersedes-view) in `backend/tests/unit/permissions.test.ts`
- [ ] T013 [P] Integration test for `GET /api/auth/me` returning groups and permissions in `backend/tests/integration/auth-me-permissions.test.ts`

**Checkpoint**: Foundation ready — every authenticated request has `permissions` on `request.user`; frontend has `usePermissions()` hook; `/api/auth/me` returns full RBAC payload

---

## Phase 3: User Story 1 — Backward-Compatible Migration (Priority: P1) 🎯 MVP

**Goal**: Existing admin/user role data is automatically migrated to group-based model on upgrade. No user loses access.

**Independent Test**: Upgrade a database with existing admin and standard-user accounts; verify each user retains identical capabilities and is in the correct built-in group.

### Tests for User Story 1 ⚠️

- [ ] T014 [P] [US1] Integration test: fresh migration creates 3 built-in groups with correct permissions in `backend/tests/integration/rbac-migration.test.ts`
- [ ] T015 [P] [US1] Integration test: migration maps existing `admin` users → Administrators group and `standard` users → Users group in `backend/tests/integration/rbac-migration.test.ts`
- [ ] T016 [P] [US1] Integration test: migration is idempotent — running twice produces same result in `backend/tests/integration/rbac-migration.test.ts`

### Implementation for User Story 1

- [ ] T017 [US1] Verify migration SQL idempotency (`INSERT OR IGNORE`) and legacy `role` column preservation in `backend/drizzle/0009_rbac_groups.sql` (validate T004 output)
- [ ] T018 [US1] Ensure `backend/src/db/migrate.ts` runs the new RBAC migration file on startup without errors
- [ ] T019 [US1] Add structured logging for migration events (groups created, users mapped) in `backend/src/db/seed.ts` or migration runner

**Checkpoint**: An existing HomeDash database upgrades cleanly — admins are in Administrators, standard users are in Users, legacy `role` column is preserved read-only. All 3 acceptance scenarios pass.

---

## Phase 4: User Story 2 — Manage User Groups (Priority: P1)

**Goal**: Admins can CRUD user groups with configurable permissions. Built-in groups cannot be deleted.

**Independent Test**: Log in as admin, create a custom group with permissions, edit it, then delete it. Verify built-in groups cannot be deleted.

### Tests for User Story 2 ⚠️

- [ ] T020 [P] [US2] Unit tests for `groupService` CRUD logic (create, update, delete, built-in protection) in `backend/tests/unit/groupService.test.ts`
- [ ] T021 [P] [US2] Integration tests for group API routes (`GET/POST /admin/groups`, `GET/PATCH/DELETE /admin/groups/:id`) in `backend/tests/integration/admin-groups.test.ts`
- [ ] T022 [P] [US2] Contract test: verify request/response shapes match `rbac-api.yaml` for group endpoints in `backend/tests/contract/admin-groups.contract.test.ts`

### Implementation for User Story 2

- [ ] T023 [P] [US2] Create `groupService` with `listGroups()`, `getGroup()`, `createGroup()`, `updateGroup()`, `deleteGroup()` in `backend/src/services/groupService.ts`
- [ ] T024 [US2] Create group CRUD API routes (`GET/POST /admin/groups`, `GET/PATCH/DELETE /admin/groups/:groupId`) with Zod validation and `requirePermission('users', 'manage')` in `backend/src/api/admin-groups.ts`
- [ ] T025 [US2] Register `admin-groups` route module in `backend/src/api/index.ts`
- [ ] T026 [P] [US2] Add RBAC API methods for groups (`fetchGroups`, `createGroup`, `updateGroup`, `deleteGroup`) in `frontend/src/lib/apiClient.ts`
- [ ] T027 [P] [US2] Create `GroupList` component (table with name, description, member count, built-in badge, actions) in `frontend/src/components/rbac/GroupList.tsx`
- [ ] T028 [P] [US2] Create `PermissionGrid` component (5-category × 2-level toggle grid) in `frontend/src/components/rbac/PermissionGrid.tsx`
- [ ] T029 [US2] Create `GroupForm` component (create/edit group with name, description, PermissionGrid) in `frontend/src/components/rbac/GroupForm.tsx`
- [ ] T030 [US2] Create `GroupManagementPage` with list, create, edit, and delete flows in `frontend/src/pages/GroupManagementPage.tsx`
- [ ] T031 [US2] Add Groups route to app router and Settings navigation (admin-only) in `frontend/src/app/router.tsx`

**Checkpoint**: Admin can create "Power Users" group with dashboard-management + widget-config permissions, edit to add settings, then delete it. Built-in groups are protected. All 4 acceptance scenarios pass.

---

## Phase 5: User Story 3 — Assign Users to Groups (Priority: P1)

**Goal**: Admins assign/remove users from groups. Effective permissions are the additive union. Last-admin lockout prevented.

**Independent Test**: Assign a user to two groups with different permissions; verify additive union. Remove from one group; verify only those unique permissions are lost.

### Tests for User Story 3 ⚠️

- [ ] T032 [P] [US3] Unit tests for `membershipService` (add/remove member, additive union, last-admin lockout prevention) in `backend/tests/unit/membershipService.test.ts`
- [ ] T033 [P] [US3] Integration tests for membership API routes (`GET/POST /admin/groups/:id/members`, `DELETE /admin/groups/:id/members/:userId`, `GET /admin/users/:id/groups`) in `backend/tests/integration/admin-members.test.ts`

### Implementation for User Story 3

- [ ] T034 [P] [US3] Create `membershipService` with `listMembers()`, `addMember()`, `removeMember()`, `listUserGroups()`, and admin-lockout check in `backend/src/services/membershipService.ts`
- [ ] T035 [US3] Create membership API routes (`GET/POST /admin/groups/:groupId/members`, `DELETE /admin/groups/:groupId/members/:userId`, `GET /admin/users/:userId/groups`) in `backend/src/api/admin-group-members.ts`
- [ ] T036 [US3] Register `admin-group-members` route module in `backend/src/api/index.ts`
- [ ] T037 [P] [US3] Add RBAC API methods for membership (`fetchGroupMembers`, `addGroupMember`, `removeGroupMember`, `fetchUserGroups`) in `frontend/src/lib/apiClient.ts`
- [ ] T038 [US3] Create `GroupMembers` component (member list with add/remove, user selector, last-admin warning) in `frontend/src/components/rbac/GroupMembers.tsx`
- [ ] T039 [US3] Integrate `GroupMembers` into `GroupManagementPage` group detail view in `frontend/src/pages/GroupManagementPage.tsx`
- [ ] T040 [US3] Add group assignment UI to existing user management — show user's groups on admin user detail in `backend/src/api/admin.ts` and `frontend/src/pages/SettingsPage.tsx` (or relevant admin user component)

**Checkpoint**: Admin assigns user to Viewers + Power Users → user can view dashboards AND configure widgets. Removing from Power Users → widget-config lost. Last-admin removal blocked. All 3 acceptance scenarios pass.

---

## Phase 6: User Story 4 — Per-Dashboard Access Control (Priority: P2)

**Goal**: Users with dashboard-management permission can restrict which groups view/edit a specific dashboard. Admins bypass all restrictions.

**Independent Test**: Create dashboard, restrict to one group, verify users outside that group cannot see it. Verify admins always see everything.

### Tests for User Story 4 ⚠️

- [ ] T041 [P] [US4] Unit tests for `dashboardAccessService` (set/get rules, admin bypass, empty-rules = all-access) in `backend/tests/unit/dashboardAccessService.test.ts`
- [ ] T042 [P] [US4] Integration tests for dashboard access API routes (`GET/PUT /admin/dashboards/:id/access`) in `backend/tests/integration/admin-dashboard-access.test.ts`
- [ ] T043 [P] [US4] Integration test: dashboard list endpoint filters dashboards based on user's group access rules in `backend/tests/integration/dashboard-acl-filter.test.ts`

### Implementation for User Story 4

- [ ] T044 [P] [US4] Create `dashboardAccessService` with `getAccessRules()`, `setAccessRules()`, `canUserAccessDashboard()`, and `filterDashboardsForUser()` in `backend/src/services/dashboardAccessService.ts`
- [ ] T045 [US4] Create dashboard access API routes (`GET/PUT /admin/dashboards/:dashboardId/access`) with `requirePermission('dashboards', 'manage')` in `backend/src/api/admin-dashboard-access.ts`
- [ ] T046 [US4] Register `admin-dashboard-access` route module in `backend/src/api/index.ts`
- [ ] T047 [US4] Modify existing dashboard list endpoint in `backend/src/api/adminDashboards.ts` to filter dashboards by user's group access (admins bypass; no rules = all access)
- [ ] T048 [P] [US4] Add dashboard access API methods (`fetchDashboardAccess`, `setDashboardAccess`) in `frontend/src/lib/apiClient.ts`
- [ ] T049 [US4] Create `DashboardAccessForm` component (group-select with view/edit toggles, "all groups" reset) in `frontend/src/components/rbac/DashboardAccessForm.tsx`
- [ ] T050 [US4] Integrate `DashboardAccessForm` into dashboard settings/edit flow in `frontend/src/pages/DashboardManagementPage.tsx`

**Checkpoint**: Dashboard restricted to "Power Users" → non-members don't see it. Admin always sees all. Reverting to "all groups" restores access. All 4 acceptance scenarios pass.

---

## Phase 7: User Story 5 — Permission-Aware UI (Priority: P2)

**Goal**: UI hides/disables actions the user cannot perform. Direct URL access to forbidden areas shows "access denied" message.

**Independent Test**: Log in as user with only view permissions — no create/edit controls visible. Navigate to admin URL directly → access denied page.

### Tests for User Story 5 ⚠️

- [ ] T051 [P] [US5] Integration test: API routes return 403 with clear error message for unauthorized access in `backend/tests/integration/permission-enforcement.test.ts`

### Implementation for User Story 5

- [ ] T052 [US5] Create `AccessDeniedPage` with clear "You do not have permission" message and navigation back in `frontend/src/pages/AccessDeniedPage.tsx`
- [ ] T053 [US5] Add route-level permission guards in `frontend/src/app/router.tsx` — redirect to AccessDeniedPage when user lacks required permission for a route
- [ ] T054 [US5] Wrap admin navigation items (Settings, User Management, Dashboard Management) with `<PermissionGate>` to hide from unauthorized users in relevant layout/nav components
- [ ] T055 [US5] Wrap dashboard create/edit/delete controls with `<PermissionGate>` for `dashboards:manage` in `frontend/src/pages/DashboardManagementPage.tsx`
- [ ] T056 [US5] Wrap settings write controls with `<PermissionGate>` for `settings:manage` in `frontend/src/pages/SettingsPage.tsx`
- [ ] T057 [US5] Wrap user management controls with `<PermissionGate>` for `users:manage` in admin user components
- [ ] T058 [US5] Ensure permission changes take effect on next action — verify TanStack Query refetches `/api/auth/me` and `PermissionsContext` updates without logout in `frontend/src/hooks/usePermissions.ts`

**Checkpoint**: View-only user sees no create/edit/delete controls. Direct URL to `/settings` without `settings:view` shows AccessDeniedPage. Group membership change reflected on next interaction. All 3 acceptance scenarios pass.

---

## Phase 8: User Story 6 — View My Permissions (Priority: P3)

**Goal**: Any authenticated user can see their group memberships and effective permissions on their profile page.

**Independent Test**: Log in as any user, navigate to profile page, see listed groups and consolidated effective permissions.

### Implementation for User Story 6

- [ ] T059 [P] [US6] Create `MyPermissions` component showing user's groups and effective permissions list in `frontend/src/components/rbac/MyPermissions.tsx`
- [ ] T060 [US6] Integrate `MyPermissions` into the user profile/account section — add permissions panel to `frontend/src/pages/SettingsPage.tsx` or a new profile page
- [ ] T061 [US6] Add backend endpoint `GET /api/admin/users/:userId/groups` self-access check (allow users to view their own groups without `users:view`) in `backend/src/api/admin-group-members.ts`

**Checkpoint**: User visits profile → sees "Administrators, Power Users" and consolidated permissions "dashboards:manage, widgets:manage, …". Updated groups reflect on refresh. Both acceptance scenarios pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, logging, documentation, and validation across all stories

- [ ] T062 [P] Add structured logging for all permission-denied events (NFR-005) in `backend/src/auth/requireRole.ts` (the `requirePermission` path)
- [ ] T063 [P] Add structured logging for group-membership changes (add/remove member) in `backend/src/services/membershipService.ts`
- [ ] T064 [P] Ensure all RBAC state-changing endpoints require `x-csrf-token` header (CSRF protection per threat model) — audit `backend/src/api/admin-groups.ts`, `admin-group-members.ts`, `admin-dashboard-access.ts`
- [ ] T065 [P] Verify mobile responsiveness of GroupManagementPage, GroupForm, PermissionGrid, and DashboardAccessForm (NFR-004) — test at 375px viewport
- [ ] T066 Run `quickstart.md` validation — verify upgrade instructions match actual migration behavior
- [ ] T067 Final code cleanup and review across all RBAC files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema + types must exist) — BLOCKS all user stories
- **US1 Migration (Phase 3)**: Depends on Phase 2 — tests the migration produced by Phase 1
- **US2 Groups (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 or after
- **US3 Membership (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2 or after
- **US4 Dashboard ACL (Phase 6)**: Depends on Phase 2 + US2 (needs group CRUD to create test groups)
- **US5 Permission UI (Phase 7)**: Depends on Phase 2 + US2 (needs groups to test gating) — can run in parallel with US4
- **US6 My Permissions (Phase 8)**: Depends on Phase 2 — lightweight; can run in parallel with US4/US5
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) ──→ Phase 2 (Foundational) ──┬──→ US1 (Migration) ─────────────────────┐
                                               ├──→ US2 (Groups) ──┬──→ US4 (Dashboard ACL) │
                                               ├──→ US3 (Members)  ├──→ US5 (Permission UI)  ├──→ Phase 9 (Polish)
                                               └──→ US6 (My Perms) └────────────────────────┘
```

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Service layer before API routes
3. API routes before frontend components
4. Backend before frontend (API must exist for UI to call)
5. Story complete before checkpoint validation

### Parallel Opportunities

- **Phase 1**: T001, T002, T005 can run in parallel (different files)
- **Phase 2**: T009, T010 can run in parallel; T012, T013 can run in parallel
- **US1**: T014, T015, T016 (all test files) in parallel
- **US2**: T020, T021, T022 (tests) in parallel; T023, T026, T027, T028 in parallel
- **US3**: T032, T033 (tests) in parallel; T034, T037 in parallel
- **US4**: T041, T042, T043 (tests) in parallel; T044, T048 in parallel
- **US5**: T051 alone; implementation tasks are sequential (routing depends on page)
- **US6**: T059 in parallel with backend work
- **Cross-story**: US1 + US2 + US3 can be developed in parallel after Phase 2; US4 + US5 + US6 can be developed in parallel after US2

---

## Parallel Example: User Story 2 (Manage Groups)

```bash
# Launch all tests for US2 together:
Task: T020 "Unit tests for groupService in backend/tests/unit/groupService.test.ts"
Task: T021 "Integration tests for group API in backend/tests/integration/admin-groups.test.ts"
Task: T022 "Contract test for group endpoints in backend/tests/contract/admin-groups.contract.test.ts"

# Launch independent implementation files together:
Task: T023 "Create groupService in backend/src/services/groupService.ts"
Task: T026 "Add group API methods in frontend/src/lib/apiClient.ts"
Task: T027 "Create GroupList component in frontend/src/components/rbac/GroupList.tsx"
Task: T028 "Create PermissionGrid component in frontend/src/components/rbac/PermissionGrid.tsx"
```

---

## Implementation Strategy

### MVP First (P1 Stories: US1 + US2 + US3)

1. Complete Phase 1: Setup (types, schema, migration)
2. Complete Phase 2: Foundational (auth middleware, /me endpoint, frontend context)
3. Complete Phase 3: US1 — Migration works, existing users retain access
4. Complete Phase 4: US2 — Admins can CRUD groups
5. Complete Phase 5: US3 — Admins can assign users to groups
6. **STOP and VALIDATE**: Full group-based RBAC is functional. Admins manage groups, users get effective permissions.
7. Deploy MVP — the system is usable with group-level permissions

### Incremental Delivery (P2 + P3)

8. Add Phase 6: US4 — Per-dashboard ACL → Test independently → Deploy
9. Add Phase 7: US5 — Permission-aware UI → Test independently → Deploy
10. Add Phase 8: US6 — View my permissions → Test independently → Deploy
11. Complete Phase 9: Polish → Final deployment

### Suggested MVP Scope

**US1 + US2 + US3** (Phases 1–5, tasks T001–T040) delivers a complete, functional RBAC system. The P2/P3 stories enhance UX but the core permission model works without them.

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 67 |
| **Phase 1 (Setup)** | 5 |
| **Phase 2 (Foundational)** | 8 |
| **US1 (Migration)** | 6 |
| **US2 (Manage Groups)** | 12 |
| **US3 (Assign Users)** | 9 |
| **US4 (Dashboard ACL)** | 10 |
| **US5 (Permission UI)** | 8 |
| **US6 (My Permissions)** | 3 |
| **Polish** | 6 |
| **Parallelizable tasks** | 35 (52%) |
| **Backend tasks** | 40 |
| **Frontend tasks** | 21 |
| **Test tasks** | 14 |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable at its checkpoint
- Verify tests fail before implementing (TDD approach for service/API layers)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Legacy `role` column preserved throughout — never dropped in this feature
