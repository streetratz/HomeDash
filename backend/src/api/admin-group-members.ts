/**
 * T035 (012-RBAC, US3): Group membership API routes.
 *
 * Routes:
 *   GET    /api/admin/groups/:groupId/members             — list group members
 *   POST   /api/admin/groups/:groupId/members             — add member
 *   DELETE /api/admin/groups/:groupId/members/:userId      — remove member
 *   GET    /api/admin/users/:userId/groups                 — list user's groups
 */

import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, UuidSchema } from '../lib/validation.js';
import { MembershipAddSchema } from '../lib/rbac-validation.js';
import {
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  listUserGroups,
} from '../services/membershipService.js';
import { z } from 'zod';

const GroupIdParams = z.object({ groupId: UuidSchema });
const GroupMemberParams = z.object({ groupId: UuidSchema, userId: UuidSchema });
const UserIdParams = z.object({ userId: UuidSchema });

export function registerAdminGroupMemberRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/groups/:groupId/members ─────────────────────────────────
  app.get(
    '/api/admin/groups/:groupId/members',
    { preHandler: [requirePermission('users', 'view')] },
    async (request, reply) => {
      const { groupId } = validate(GroupIdParams, request.params);
      const members = listGroupMembers(groupId);
      return reply.status(200).send({ members });
    },
  );

  // ── POST /api/admin/groups/:groupId/members ────────────────────────────────
  app.post(
    '/api/admin/groups/:groupId/members',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const { groupId } = validate(GroupIdParams, request.params);
      const body = validate(MembershipAddSchema, request.body);
      addGroupMember(groupId, body.userId);
      return reply.status(201).send({ ok: true });
    },
  );

  // ── DELETE /api/admin/groups/:groupId/members/:userId ──────────────────────
  app.delete(
    '/api/admin/groups/:groupId/members/:userId',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const { groupId, userId } = validate(GroupMemberParams, request.params);
      removeGroupMember(groupId, userId);
      return reply.status(204).send();
    },
  );

  // ── GET /api/admin/users/:userId/groups ────────────────────────────────────
  app.get(
    '/api/admin/users/:userId/groups',
    { preHandler: [requirePermission('users', 'view')] },
    async (request, reply) => {
      const { userId } = validate(UserIdParams, request.params);
      const userGroups = listUserGroups(userId);
      return reply.status(200).send({ groups: userGroups });
    },
  );
}
