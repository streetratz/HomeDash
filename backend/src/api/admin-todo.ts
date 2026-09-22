/**
 * T004 (005): Todo list and item CRUD routes (admin only).
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  validate,
  CreateTodoListSchema,
  UpdateTodoListSchema,
  CreateTodoItemSchema,
  UpdateTodoItemSchema,
  ReorderItemsSchema,
} from '../lib/validation.js';
import {
  getListsForUser,
  createList,
  updateList,
  deleteList,
  getItemsForList,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from '../services/todoService.js';
import { toggleProviderCompletion } from '../services/todoSyncService.js';

export function registerAdminTodoRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/todo/lists ──────────────────────────────────────────────
  app.get('/api/admin/todo/lists', async (request, reply) => {
    await requireAdmin(request, reply);
    const lists = getListsForUser(request.user!.id);
    return reply.status(200).send(lists);
  });

  // ── POST /api/admin/todo/lists ─────────────────────────────────────────────
  app.post('/api/admin/todo/lists', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(CreateTodoListSchema, request.body);
    const list = createList(request.user!.id, body);
    return reply.status(201).send(list);
  });

  // ── PUT /api/admin/todo/lists/:id ──────────────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/api/admin/todo/lists/:id',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(UpdateTodoListSchema, request.body);
      const list = updateList(request.params.id, body);
      return reply.status(200).send(list);
    },
  );

  // ── DELETE /api/admin/todo/lists/:id ───────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/admin/todo/lists/:id',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deleteList(request.params.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/admin/todo/lists/:listId/items ────────────────────────────────
  app.get<{ Params: { listId: string }; Querystring: { includeCompleted?: string } }>(
    '/api/admin/todo/lists/:listId/items',
    async (request, reply) => {
      await requireAdmin(request, reply);
      const includeCompleted = request.query.includeCompleted !== 'false';
      const items = getItemsForList(request.params.listId, includeCompleted);
      return reply.status(200).send(items);
    },
  );

  // ── POST /api/admin/todo/lists/:listId/items ───────────────────────────────
  app.post<{ Params: { listId: string } }>(
    '/api/admin/todo/lists/:listId/items',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(CreateTodoItemSchema, request.body);
      const item = createItem(request.params.listId, body);
      return reply.status(201).send(item);
    },
  );

  // ── PUT /api/admin/todo/items/:id ──────────────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/api/admin/todo/items/:id',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(UpdateTodoItemSchema, request.body);

      // If completion changed, sync to provider (Microsoft/CalDAV) first
      if (body.completed !== undefined) {
        try {
          await toggleProviderCompletion(request.params.id, body.completed);
        } catch {
          // Log but don't block local update — sync can recover later
          request.log.warn(
            { itemId: request.params.id },
            'Provider completion sync failed',
          );
        }
      }

      const item = updateItem(request.params.id, body);
      return reply.status(200).send(item);
    },
  );

  // ── DELETE /api/admin/todo/items/:id ───────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/admin/todo/items/:id',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deleteItem(request.params.id);
      return reply.status(204).send();
    },
  );

  // ── PUT /api/admin/todo/lists/:listId/reorder ──────────────────────────────
  app.put<{ Params: { listId: string } }>(
    '/api/admin/todo/lists/:listId/reorder',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(ReorderItemsSchema, request.body);
      reorderItems(request.params.listId, body.items);
      return reply.status(204).send();
    },
  );
}
