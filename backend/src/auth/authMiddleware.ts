/**
 * T048 (US1): Auth middleware — load session from cookie and attach user to request.
 *
 * Registers a global `onRequest` hook that:
 * 1. Reads the session cookie (`homedash_sid`).
 * 2. Loads the corresponding session row (joined with user) from SQLite.
 * 3. Attaches `request.user` and `request.csrfSecret` for downstream handlers.
 * 4. Opportunistically touches the session (updates `lastSeenAt`).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import '@fastify/cookie'; // ensure cookie type augmentation is applied
import { SESSION_COOKIE_NAME, getSession, touchSession } from './sessionStore.js';

// ─── Fastify type augmentation ────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'standard';
  /** Effective permissions from all group memberships (additive union). */
  permissions: Set<string>;
  /** Group IDs the user belongs to. */
  groupIds: string[];
  /** True if user is a member of the Administrators built-in group. */
  isAdmin: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user, populated by auth middleware. Null for unauthenticated requests. */
    user: AuthUser | null;
    /** Active session ID (from cookie), populated by auth middleware. */
    sessionId: string | null;
    /** Per-session CSRF secret, populated by auth middleware for authenticated requests. */
    csrfSecret: string | null;
  }
}

/**
 * Register the auth middleware on the Fastify instance.
 * Must be called once during server setup, after cookie plugin registration.
 */
export function registerAuthMiddleware(app: FastifyInstance): void {
  // Decorate request with default values before any hook runs
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);
  app.decorateRequest('csrfSecret', null);

  app.addHook('onRequest', (request: FastifyRequest, _reply, done) => {
    const sessionId = request.cookies?.[SESSION_COOKIE_NAME];
    if (!sessionId) { done(); return; }

    try {
      const session = getSession(sessionId);
      if (!session) { done(); return; }

      request.user = {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
        permissions: session.permissions,
        groupIds: session.groupIds,
        isAdmin: session.isAdmin,
      };
      request.sessionId = session.sessionId;
      request.csrfSecret = session.csrfSecret;

      // Best-effort touch (sync — better-sqlite3 is synchronous)
      touchSession(sessionId);
    } catch (e) {
      // Session lookup failure should not break unauthenticated requests
      console.warn('[auth] Session lookup failed:', e instanceof Error ? e.message : e);
    }
    done();
  });
}
