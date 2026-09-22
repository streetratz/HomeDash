/**
 * T029 / T067 (US2): User route registration.
 * Authenticated-user routes — preferences get/put, profile update, password change.
 *
 * All routes require a valid session cookie.
 * State-changing routes (PUT) also require a valid CSRF token.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, ThemeModeSchema, UuidSchema, DisplayNameSchema, PasswordSchema } from '../lib/validation.js';
import {
  getUserPreferences,
  updateUserPreferences,
  type UpdateUserPreferencesInput,
} from '../services/userPreferencesService.js';
import { getDashboardWithChildren } from '../services/dashboardService.js';
import { getDb } from '../db/drizzle.js';
import { users } from '../db/schema/index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { destroyUserSessions } from '../auth/sessionStore.js';
import { ErrorCode } from '../lib/errors.js';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const UserPreferencesUpdateSchema = z
  .object({
    themeMode: ThemeModeSchema.optional(),
    webDashboardId: UuidSchema.nullable().optional(),
    mobileDashboardId: UuidSchema.nullable().optional(),
  })
  .strict();

const ProfileUpdateSchema = z.object({
  displayName: DisplayNameSchema,
}).strict();

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: PasswordSchema,
}).strict();

// ── Route registration ────────────────────────────────────────────────────────

export function registerUserRoutes(app: FastifyInstance): void {
  // ── T067 (US2): GET /api/user/preferences ─────────────────────────────────
  app.get('/api/user/preferences', async (request, reply) => {
    requireAuth(request, reply);

    const prefs = getUserPreferences(request.user!.id);
    return reply.status(200).send(prefs);
  });

  // ── T067 (US2): PUT /api/user/preferences ─────────────────────────────────
  app.put('/api/user/preferences', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const updates = validate(UserPreferencesUpdateSchema, request.body) as UpdateUserPreferencesInput;
    const updated = updateUserPreferences(request.user!.id, updates);
    return reply.status(200).send(updated);
  });

  // ── PUT /api/user/profile — update display name ───────────────────────────
  app.put('/api/user/profile', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = validate(ProfileUpdateSchema, request.body);
    const trimmed = body.displayName.trim();
    if (!trimmed) {
      return reply.status(422).send({
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Display name cannot be empty.',
      });
    }

    const db = getDb();
    const userId = request.user!.id;

    db.update(users)
      .set({ displayName: trimmed, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .run();

    const updated = db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    }).from(users).where(eq(users.id, userId)).get();

    return reply.status(200).send(updated);
  });

  // ── PUT /api/user/password — change own password ──────────────────────────
  app.put('/api/user/password', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = validate(PasswordChangeSchema, request.body);

    const db = getDb();
    const userId = request.user!.id;

    const user = db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).get();
    if (!user) {
      return reply.status(401).send({ error: ErrorCode.UNAUTHORIZED, message: 'User not found.' });
    }

    const passwordOk = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!passwordOk) {
      return reply.status(401).send({ error: ErrorCode.UNAUTHORIZED, message: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(body.newPassword);
    db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .run();

    // Invalidate all other sessions — keep current
    destroyUserSessions(userId, request.sessionId!);

    return reply.status(200).send({ message: 'Password changed successfully' });
  });

  // ── Phase R3: GET /api/dashboards/:dashboardId — authenticated read ─────
  app.get('/api/dashboards/:dashboardId', async (request: FastifyRequest, reply) => {
    requireAuth(request, reply);
    const id = (request.params as Record<string, string>)['dashboardId'] ?? '';
    const view = getDashboardWithChildren(id);
    return reply.status(200).send(view);
  });
}
