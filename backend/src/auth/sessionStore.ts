/**
 * T046 (US1): Session store — SQLite-backed session management.
 * T006 (012-RBAC): Permission loading via group memberships.
 * Handles session creation, lookup, touch, and destruction.
 * Cookie settings are exported separately for registration in server.ts.
 */

import crypto from 'node:crypto';
import { eq, lt, and, ne } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { sessions, users, userGroupMemberships, groupPermissions, groups } from '../db/schema/index.js';
import { computeEffectivePermissions } from '../lib/permissions.js';
import { BUILT_IN_GROUP_SLUGS } from '../lib/permissions.js';
import type { Env } from '../config/env.js';

/** The session cookie name used across the application (matches OpenAPI spec). */
export const SESSION_COOKIE_NAME = 'homedash_session';

/** Session time-to-live in milliseconds (7 days). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Extended TTL for "remember me" sessions (30 days). */
export const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionWithUser {
  sessionId: string;
  csrfSecret: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'admin' | 'standard';
  expiresAt: string;
  /** Effective permissions from all group memberships. */
  permissions: Set<string>;
  /** Group IDs the user belongs to. */
  groupIds: string[];
  /** True if user is member of Administrators built-in group. */
  isAdmin: boolean;
}

/**
 * Create a new server-side session for the given user.
 * Returns the session ID (to be stored in the cookie) and the CSRF secret.
 */
export function createSession(userId: string, rememberMe?: boolean): { sessionId: string; csrfSecret: string } {
  const db = getDb();
  const now = new Date();
  const ttl = rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);

  const sessionId = crypto.randomUUID();
  const csrfSecret = crypto.randomBytes(32).toString('hex');

  db.insert(sessions).values({
    id: sessionId,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: now.toISOString(),
    csrfSecret,
  }).run();

  return { sessionId, csrfSecret };
}

/**
 * Load a session from the DB and join the user row.
 * Also loads the user's group memberships and computes effective permissions.
 * Returns null if the session does not exist or has expired.
 */
export function getSession(sessionId: string): SessionWithUser | null {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db
    .select({
      sessionId: sessions.id,
      csrfSecret: sessions.csrfSecret,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!row) return null;
  if (row.expiresAt <= now) {
    // Expired — clean up
    destroySession(sessionId);
    return null;
  }

  // Load group memberships + permissions in a single query
  const permRows = db
    .select({
      groupId: userGroupMemberships.groupId,
      groupSlug: groups.slug,
      category: groupPermissions.category,
      level: groupPermissions.level,
    })
    .from(userGroupMemberships)
    .innerJoin(groups, eq(userGroupMemberships.groupId, groups.id))
    .leftJoin(groupPermissions, eq(groups.id, groupPermissions.groupId))
    .where(eq(userGroupMemberships.userId, row.userId))
    .all();

  // Collect unique group IDs and check for Administrators membership
  const groupIdSet = new Set<string>();
  let isAdmin = false;
  const permEntries: Array<{ category: string; level: string }> = [];

  for (const pr of permRows) {
    groupIdSet.add(pr.groupId);
    if (pr.groupSlug === BUILT_IN_GROUP_SLUGS.ADMINISTRATORS) {
      isAdmin = true;
    }
    if (pr.category && pr.level) {
      permEntries.push({ category: pr.category, level: pr.level });
    }
  }

  const permissions = computeEffectivePermissions(permEntries);

  return {
    ...row,
    permissions,
    groupIds: [...groupIdSet],
    isAdmin,
  };
}

/**
 * Update lastSeenAt for the given session (session sliding window).
 */
export function touchSession(sessionId: string): void {
  const db = getDb();
  db.update(sessions)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(sessions.id, sessionId))
    .run();
}

/**
 * Delete a session from the DB (logout / invalidation).
 */
export function destroySession(sessionId: string): void {
  const db = getDb();
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

/**
 * Delete all sessions for a user, optionally excluding a specific session.
 * Used for password-change session invalidation.
 */
export function destroyUserSessions(userId: string, excludeSessionId?: string): void {
  const db = getDb();
  if (excludeSessionId) {
    db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, excludeSessionId))).run();
  } else {
    db.delete(sessions).where(eq(sessions.userId, userId)).run();
  }
}

/**
 * Purge all expired sessions (housekeeping — called opportunistically).
 */
export function purgeExpiredSessions(): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}

/**
 * Returns the cookie serialization options for the session cookie.
 * Secure flag defaults to env-controlled or off for HTTP LAN deployments.
 */
export function getSessionCookieOptions(env: Env, rememberMe?: boolean): {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge?: number;
} {
  const secure = env.COOKIE_SECURE ?? env.NODE_ENV === 'production';
  const base = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    secure,
  };
  if (rememberMe) {
    return { ...base, maxAge: Math.floor(REMEMBER_ME_TTL_MS / 1000) };
  }
  // Session cookie — no maxAge so the cookie expires when the browser closes
  return base;
}
