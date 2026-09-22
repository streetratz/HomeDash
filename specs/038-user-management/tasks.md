# Tasks: User Management

**Input**: Design documents from `/specs/038-user-management/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included as Phase 7 per user request (tests and validation phase).

**Organization**: Tasks grouped into 6 implementation phases as specified: schema migration → backend self-service → backend admin CRUD → frontend self-service UI → frontend admin Users tab → tests and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Schema Migration (lastLoginAt)

**Purpose**: Add the `lastLoginAt` column to the users table and add `destroyUserSessions` helper needed by all password-change flows.

- [x] T001 Add `lastLoginAt` field to users table schema in `backend/src/db/schema/index.ts` — add `lastLoginAt: text('last_login_at')` (nullable) to the existing `users` table definition
- [x] T002 Generate Drizzle migration by running `pnpm --filter backend drizzle-kit generate` and verify the migration SQL file is created in `backend/drizzle/`
- [x] T003 Update login handler in `backend/src/api/auth.ts` to set `lastLoginAt` to current ISO 8601 timestamp on successful authentication (after session creation)
- [x] T004 Add `destroyUserSessions(userId, excludeSessionId?)` function to `backend/src/auth/sessionStore.ts` — deletes all sessions for a user, optionally excluding a specific session ID (per R-02 research decision)

**Checkpoint**: Schema migration ready. `lastLoginAt` populated on login. Session invalidation helper available for password-change flows.

---

## Phase 2: Backend Self-Service Endpoints (US1, US2)

**Purpose**: Add `PUT /api/user/profile` and `PUT /api/user/password` to the existing `backend/src/api/user.ts` route file for self-service profile management.

- [x] T005 [US1] Add Zod validation schemas to `backend/src/api/user.ts` — `ProfileUpdateSchema` (`displayName`: string, 1–100 chars, trimmed, non-empty) and shared `passwordSchema` (string, min 8 chars)
- [x] T006 [US1] Implement `PUT /api/user/profile` route in `backend/src/api/user.ts` — requires `requireAuth` + `assertCsrf`, validates body with `ProfileUpdateSchema`, updates user's `displayName` in the database via Drizzle, returns updated user object (id, username, displayName, role). Never return `passwordHash`.
- [x] T007 [US2] Add `PasswordChangeSchema` to `backend/src/api/user.ts` — validates `currentPassword` (required string) and `newPassword` (uses shared `passwordSchema`)
- [x] T008 [US2] Implement `PUT /api/user/password` route in `backend/src/api/user.ts` — requires `requireAuth` + `assertCsrf`, validates body with `PasswordChangeSchema`, verifies current password with `verifyPassword` from `backend/src/auth/password.ts`, hashes new password with `hashPassword`, updates `passwordHash` in database, calls `destroyUserSessions(userId, currentSessionId)` to invalidate other sessions, returns `{ message: "Password changed successfully" }`. Return 401 if current password is incorrect.

**Checkpoint**: Self-service profile update and password change fully functional via API. Sessions invalidated on password change.

---

## Phase 3: Backend Admin User CRUD Endpoints (US3–US7)

**Purpose**: Create `backend/src/api/admin-users.ts` with full admin user management following the `admin-groups.ts` pattern, and register routes.

- [x] T009 [US3] Create `backend/src/api/admin-users.ts` — scaffold the route registration function `registerAdminUserRoutes(app: FastifyInstance)` with imports for `requirePermission`, `assertCsrf`, `validate`, Drizzle schema, `hashPassword`, `destroyUserSessions`, and Zod. Add shared Zod schemas: `CreateUserSchema` (username: required string, displayName: 1–100 chars trimmed, password: min 8 chars, role: enum 'admin'|'standard', groupIds: optional string array), `UpdateUserSchema` (displayName: optional 1–100 chars, role: optional enum, groupIds: optional string array), `ResetPasswordSchema` (password: min 8 chars).
- [x] T010 [US3] Implement `GET /api/admin/users` in `backend/src/api/admin-users.ts` — requires `requirePermission('users', 'manage')`, queries all users (excluding `passwordHash`), joins group memberships to include `groups: [{ id, name }]` per user, includes `lastLoginAt`, orders by username alphabetically, returns `{ users: [...] }`
- [x] T011 [US4] Implement `POST /api/admin/users` in `backend/src/api/admin-users.ts` — requires `requirePermission` + `assertCsrf`, validates with `CreateUserSchema`, checks username uniqueness (return 409 if taken), generates UUID v4 for id, hashes password with argon2id, inserts user row, inserts `user_group_memberships` for any provided `groupIds`, returns 201 with created user object including groups
- [x] T012 [US5] Implement `PUT /api/admin/users/:userId` in `backend/src/api/admin-users.ts` — requires `requirePermission` + `assertCsrf`, validates with `UpdateUserSchema`, returns 404 if user not found. For role changes: reject with 409 if admin changing own role, reject with 409 if demoting last admin (count admins). Updates `displayName` and `role` fields. Syncs group memberships: delete all existing memberships for user, insert new ones from `groupIds` array. Wrap in transaction. Returns updated user with groups.
- [x] T013 [US7] Implement `DELETE /api/admin/users/:userId` in `backend/src/api/admin-users.ts` — requires `requirePermission` + `assertCsrf`, returns 404 if user not found, returns 409 if deleting self (`request.user.id === userId`), returns 409 if deleting last admin (count admins where role='admin'), deletes user (sessions and memberships cascade), returns 204 No Content
- [x] T014 [US6] Implement `PUT /api/admin/users/:userId/password` in `backend/src/api/admin-users.ts` — requires `requirePermission` + `assertCsrf`, validates with `ResetPasswordSchema`, returns 404 if user not found, hashes new password with argon2id, updates `passwordHash`, calls `destroyUserSessions(userId)` (invalidate ALL sessions — no exclusion), returns `{ message: "Password reset successfully" }`
- [x] T015 Register admin-users routes in `backend/src/api/index.ts` — import `registerAdminUserRoutes` from `./admin-users.js` and call it in the route registration function, following the existing pattern used by `registerAdminGroupRoutes`

**Checkpoint**: All 7 API endpoints operational. Admin CRUD with last-admin protection, self-deletion prevention, session invalidation on password changes, group membership sync.

---

## Phase 4: Frontend Self-Service UI — Extend GeneralTab (US1, US2)

**Purpose**: Add Profile card (display name edit) and Change Password card to the existing Settings → General tab.

- [x] T016 [P] [US1] Add TanStack Query mutation hook `useUpdateProfile` in `frontend/src/state/settings.ts` — calls `PUT /api/user/profile` with `{ displayName }`, includes CSRF token header, invalidates user/session query cache on success so the user menu updates reactively
- [x] T017 [P] [US2] Add TanStack Query mutation hook `useChangePassword` in `frontend/src/state/settings.ts` — calls `PUT /api/user/password` with `{ currentPassword, newPassword }`, includes CSRF token header, handles 401 error (wrong current password) distinctly from validation errors
- [x] T018 [US1] Add "Profile" card to `frontend/src/components/settings/GeneralTab.tsx` — positioned at the top of the tab. Contains a form with: display name input field (pre-populated with current user's display name), Save button. Uses `useUpdateProfile` mutation. Shows validation error for empty or >100 char names. Shows success toast on save. Uses existing shadcn/ui `Card`, `Input`, `Button`, `Label` components.
- [x] T019 [US2] Add "Change Password" card to `frontend/src/components/settings/GeneralTab.tsx` — positioned below the Profile card. Contains a form with: current password input, new password input (min 8 chars), confirm new password input. Client-side validation: passwords match check, 8-char minimum. Uses `useChangePassword` mutation. Shows inline error if current password is incorrect (401). Shows success toast and clears form on success. All fields are `type="password"`.

**Checkpoint**: Self-service UI fully functional. Users can update display name and change password from Settings → General.

---

## Phase 5: Frontend Admin Users Tab (US3–US7)

**Purpose**: Create the admin-only Users tab with list, create, edit, delete, and password reset dialogs following the `GroupsTab.tsx` pattern.

- [x] T020 [P] Create TanStack Query hooks file `frontend/src/state/users.ts` — export `useAdminUsers` (GET /api/admin/users, returns user list), `useCreateUser` (POST mutation), `useUpdateUser` (PUT mutation), `useDeleteUser` (DELETE mutation), `useResetUserPassword` (PUT password mutation). All mutations include CSRF token header. All mutations invalidate the `['admin', 'users']` query key on success. Follow the pattern in `frontend/src/state/rbac.ts`.
- [x] T021 [US3] Create `frontend/src/components/settings/UsersTab.tsx` — main component rendering a user list table inside a `Card`. Table columns: Username, Display Name, Role (badge), Groups (comma-separated names), Last Login (formatted relative timestamp or "Never"). Uses `useAdminUsers` hook. Shows loading skeleton while fetching. Includes a "Create User" button in the card header. Per-row action menu (dropdown) with: Edit, Reset Password, Delete options. Import and render `CreateUserDialog`, `EditUserDialog`, `ResetPasswordDialog`, `DeleteUserDialog` sub-components (defined below or inline as dialog state).
- [x] T022 [US4] Implement Create User dialog in `frontend/src/components/settings/UsersTab.tsx` — shadcn/ui `Dialog` triggered by "Create User" button. Form fields: username (required), display name (required, 1–100 chars), password (required, min 8 chars), role (select: admin/standard). Optional: group multi-select (list available groups). Uses `useCreateUser` mutation. Shows 409 error inline if username taken. Closes dialog and shows success toast on creation.
- [x] T023 [US5] Implement Edit User dialog in `frontend/src/components/settings/UsersTab.tsx` — shadcn/ui `Dialog` triggered by Edit action. Pre-populates form with selected user's data. Editable fields: display name, role (select), group assignments (multi-select checkbox list of all groups). Username shown but read-only (immutable). Uses `useUpdateUser` mutation. Shows 409 error for last-admin-demotion or self-role-change. Closes dialog and shows success toast on save.
- [x] T024 [US6] Implement Reset Password dialog in `frontend/src/components/settings/UsersTab.tsx` — shadcn/ui `Dialog` triggered by Reset Password action. Shows target user's username. Form fields: new password (min 8 chars), confirm new password. Client-side validation: passwords match, 8-char minimum. Uses `useResetUserPassword` mutation. Shows success toast noting all user sessions were invalidated.
- [x] T025 [US7] Implement Delete User confirmation dialog in `frontend/src/components/settings/UsersTab.tsx` — shadcn/ui `AlertDialog` triggered by Delete action. Shows warning message with the user's display name. Disable delete button if target is the current user (self-deletion prevention — also enforced server-side). Uses `useDeleteUser` mutation. Shows 409 error if attempting to delete last admin. Closes dialog and shows success toast on deletion.
- [x] T026 [US3] Add "Users" tab to `frontend/src/pages/SettingsPage.tsx` — conditionally render `<TabsTrigger value="users">Users</TabsTrigger>` only when the current user has admin role (`{isAdmin && ...}`). Add corresponding `<TabsContent value="users"><UsersTab /></TabsContent>`. Import `UsersTab` from `../components/settings/UsersTab`.

**Checkpoint**: Full admin user management UI operational. List, create, edit, delete, and password reset all functional with proper permission gating.

---

## Phase 6: Tests & Validation

**Purpose**: Backend integration tests for all new endpoints, frontend E2E tests for critical user flows, and quickstart validation.

### Backend Tests

- [ ] T027 [P] [US1] Create backend integration test for self-service profile update in `backend/tests/api/user-profile.test.ts` — test cases: successful display name update (200), validation error for empty name (400), validation error for >100 chars (400), whitespace-only name rejected (400), unauthenticated request rejected (401), CSRF token required
- [ ] T028 [P] [US2] Create backend integration test for self-service password change in `backend/tests/api/user-password.test.ts` — test cases: successful password change (200), wrong current password (401), new password too short (400), sessions invalidated after change (verify other sessions deleted, current session kept), unauthenticated request rejected (401)
- [ ] T029 [P] [US3] Create backend integration test for admin user list in `backend/tests/api/admin-users-list.test.ts` — test cases: admin can list users with groups (200), non-admin rejected (403), `passwordHash` not in response, `lastLoginAt` included, users sorted by username
- [ ] T030 [P] [US4] Create backend integration test for admin create user in `backend/tests/api/admin-users-create.test.ts` — test cases: successful creation (201), duplicate username (409), validation errors (400, missing fields, short password), group assignment on creation, non-admin rejected (403)
- [ ] T031 [P] [US5] Create backend integration test for admin update user in `backend/tests/api/admin-users-update.test.ts` — test cases: successful update (200), user not found (404), cannot change own role (409), cannot demote last admin (409), group membership sync works, non-admin rejected (403)
- [ ] T032 [P] [US6] Create backend integration test for admin password reset in `backend/tests/api/admin-users-password.test.ts` — test cases: successful reset (200), user not found (404), short password (400), all sessions invalidated (no exclusion), non-admin rejected (403)
- [ ] T033 [P] [US7] Create backend integration test for admin delete user in `backend/tests/api/admin-users-delete.test.ts` — test cases: successful deletion (204), user not found (404), cannot delete self (409), cannot delete last admin (409), sessions cascade deleted, non-admin rejected (403)

### Validation

- [ ] T034 Run full backend test suite (`pnpm --filter backend test`) and verify all existing and new tests pass
- [ ] T035 Run quickstart.md validation — start the dev server, verify schema migration applies automatically, test each API endpoint manually per the quickstart scenarios, verify `lastLoginAt` is populated after login

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema Migration)**: No dependencies — start immediately
- **Phase 2 (Backend Self-Service)**: Depends on Phase 1 (needs `destroyUserSessions` from T004, schema from T001)
- **Phase 3 (Backend Admin CRUD)**: Depends on Phase 1 (needs `destroyUserSessions`, schema with `lastLoginAt`)
- **Phase 2 and Phase 3**: Can run in parallel after Phase 1
- **Phase 4 (Frontend Self-Service)**: Depends on Phase 2 (needs API endpoints to call)
- **Phase 5 (Frontend Admin Tab)**: Depends on Phase 3 (needs admin API endpoints to call)
- **Phase 4 and Phase 5**: Can run in parallel (different files, independent APIs)
- **Phase 6 (Tests)**: Depends on Phases 2 + 3 for backend tests; Depends on all phases for quickstart validation

### User Story Dependencies

- **US1 (Update Display Name)**: Phase 1 → T005, T006 → T016, T018 → T027
- **US2 (Change Password)**: Phase 1 → T007, T008 → T017, T019 → T028
- **US3 (Admin List Users)**: Phase 1 → T009, T010 → T020, T021, T026 → T029
- **US4 (Admin Create User)**: Phase 1 → T009, T011 → T020, T022 → T030
- **US5 (Admin Edit User)**: Phase 1 → T009, T012 → T020, T023 → T031
- **US6 (Admin Reset Password)**: Phase 1 → T009, T014 → T020, T024 → T032
- **US7 (Admin Delete User)**: Phase 1 → T009, T013 → T020, T025 → T033

### Within Each Phase

- Schemas/validation before route implementations
- Route scaffolding before individual endpoint implementations
- Query hooks before UI components that consume them
- List view before CRUD dialogs

### Parallel Opportunities

```text
After Phase 1 completes:
  ├── Phase 2 (Backend Self-Service)  ─┐
  │   ├── T005 + T007 in parallel      │── can run simultaneously
  │   └── T006 after T005              │
  └── Phase 3 (Backend Admin CRUD)   ─┘
      ├── T009 first (scaffolding)
      └── T010, T011, T012, T013, T014 after T009

