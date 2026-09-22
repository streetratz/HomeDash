/**
 * T049 (US1): Role guard helpers for route handlers.
 * T005 (012-RBAC): Permission-based guard added.
 * Use these at the start of route handlers that require authentication or admin access.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../lib/errors.js';
import {
  hasPermission,
  type PermissionCategory,
  type PermissionLevel,
} from '../lib/permissions.js';

/**
 * Assert the request is from an authenticated user.
 * Throws 401 if not authenticated.
 */
export function requireAuth(request: FastifyRequest, _reply: FastifyReply): void {
  if (!request.user) {
    throw Errors.unauthorized('Authentication required');
  }
}

/**
 * `requireAuth` as a Fastify `preHandler`.
 *
 * **Must be async.** Fastify's hook runner treats a two-argument hook that
 * returns a non-thenable as callback-style and waits for a `done` that a void
 * function never calls — the request hangs forever instead of proceeding.
 * `requireAuth` itself stays synchronous because most callers invoke it inline
 * inside a handler.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function requireAuthHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  requireAuth(request, reply);
}

/**
 * Assert the request is from an authenticated admin user.
 * Checks RBAC `isAdmin` flag (membership in Administrators group).
 * Falls back to legacy `role` column during migration bridge.
 * Throws 401 if not authenticated; 403 if authenticated but not admin.
 * Must be async for Fastify preHandler compatibility.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  requireAuth(request, reply);
  const user = request.user!;
  // RBAC-aware: prefer isAdmin (group-based), fall back to legacy role
  const isAdmin = user.isAdmin ?? user.role === 'admin';
  if (!isAdmin) {
    throw Errors.forbidden('Admin access required');
  }
}

/**
 * Factory: returns a Fastify preHandler that requires a specific permission.
 * Usage: `{ preHandler: [requirePermission('dashboards', 'manage')] }`
 *
 * The outer function is synchronous — it returns the async handler.
 */
export function requirePermission(
  category: PermissionCategory,
  level: PermissionLevel,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    requireAuth(request, reply);
    const user = request.user!;
    // Admins bypass all permission checks
    const isAdmin = user.isAdmin ?? user.role === 'admin';
    if (isAdmin) return;

    if (!user.permissions || !hasPermission(user.permissions, category, level)) {
      throw Errors.forbidden(`Permission required: ${category}:${level}`);
    }
  };
}
