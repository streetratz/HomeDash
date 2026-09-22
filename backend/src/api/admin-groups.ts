/**
 * T024 (012-RBAC, US2): Group CRUD API routes.
 *
 * Routes:
 *   GET    /api/admin/groups          — list all groups
 *   POST   /api/admin/groups          — create a group
 *   GET    /api/admin/groups/:groupId — get a group
 *   PATCH  /api/admin/groups/:groupId — update a group
 *   DELETE /api/admin/groups/:groupId — delete a group
 */

import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, UuidSchema } from '../lib/validation.js';
import { GroupCreateSchema, GroupUpdateSchema } from '../lib/rbac-validation.js';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../services/groupService.js';
import { z } from 'zod';

const GroupIdParams = z.object({ groupId: UuidSchema });

export function registerAdminGroupRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/groups ──────────────────────────────────────────────────
  app.get(
    '/api/admin/groups',
    { preHandler: [requirePermission('users', 'view')] },
    async (_request, reply) => {
      const result = listGroups();
      return reply.status(200).send({ groups: result });
    },
  );

  // ── POST /api/admin/groups ─────────────────────────────────────────────────
  app.post(
    '/api/admin/groups',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const body = validate(GroupCreateSchema, request.body);
      const group = createGroup({
        name: body.name,
        permissions: body.permissions ?? [],
        ...(body.description != null ? { description: body.description } : {}),
      });
      return reply.status(201).send({ group });
    },
  );

  // ── GET /api/admin/groups/:groupId ─────────────────────────────────────────
  app.get(
    '/api/admin/groups/:groupId',
    { preHandler: [requirePermission('users', 'view')] },
    async (request, reply) => {
      const { groupId } = validate(GroupIdParams, request.params);
      const group = getGroup(groupId);
      return reply.status(200).send({ group });
    },
  );

  // ── PATCH /api/admin/groups/:groupId ───────────────────────────────────────
  app.patch(
    '/api/admin/groups/:groupId',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const { groupId } = validate(GroupIdParams, request.params);
      const body = validate(GroupUpdateSchema, request.body);
      const group = updateGroup(groupId, {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.permissions != null ? { permissions: body.permissions } : {}),
      });
      return reply.status(200).send({ group });
    },
  );

  // ── DELETE /api/admin/groups/:groupId ──────────────────────────────────────
  app.delete(
    '/api/admin/groups/:groupId',
    { preHandler: [requirePermission('users', 'manage'), assertCsrf] },
    async (request, reply) => {
      const { groupId } = validate(GroupIdParams, request.params);
      deleteGroup(groupId);
      return reply.status(204).send();
    },
  );
}