After Phases 2 + 3 complete:
  ├── Phase 4 (Frontend Self-Service) ─┐
  │   ├── T016 + T017 in parallel [P]  │── can run simultaneously
  │   └── T018, T019 sequentially      │
  └── Phase 5 (Frontend Admin Tab)   ─┘
      ├── T020 [P] first (hooks)
      └── T021–T026 sequentially

Phase 6 backend tests: T027–T033 all in parallel [P]
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + Phase 4 = Self-Service Only)

1. Complete Phase 1: Schema migration + session helper
2. Complete Phase 2: Self-service API endpoints
3. Complete Phase 4: Self-service UI
4. **STOP and VALIDATE**: Every user can update display name and change password
5. Deploy if ready — admin CRUD can follow

### Incremental Delivery

1. Phase 1 → Schema ready
2. Phase 2 → Self-service API → Phase 4 → Self-service UI → **MVP deployed** (US1 + US2)
3. Phase 3 → Admin API → Phase 5 → Admin UI → **Full feature deployed** (US3–US7)
4. Phase 6 → Tests confirm everything → **Production ready**

### Parallel Team Strategy

With two developers after Phase 1:

- **Developer A**: Phase 2 → Phase 4 (self-service stack, US1 + US2)
- **Developer B**: Phase 3 → Phase 5 (admin stack, US3–US7)
- **Together**: Phase 6 (tests and validation)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- All passwords hashed with argon2id — never store or return plaintext
- `passwordHash` NEVER included in any API response
- CSRF token required on all mutating endpoints
- Admin self-deletion and last-admin-removal enforced server-side (409 Conflict)
- Session invalidation: self-service keeps current session, admin reset invalidates ALL
- Username is immutable after creation
- Group membership sync uses delete-all + re-insert within a transaction
- Commit after each task or logical group
