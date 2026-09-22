# API Contracts: User Management

**Feature**: 038-user-management
**Date**: 2026-06-22

## Table of Contents
- [Self-Service Endpoints](#self-service-endpoints)
  - [PUT /api/user/profile](#put-apiuserprofile)
  - [PUT /api/user/password](#put-apiuserpassword)
- [Admin Endpoints](#admin-endpoints)
  - [GET /api/admin/users](#get-apiadminusers)
  - [POST /api/admin/users](#post-apiadminusers)
  - [PUT /api/admin/users/:userId](#put-apiadminusersuserid)
  - [DELETE /api/admin/users/:userId](#delete-apiadminusersuserid)
  - [PUT /api/admin/users/:userId/password](#put-apiadminusersuseridpassword)
- [Common Patterns](#common-patterns)

---

## Self-Service Endpoints

Auth requirement: `requireAuth` (any authenticated user)

### PUT /api/user/profile

Update the current user's display name.

**Request**:
```json
{
  "displayName": "string (1-100 chars, required)"
}
```

**Headers**: `x-csrf-token: <token>` (required)

**Response 200**:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "role": "admin | standard"
  }
}
```

**Response 400** (validation error):
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "displayName", "message": "Display name is required" }
  ]
}
```

---

### PUT /api/user/password

Change the current user's password. Requires current password verification.

**Request**:
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (min 8 chars, required)"
}
```

**Headers**: `x-csrf-token: <token>` (required)

**Response 200**:
```json
{
  "message": "Password changed successfully"
}
```

**Response 400** (validation error):
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "newPassword", "message": "Password must be at least 8 characters" }
  ]
}
```

**Response 401** (wrong current password):
```json
{
  "error": "Current password is incorrect"
}
```

**Side effects**: All other sessions for the current user are invalidated (deleted from sessions table). The current session remains active.

---

## Admin Endpoints

Auth requirement: `requirePermission('users', 'manage')` + `assertCsrf` on mutations

### GET /api/admin/users

List all users with their group memberships.

**Response 200**:
```json
{
  "users": [
    {
      "id": "string",
      "username": "string",
      "displayName": "string",
      "role": "admin | standard",
      "lastLoginAt": "string (ISO 8601) | null",
      "createdAt": "string (ISO 8601)",
      "groups": [
        {
          "id": "string",
          "name": "string"
        }
      ]
    }
  ]
}
```

**Notes**: `passwordHash` is NEVER included in responses. Users are returned in alphabetical order by username.

---

### POST /api/admin/users

Create a new user account.

**Request**:
```json
{
  "username": "string (required, unique)",
  "displayName": "string (1-100 chars, required)",
  "password": "string (min 8 chars, required)",
  "role": "admin | standard (required)",
  "groupIds": ["string"] 
}
```

**Headers**: `x-csrf-token: <token>` (required)

**Response 201**:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "role": "admin | standard",
    "createdAt": "string (ISO 8601)",
    "groups": [
      { "id": "string", "name": "string" }
    ]
  }
}
```

**Response 400** (validation error):
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "username", "message": "Username is required" }
  ]
}
```

**Response 409** (username taken):
```json
{
  "error": "Username already exists"
}
```

---

### PUT /api/admin/users/:userId

Update an existing user's display name, role, and/or group assignments.

**URL params**: `userId` (string, required)

**Request**:
```json
{
  "displayName": "string (1-100 chars, optional)",
  "role": "admin | standard (optional)",
  "groupIds": ["string"]
}
```

**Headers**: `x-csrf-token: <token>` (required)

**Response 200**:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "role": "admin | standard",
    "lastLoginAt": "string (ISO 8601) | null",
    "createdAt": "string (ISO 8601)",
    "groups": [
      { "id": "string", "name": "string" }
    ]
  }
}
```

**Response 404**:
```json
{
  "error": "User not found"
}
```

**Response 409** (business rule violation):
```json
{
  "error": "Cannot demote the last admin user"
}
```
```json
{
  "error": "Cannot change your own role"
}
```

---

### DELETE /api/admin/users/:userId

Delete a user account. Cascades to sessions and group memberships.

**URL params**: `userId` (string, required)

**Headers**: `x-csrf-token: <token>` (required)

**Response 204**: No content (successful deletion)

**Response 404**:
```json
{
  "error": "User not found"
}
```

**Response 409** (business rule violation):
```json
{
  "error": "Cannot delete your own account"
}
```
```json
{
  "error": "Cannot delete the last admin user"
}
```

**Side effects**: All sessions for the deleted user are cascade-deleted. All group memberships are cascade-deleted.

---

### PUT /api/admin/users/:userId/password

Reset a user's password (admin action, no current password required).

**URL params**: `userId` (string, required)

**Request**:
```json
{
  "password": "string (min 8 chars, required)"
}
```

**Headers**: `x-csrf-token: <token>` (required)

**Response 200**:
```json
{
  "message": "Password reset successfully"
}
```

**Response 400** (validation error):
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

**Response 404**:
```json
{
  "error": "User not found"
}
```

**Side effects**: All sessions for the target user are invalidated (deleted from sessions table).

---

## Common Patterns

### Authentication & Authorization
- All endpoints require authentication via session cookie (`homedash_session`).
- Self-service endpoints: `requireAuth` middleware (any logged-in user).
- Admin endpoints: `requirePermission('users', 'manage')` middleware (admins and users with explicit permission).
- All mutating endpoints: `assertCsrf` middleware validates `x-csrf-token` header.

### Error Response Shape
All error responses follow the existing pattern:
```json
{
  "error": "string (human-readable message)",
  "details": [{ "field": "string", "message": "string" }]
}
```
`details` array is present only for validation errors.

### Request Validation
All request bodies are validated using Zod schemas via the existing `validate()` helper. Validation failures return 400 with the standard error shape.

### ID Generation
New user and membership IDs use UUID v4, consistent with all other entities in the system.
