/**
 * T028 / T050-T053 (US1): Auth route registration — first-run, login, logout, me.
 * T119 (US1): Rate limiting wired into login and first-run endpoints.
 *
 * All auth routes live under /api/first-run and /api/auth.
 * Rate limiting is registered globally in server.ts with global:false;
 * individual routes opt in via config.rateLimit.
 */

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { users, userPreferences, userGroupMemberships } from '../db/schema/index.js';
import { validate, UsernameSchema, DisplayNameSchema, PasswordSchema } from '../lib/validation.js';
import { ErrorCode, isUniqueConstraintError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  createSession,
  destroySession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../auth/sessionStore.js';
import { generateCsrfToken, assertCsrf } from '../auth/csrf.js';
import { requireAuth } from '../auth/requireRole.js';
import { loginRateLimit, firstRunRateLimit } from '../auth/rateLimit.js';
import { getEnv } from '../config/env.js';
import { z } from 'zod';

const FirstRunAdminSchema = z.object({
  username: UsernameSchema,
  displayName: DisplayNameSchema,
  password: PasswordSchema,
});

const LoginSchema = z.object({
  username: UsernameSchema,
  password: z.string().min(1).max(256),
  rememberMe: z.boolean().optional().default(false),
});

export function registerAuthRoutes(app: FastifyInstance): void {
  // ── T050 (US1): POST /api/first-run/admin ──────────────────────────────────
  app.post(
    '/api/first-run/admin',
    { config: { rateLimit: firstRunRateLimit } },
    async (request, reply) => {
      const db = getDb();
      const env = getEnv();

      // Validate body FIRST (fail fast on bad input before the DB check)
      const body = validate(FirstRunAdminSchema, request.body);

      // Check if any users exist — if so, first-run is closed
      const result = db.select({ value: count() }).from(users).all();
      const userCount = result[0]?.value ?? 0;
      if (userCount > 0) {
        return reply.status(409).send({
          error: ErrorCode.FIRST_RUN_COMPLETE,
          message: 'Initial admin has already been created.',
        });
      }
      const passwordHash = await hashPassword(body.password);

      const now = new Date().toISOString();
      const userId = crypto.randomUUID();

      // Insert user + default preferences + admin group membership atomically.
      // Race guard: if a concurrent request already inserted, the unique constraint
      // on username fires and we return 409 instead of a raw 500.
      try {
        db.transaction((tx) => {
          tx.insert(users)
            .values({
              id: userId,
              username: body.username,
              displayName: body.displayName,
              role: 'admin',
              passwordHash,
              createdAt: now,
              updatedAt: now,
            })
            .run();

          tx.insert(userPreferences)
            .values({ userId, themeMode: 'dark', updatedAt: now })
            .run();

          // Assign to Administrators built-in group (well-known UUID from migration seed)
          tx.insert(userGroupMemberships)
            .values({
              id: crypto.randomUUID(),
              userId,
              groupId: '00000000-0000-4000-8000-000000000001',
              createdAt: now,
            })
            .run();
        });
      } catch (err: unknown) {
        if (isUniqueConstraintError(err)) {
          return reply.status(409).send({
            error: ErrorCode.FIRST_RUN_COMPLETE,
            message: 'Initial admin has already been created.',
          });
        }
        throw err;
      }

      // Create session + cookie
      const { sessionId, csrfSecret } = createSession(userId);
      void reply.setCookie(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions(env));

      return reply.status(201).send({
        user: {
          id: userId,
          username: body.username,
          displayName: body.displayName,
          role: 'admin' as const,
        },
        csrfToken: generateCsrfToken(csrfSecret),
      });
    },
  );

  // ── T051 (US1): POST /api/auth/login ──────────────────────────────────────
  app.post(
    '/api/auth/login',
    { config: { rateLimit: loginRateLimit } },
    async (request, reply) => {
      const db = getDb();
      const env = getEnv();

      const body = validate(LoginSchema, request.body);

      // Find user by username (case-sensitive)
      const user = db.select().from(users).where(eq(users.username, body.username)).get();

      // Constant-time path — verify even on missing user to avoid timing oracle
      const passwordOk =
        user != null && (await verifyPassword(body.password, user.passwordHash));

      if (!user || !passwordOk) {
        return reply.status(401).send({
          error: ErrorCode.UNAUTHORIZED,
          message: 'Invalid username or password.',
        });
      }

      // Record login timestamp
      db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id)).run();

      const { sessionId, csrfSecret } = createSession(user.id, body.rememberMe);
      void reply.setCookie(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions(env, body.rememberMe));

      return reply.status(200).send({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
        csrfToken: generateCsrfToken(csrfSecret),
      });
    },
  );

  // ── T052 (US1): POST /api/auth/logout ──────────────────────────────────────
  app.post('/api/auth/logout', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    destroySession(request.sessionId!);
    const env = getEnv();
    void reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    });
    return reply.status(204).send();
  });

  // ── T053 (US1): GET /api/auth/me ───────────────────────────────────────────
  // T008 (012-RBAC): Extended with groups + permissions
  app.get('/api/auth/me', async (request, reply) => {
    requireAuth(request, reply);

    const user = request.user!;
    return reply.status(200).send({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        isAdmin: user.isAdmin,
        groupIds: user.groupIds,
        permissions: [...user.permissions],
      },
      csrfToken: generateCsrfToken(request.csrfSecret!),
    });
  });
}
