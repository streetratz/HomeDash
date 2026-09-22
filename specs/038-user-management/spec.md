# Feature Specification: User Management

**Feature Branch**: `038-user-management`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: User description: "User Management — Self-service profile settings and admin user management UI (GH issue #133)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update My Display Name (Priority: P1)

As a logged-in user, I want to change my display name from the Settings page so that my identity across the application reflects what I prefer to be called.

**Why this priority**: Display name changes are the simplest self-service profile capability and provide immediate visible value to every user. This story establishes the self-service profile update pattern that password changes build upon.

**Independent Test**: Can be fully tested by navigating to Settings → General, editing the display name field, saving, and verifying the updated name appears throughout the application (e.g., in the user menu).

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Settings → General tab, **When** they edit the display name field and click Save, **Then** the display name is updated and reflected immediately in the user menu and across the application.
2. **Given** a logged-in user on the Settings → General tab, **When** they clear the display name field and click Save, **Then** the system shows a validation error that display name is required.
3. **Given** a logged-in user on the Settings → General tab, **When** they enter a display name exceeding 100 characters, **Then** the system shows a validation error about the character limit.

---

### User Story 2 - Change My Password (Priority: P1)

As a logged-in user, I want to change my password from the Settings page so that I can maintain the security of my account.

**Why this priority**: Password management is a fundamental security capability that every user needs. It requires current password verification to prevent unauthorized changes on unattended sessions.

**Independent Test**: Can be fully tested by navigating to Settings → General, entering current password and new password, saving, logging out, and confirming the new password works for login.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Settings → General tab, **When** they enter their correct current password, a valid new password (8+ characters), confirm the new password, and click Save, **Then** the password is changed and all other active sessions for this user are invalidated.
2. **Given** a logged-in user on the Settings → General tab, **When** they enter an incorrect current password, **Then** the system shows an error that the current password is incorrect.
3. **Given** a logged-in user on the Settings → General tab, **When** they enter a new password shorter than 8 characters, **Then** the system shows a validation error about the minimum password length.
4. **Given** a logged-in user on the Settings → General tab, **When** they enter mismatched new password and confirmation, **Then** the system shows a validation error that the passwords do not match.

---

### User Story 3 - Admin Lists All Users (Priority: P2)

As an admin, I want to see a list of all users in the system so that I can manage user accounts and understand who has access.

**Why this priority**: Viewing users is the prerequisite for all admin management actions (edit, delete, reset password). It provides situational awareness of the user base.

**Independent Test**: Can be fully tested by logging in as an admin, navigating to Settings → Users tab, and verifying all system users are displayed with their role, group memberships, and last login time.

**Acceptance Scenarios**:

1. **Given** an admin user on the Settings page, **When** they click the Users tab, **Then** a table displays all users showing username, display name, role, group memberships, and last login timestamp.
2. **Given** a non-admin user on the Settings page, **When** they view the available tabs, **Then** the Users tab is not visible.
3. **Given** an admin viewing the Users tab, **When** there are many users, **Then** the list is presented in a scrollable table with clear column headers.

---

### User Story 4 - Admin Creates a New User (Priority: P2)

As an admin, I want to create new user accounts so that I can onboard new household members or collaborators to the application.

**Why this priority**: User creation is a core admin function needed to grant access to new people without direct database manipulation.

**Independent Test**: Can be fully tested by logging in as an admin, navigating to Settings → Users, clicking Create User, filling in the form, submitting, and verifying the new user can log in.

**Acceptance Scenarios**:

1. **Given** an admin on the Users tab, **When** they click "Create User" and fill in username, display name, password (8+ characters), and role, then submit, **Then** a new user account is created and appears in the user list.
2. **Given** an admin creating a user, **When** they enter a username that already exists, **Then** the system shows an error that the username is taken.
3. **Given** an admin creating a user, **When** they leave required fields empty or enter a password shorter than 8 characters, **Then** the system shows appropriate validation errors.

---

### User Story 5 - Admin Edits a User (Priority: P2)

As an admin, I want to edit existing user accounts so that I can update display names, change roles, and manage group assignments.

**Why this priority**: Editing users completes the user lifecycle management alongside creation and deletion.

**Independent Test**: Can be fully tested by logging in as an admin, selecting a user from the list, changing their display name and role, saving, and verifying the changes persist.

**Acceptance Scenarios**:

1. **Given** an admin on the Users tab, **When** they select a user and edit their display name, role, or group assignments, then save, **Then** the changes are persisted and reflected in the user list.
2. **Given** an admin editing a user, **When** they change a user's role, **Then** the new role takes effect on the user's next request (or current session is updated).
3. **Given** an admin editing a user, **When** they assign or remove the user from groups, **Then** the group memberships are updated and the user's permissions change accordingly.

---

### User Story 6 - Admin Resets a User's Password (Priority: P3)

As an admin, I want to reset another user's password so that I can help users who have been locked out or forgotten their credentials.

**Why this priority**: Password resets are an important admin capability but less frequent than user creation or editing. Admins can set a new password without needing the user's current password.

**Independent Test**: Can be fully tested by logging in as an admin, selecting a user, resetting their password to a new value, and verifying the user can log in with the new password.

**Acceptance Scenarios**:

