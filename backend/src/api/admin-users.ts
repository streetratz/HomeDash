/**
 * Admin user CRUD API routes.
 *
 * Routes:
 *   GET    /api/admin/users                  — list all users
 *   POST   /api/admin/users                  — create user
 *   PUT    /api/admin/users/:userId          — update user
 *   DELETE /api/admin/users/:userId          — delete user
 *   PUT    /api/admin/users/:userId/password — admin reset password
 */

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq, count, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, UuidSchema, UsernameSchema, DisplayNameSchema, PasswordSchema } from '../lib/validation.js';
import { getDb } from '../db/drizzle.js';
import { users, userGroupMemberships, groups, userPreferences } from '../db/schema/index.js';
import { hashPassword } from '../auth/password.js';
import { destroyUserSessions } from '../auth/sessionStore.js';
import { ErrorCode, isUniqueConstraintError } from '../lib/errors.js';

/** Well-known UUID for the built-in Administrators group (from seed migration). */
const ADMINISTRATORS_GROUP_ID = '00000000-0000-4000-8000-000000000001';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const CreateUserSchema = z.object({
  username: UsernameSchema,
  displayName: DisplayNameSchema,
  password: PasswordSchema,
  role: z.enum(['admin', 'standard']),
  groupIds: z.array(UuidSchema).optional(),
}).strict();

const UpdateUserSchema = z.object({
  displayName: DisplayNameSchema.optional(),
  role: z.enum(['admin', 'standard']).optional(),
  groupIds: z.array(UuidSchema).optional(),
}).strict();

const ResetPasswordSchema = z.object({
  password: PasswordSchema,
}).strict();

const UserIdParams = z.object({ userId: UuidSchema });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUserWithGroups(db: ReturnType<typeof getDb>, userId: string) {
  const user = db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).get();

  if (!user) return null;

  const memberGroups = db
    .select({ id: groups.id, name: groups.name })
    .from(userGroupMemberships)
    .innerJoin(groups, eq(userGroupMemberships.groupId, groups.id))
    .where(eq(userGroupMemberships.userId, userId))
    .all();

  return { ...user, groups: memberGroups };
}

