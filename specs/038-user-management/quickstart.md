# Quickstart: User Management

**Feature**: 038-user-management
**Date**: 2026-06-22

## Overview

This feature adds self-service profile management (display name + password change) for all users and a full admin user management UI (CRUD + password reset) to the HomeDash Settings page.

## Prerequisites

- Node.js 20+, pnpm 9+
- Existing HomeDash dev environment running (`pnpm dev`)
- At least one admin user account (created via first-run flow)

## New Environment Variables

None. This feature uses existing auth configuration.

## New Dependencies

None. All required packages (argon2, drizzle-orm, @tanstack/react-query, shadcn/ui) are already installed.

## Schema Migration

A new `last_login_at` column is added to the `users` table:

```bash
# Generate the migration
cd backend && pnpm drizzle-kit generate

# Migration is auto-applied on app startup
pnpm dev
```

The migration is non-breaking — the new column is nullable with no default.

## New API Endpoints

### Self-Service (all authenticated users)
| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/user/profile` | Update own display name |
| PUT | `/api/user/password` | Change own password (requires current password) |

### Admin User Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users with groups |
| POST | `/api/admin/users` | Create new user |
| PUT | `/api/admin/users/:userId` | Update user (name, role, groups) |
| DELETE | `/api/admin/users/:userId` | Delete user (with confirmation) |
| PUT | `/api/admin/users/:userId/password` | Reset user password |

## UI Changes

### Settings → General Tab (all users)
- New "Profile" card with display name edit field + Save button
- New "Change Password" card with current password, new password, confirm password fields

### Settings → Users Tab (admin only)
- New tab visible only to admin users
- User list table showing username, display name, role, groups, last login
- "Create User" button → dialog with form
- Per-user actions: Edit (dialog), Reset Password (dialog), Delete (confirmation dialog)
- Safeguards: Cannot delete self, cannot demote last admin

## Testing

```bash
# Backend unit/integration tests
cd backend && pnpm test

# Frontend E2E tests
cd frontend && pnpm test:e2e
```

## Key Behavior Notes

- **Password changes invalidate sessions**: When a user changes their own password, all other sessions are terminated. When an admin resets a password, ALL sessions for that user are terminated.
- **Last admin protection**: The system prevents deleting or demoting the last admin user to avoid lockout.
- **Username immutability**: Usernames cannot be changed after account creation.
- **Group sync**: Group assignments changed via user edit take effect immediately for the user's permissions.