1. **Given** an admin on the Users tab, **When** they select a user and choose "Reset Password", enter a new password (8+ characters), and confirm, **Then** the user's password is changed and all their active sessions are invalidated.
2. **Given** an admin resetting a password, **When** they enter a password shorter than 8 characters, **Then** the system shows a validation error.

---

### User Story 7 - Admin Deletes a User (Priority: P3)

As an admin, I want to delete user accounts so that I can remove access for people who no longer need it.

**Why this priority**: Deletion is the least-frequent admin action and is destructive, so it includes safeguards.

**Independent Test**: Can be fully tested by logging in as an admin, selecting a user, clicking Delete, confirming in the confirmation dialog, and verifying the user no longer appears in the list and cannot log in.

**Acceptance Scenarios**:

1. **Given** an admin on the Users tab, **When** they select a user (not themselves) and click "Delete", **Then** a confirmation dialog appears asking them to confirm the deletion.
2. **Given** an admin who has confirmed deletion, **When** the deletion is processed, **Then** the user is removed from the system, their sessions are invalidated, and they no longer appear in the user list.
3. **Given** an admin on the Users tab, **When** they attempt to delete their own account, **Then** the system prevents it and shows a message that admins cannot delete themselves.

---

### Edge Cases

- What happens when an admin demotes themselves from admin role? The system should prevent admins from changing their own role to avoid lockout (at least one admin must remain).
- What happens when the last admin is being deleted? The system must prevent deleting the last admin user to avoid admin lockout.
- What happens when a user changes their password while having multiple active sessions? All other sessions for that user are invalidated immediately.
- What happens when an admin and a user simultaneously edit the same user profile? The last save wins; the UI should show the current state on reload.
- What happens if a user enters only whitespace as a display name? The system treats it as empty and shows a validation error.

## Requirements *(mandatory)*

### Functional Requirements

**Self-Service Profile (all users)**

- **FR-001**: Users MUST be able to view and update their own display name from the Settings → General tab.
- **FR-002**: Users MUST be able to change their own password by providing their current password, a new password, and a confirmation of the new password.
- **FR-003**: The system MUST verify the user's current password before allowing a password change.
- **FR-004**: The system MUST enforce a minimum password length of 8 characters for all password operations.
- **FR-005**: The system MUST invalidate all active sessions for a user when their password is changed (by self or admin).
- **FR-006**: Display names MUST be non-empty and not exceed 100 characters.

**Admin User Management (admin role only)**

- **FR-007**: Admin users MUST be able to view a list of all users with their username, display name, role, group memberships, and last login time.
- **FR-008**: Admin users MUST be able to create new users by specifying username, display name, password, and role.
- **FR-009**: The system MUST enforce unique usernames when creating new users.
- **FR-010**: Admin users MUST be able to edit other users' display names, roles, and group assignments.
- **FR-011**: Admin users MUST be able to reset another user's password without providing the user's current password.
- **FR-012**: Admin users MUST be able to delete users, with a confirmation step before deletion is final.
- **FR-013**: The system MUST prevent an admin from deleting their own account.
- **FR-014**: The Users management tab MUST only be visible and accessible to users with the admin role.
- **FR-015**: The system MUST prevent removing or demoting the last admin user to avoid admin lockout.

**Integration**

- **FR-016**: User management MUST integrate with the existing role-based access control and group system — group assignments made through user editing MUST be reflected in permissions immediately.
- **FR-017**: The system MUST hash all passwords using argon2id before storage.

### Key Entities

- **User**: Represents an individual with access to the application. Key attributes: unique username, display name, role (admin or user), password (stored as hash), last login timestamp. A user can belong to zero or more groups.
- **Session**: Represents an active authenticated session for a user. Sessions are invalidated when the user's password is changed.
- **Group**: Represents a named collection of users for permission management. Groups are managed separately but user-to-group assignments are managed through both the existing group UI and the new user edit form.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can update their display name in under 30 seconds from the Settings page.
- **SC-002**: Users can change their own password in under 1 minute, including entering current and new passwords.
- **SC-003**: Admins can create a new user account in under 1 minute from the Users tab.
- **SC-004**: Admins can locate any user in the user list and view their details within 10 seconds.
- **SC-005**: Password changes (by self or admin reset) invalidate all other sessions for that user within 5 seconds.
- **SC-006**: 100% of admin-only features are inaccessible to non-admin users (no UI elements visible, no endpoints accessible).
- **SC-007**: All password operations enforce the 8-character minimum and use secure hashing — no plaintext passwords are stored or transmitted in responses.

## Assumptions

- The existing user table already contains id, username, displayName, role, and passwordHash columns. A last login timestamp field may need to be added if not already present.
- The existing session-based authentication system will be extended (not replaced) to support session invalidation on password change.
- The existing Settings page with tab navigation will be extended with the self-service profile fields on the General tab and a new Users tab for admins.
- The existing RBAC/group system is stable and will not change during this feature's implementation.
- Only two roles exist: "admin" and "user". No new roles are introduced by this feature.
- The application is used within a household/small team context; the user list does not need pagination, search, or filtering for the initial implementation (assumed fewer than 50 users).
- The user menu component already displays the current user's display name and will reactively update when the name changes.
- Username is immutable after account creation — admins cannot change a user's username.
