/**
 * 013-app-shortcuts: Admin API routes for shortcut and group CRUD + reorder.
 * All routes require admin auth + CSRF for mutations.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin, requireAuth } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate } from '../lib/validation.js';
import {
  CreateShortcutSchema,
  UpdateShortcutSchema,
  CreateGroupSchema,
  UpdateGroupSchema,
  ReorderSchema,
  listShortcuts,
  createShortcut,
  updateShortcut,
  deleteShortcut,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  reorderShortcuts,
  reorderGroups,
} from '../services/appShortcutService.js';

export function registerAdminAppShortcutRoutes(app: FastifyInstance): void {
  // ── GET /api/app-shortcuts/:widgetId/shortcuts ───────────────────────────
  // The display read (#100). The widget used to call the admin route below,
  // so a standard user saw an empty shortcut list. Shortcuts are link targets
  // and group names — nothing privileged — so any signed-in user may read
  // them. Every mutation still lives under /api/admin and stays admin-only.
  app.get<{ Params: { widgetId: string } }>(
    '/api/app-shortcuts/:widgetId/shortcuts',
    async (request, reply) => {
      requireAuth(request, reply);
      const shortcuts = listShortcuts(request.params.widgetId);
      const groups = listGroups(request.params.widgetId);
      return reply.status(200).send({ groups, shortcuts });
    },
  );

  // ── GET /api/admin/app-shortcuts/:widgetId/shortcuts ─────────────────────
  app.get<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/shortcuts',
    async (request, reply) => {
      await requireAdmin(request, reply);
      const shortcuts = listShortcuts(request.params.widgetId);
      const groups = listGroups(request.params.widgetId);
      return reply.status(200).send({ groups, shortcuts });
    },
  );

  // ── POST /api/admin/app-shortcuts/:widgetId/shortcuts ────────────────────
  app.post<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/shortcuts',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(CreateShortcutSchema, request.body);
      const shortcut = createShortcut(request.params.widgetId, body);
      return reply.status(201).send(shortcut);
    },
  );

  // ── PUT /api/admin/app-shortcuts/:widgetId/shortcuts/:shortcutId ─────────
  app.put<{ Params: { widgetId: string; shortcutId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/shortcuts/:shortcutId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(UpdateShortcutSchema, request.body);
      const shortcut = updateShortcut(request.params.shortcutId, body);
      return reply.status(200).send(shortcut);
    },
  );

  // ── DELETE /api/admin/app-shortcuts/:widgetId/shortcuts/:shortcutId ──────
  app.delete<{ Params: { widgetId: string; shortcutId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/shortcuts/:shortcutId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deleteShortcut(request.params.shortcutId);
      return reply.status(204).send();
    },
  );

  // ── POST /api/admin/app-shortcuts/:widgetId/shortcuts/reorder ────────────
  app.post<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/shortcuts/reorder',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(ReorderSchema, request.body);
      const shortcuts = reorderShortcuts(request.params.widgetId, body.orderedIds);
      const groups = listGroups(request.params.widgetId);
      return reply.status(200).send({ groups, shortcuts });
    },
  );

  // ── GET /api/admin/app-shortcuts/:widgetId/groups ────────────────────────
  app.get<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/groups',
    async (request, reply) => {
      await requireAdmin(request, reply);
      const groups = listGroups(request.params.widgetId);
      return reply.status(200).send(groups);
    },
  );

  // ── POST /api/admin/app-shortcuts/:widgetId/groups ───────────────────────
  app.post<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/groups',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(CreateGroupSchema, request.body);
      const group = createGroup(request.params.widgetId, body);
      return reply.status(201).send(group);
    },
  );

  // ── PUT /api/admin/app-shortcuts/:widgetId/groups/:groupId ───────────────
  app.put<{ Params: { widgetId: string; groupId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/groups/:groupId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(UpdateGroupSchema, request.body);
      const group = updateGroup(request.params.groupId, body);
      return reply.status(200).send(group);
    },
  );

  // ── DELETE /api/admin/app-shortcuts/:widgetId/groups/:groupId ────────────
  app.delete<{ Params: { widgetId: string; groupId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/groups/:groupId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deleteGroup(request.params.groupId);
      return reply.status(204).send();
    },
  );

  // ── POST /api/admin/app-shortcuts/:widgetId/groups/reorder ───────────────
  app.post<{ Params: { widgetId: string } }>(
    '/api/admin/app-shortcuts/:widgetId/groups/reorder',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(ReorderSchema, request.body);
      const groups = reorderGroups(request.params.widgetId, body.orderedIds);
      return reply.status(200).send(groups);
    },
  );
}