function countAdmins(db: ReturnType<typeof getDb>): number {
  const result = db.select({ value: count() }).from(users).where(eq(users.role, 'admin')).get();
  return result?.value ?? 0;
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerAdminUserRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/users ──────────────────────────────────────────────────
  app.get(
    '/api/admin/users',
    { preHandler: [requirePermission('users', 'manage')] },
    async (_request, reply) => {
      const db = getDb();

      const allUsers = db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.username).all();

      // Fetch group memberships for all users
      const allMemberships = db
        .select({
          userId: userGroupMemberships.userId,
          groupId: groups.id,
          groupName: groups.name,
        })
        .from(userGroupMemberships)
        .innerJoin(groups, eq(userGroupMemberships.groupId, groups.id))
        .all();

      // Build a map of userId → groups
      const groupMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const m of allMemberships) {
        if (!groupMap.has(m.userId)) groupMap.set(m.userId, []);
        groupMap.get(m.userId)!.push({ id: m.groupId, name: m.groupName });
      }

      const result = allUsers.map((u) => ({
        ...u,
        groups: groupMap.get(u.id) ?? [],
      }));

      return reply.status(200).send({ users: result });
    },
  );

  // ── POST /api/admin/users ─────────────────────────────────────────────────
  app.post(
    '/api/admin/users',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const db = getDb();
      const body = validate(CreateUserSchema, request.body);

      // Check username uniqueness
      const existing = db.select({ id: users.id }).from(users).where(eq(users.username, body.username)).get();
      if (existing) {
        return reply.status(409).send({
          error: ErrorCode.RESOURCE_CONFLICT,
          message: 'Username is already taken.',
        });
      }

      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(body.password);
      const now = new Date().toISOString();

      // Race guard: if a concurrent request already took the username, the unique
      // constraint fires and we return 409 instead of a raw 500.
      try {
        db.transaction((tx) => {
          tx.insert(users).values({
            id: userId,
            username: body.username,
            displayName: body.displayName,
            role: body.role,
            passwordHash,
            createdAt: now,
            updatedAt: now,
          }).run();

          // Create default user preferences
          tx.insert(userPreferences).values({ userId, themeMode: 'dark', updatedAt: now }).run();

          // Build group list — ensure admin role includes Administrators group
          const groupIds = new Set(body.groupIds ?? []);
          if (body.role === 'admin') {
            groupIds.add(ADMINISTRATORS_GROUP_ID);
          }

          for (const groupId of groupIds) {
            tx.insert(userGroupMemberships).values({
              id: crypto.randomUUID(),
              userId,
              groupId,
              createdAt: now,
            }).run();
          }
        });
      } catch (err: unknown) {
        if (isUniqueConstraintError(err)) {
          return reply.status(409).send({
            error: ErrorCode.RESOURCE_CONFLICT,
            message: 'Username is already taken.',
          });
        }
        throw err;
      }

      const created = getUserWithGroups(db, userId);
      return reply.status(201).send(created);
    },
  );

  // ── PUT /api/admin/users/:userId ──────────────────────────────────────────
  app.put(
    '/api/admin/users/:userId',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const db = getDb();
      const { userId } = validate(UserIdParams, request.params);
      const body = validate(UpdateUserSchema, request.body);

      const existing = db.select({
        id: users.id,
        role: users.role,
      }).from(users).where(eq(users.id, userId)).get();

      if (!existing) {
        return reply.status(404).send({
          error: ErrorCode.NOT_FOUND,
          message: 'User not found.',
        });
      }

      // Role change checks
      if (body.role !== undefined && body.role !== existing.role) {
        // Cannot change own role
        if (request.user!.id === userId) {
          return reply.status(409).send({
            error: ErrorCode.RESOURCE_CONFLICT,
            message: 'Cannot change your own role.',
          });
        }
        // Cannot demote last admin
        if (existing.role === 'admin' && body.role !== 'admin') {
          const adminCount = countAdmins(db);
          if (adminCount <= 1) {
            return reply.status(409).send({
              error: ErrorCode.RESOURCE_CONFLICT,
              message: 'Cannot demote the last admin.',
            });
          }
        }
      }

      const now = new Date().toISOString();

      try {
        db.transaction((tx) => {
          const updates: Record<string, string> = { updatedAt: now };
          if (body.displayName !== undefined) updates['displayName'] = body.displayName;
          if (body.role !== undefined) updates['role'] = body.role;

          if (Object.keys(updates).length > 1) {
            tx.update(users).set(updates).where(eq(users.id, userId)).run();
          }

          // Sync group memberships if provided
          if (body.groupIds !== undefined || body.role !== undefined) {
            const groupIds = new Set(body.groupIds ?? []);

            // If groupIds not explicitly provided, preserve existing memberships
            if (body.groupIds === undefined) {
              const existingMemberships = tx
                .select({ groupId: userGroupMemberships.groupId })
                .from(userGroupMemberships)
                .where(eq(userGroupMemberships.userId, userId))
                .all();
              for (const m of existingMemberships) groupIds.add(m.groupId);
            }

            // Sync role with Administrators group membership
            const effectiveRole = body.role ?? existing.role;
            if (effectiveRole === 'admin') {
              groupIds.add(ADMINISTRATORS_GROUP_ID);
            } else {
              groupIds.delete(ADMINISTRATORS_GROUP_ID);
            }

            // Prevent removing last Administrators group member
            if (!groupIds.has(ADMINISTRATORS_GROUP_ID)) {
              const adminMemberCount = tx
                .select({ value: count() })
                .from(userGroupMemberships)
                .where(eq(userGroupMemberships.groupId, ADMINISTRATORS_GROUP_ID))
                .get();
              const isCurrentlyAdmin = tx
                .select({ id: userGroupMemberships.id })
                .from(userGroupMemberships)
                .where(and(
                  eq(userGroupMemberships.userId, userId),
                  eq(userGroupMemberships.groupId, ADMINISTRATORS_GROUP_ID),
                ))
                .get();
              if (isCurrentlyAdmin && (adminMemberCount?.value ?? 0) <= 1) {
                throw new Error('LAST_ADMIN_GROUP_MEMBER');
              }
            }

            // Replace all memberships
            tx.delete(userGroupMemberships).where(eq(userGroupMemberships.userId, userId)).run();
            for (const groupId of groupIds) {
              tx.insert(userGroupMemberships).values({
                id: crypto.randomUUID(),
                userId,
                groupId,
                createdAt: now,
              }).run();
            }
          }
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'LAST_ADMIN_GROUP_MEMBER') {
          return reply.status(409).send({
            error: ErrorCode.RESOURCE_CONFLICT,
            message: 'Cannot remove the last member of the Administrators group.',
          });
        }
        throw err;
      }

      const updated = getUserWithGroups(db, userId);
      return reply.status(200).send(updated);
    },
  );

  // ── DELETE /api/admin/users/:userId ────────────────────────────────────────
  app.delete(
    '/api/admin/users/:userId',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const db = getDb();
      const { userId } = validate(UserIdParams, request.params);

      const existing = db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).get();
      if (!existing) {
        return reply.status(404).send({
          error: ErrorCode.NOT_FOUND,
          message: 'User not found.',
        });
      }

      // Cannot delete self
      if (request.user!.id === userId) {
        return reply.status(409).send({
          error: ErrorCode.RESOURCE_CONFLICT,
          message: 'Cannot delete your own account.',
        });
      }

      // Cannot delete last admin
      if (existing.role === 'admin') {
        const adminCount = countAdmins(db);
        if (adminCount <= 1) {
          return reply.status(409).send({
            error: ErrorCode.RESOURCE_CONFLICT,
            message: 'Cannot delete the last admin.',
          });
        }
      }

      db.delete(users).where(eq(users.id, userId)).run();
      return reply.status(204).send();
    },
  );

  // ── PUT /api/admin/users/:userId/password ─────────────────────────────────
  app.put(
    '/api/admin/users/:userId/password',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const db = getDb();
      const { userId } = validate(UserIdParams, request.params);
      const body = validate(ResetPasswordSchema, request.body);

      const existing = db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
      if (!existing) {
        return reply.status(404).send({
          error: ErrorCode.NOT_FOUND,
          message: 'User not found.',
        });
      }

      const newHash = await hashPassword(body.password);
      db.update(users)
        .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
        .run();

      // Invalidate ALL sessions for the user (no exclusion)
      destroyUserSessions(userId);

      return reply.status(200).send({ message: 'Password reset successfully' });
    },
  );
}
