/**
 * T015 (005): Microsoft To Do sync routes.
 * Manual sync trigger and live provider list fetching.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { syncMicrosoftTodoForUser } from '../services/todoSyncService.js';
import { getMicrosoftTaskLists } from '../services/microsoftTodoService.js';
import { getAccountsForUser } from '../services/oauth-service.js';

export function registerAdminTodoSyncRoutes(app: FastifyInstance): void {
  // ── POST /api/admin/todo/sync/microsoft ────────────────────────────────────
  // Trigger a full sync of Microsoft To Do lists and tasks.
  app.post('/api/admin/todo/sync/microsoft', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const result = await syncMicrosoftTodoForUser(request.user!.id);
    return reply.status(200).send(result);
  });

  // ── GET /api/admin/todo/providers/microsoft/lists ──────────────────────────
  // Live fetch of Microsoft To Do task lists (for config UI selection).
  app.get(
    '/api/admin/todo/providers/microsoft/lists',
    async (request, reply) => {
      await requireAdmin(request, reply);

      const accounts = getAccountsForUser(request.user!.id);
      const microsoftAccounts = accounts.filter(
        (a) => a.provider === 'microsoft',
      );

      if (microsoftAccounts.length === 0) {
        return reply.status(200).send({ lists: [], accounts: [] });
      }

      const allLists: Array<{
        id: string;
        displayName: string;
        isOwner: boolean;
        accountId: string;
        accountEmail: string | null;
      }> = [];

      for (const account of microsoftAccounts) {
        try {
          const lists = await getMicrosoftTaskLists(account.id);
          for (const list of lists) {
            allLists.push({
              ...list,
              accountId: account.id,
              accountEmail: account.email,
            });
          }
        } catch {
          // Skip accounts that fail — may need reauth
          request.log.warn(
            { accountId: account.id },
            'Failed to fetch Microsoft task lists',
          );
        }
      }

      return reply.status(200).send({
        lists: allLists,
        accounts: microsoftAccounts,
      });
    },
  );
}
