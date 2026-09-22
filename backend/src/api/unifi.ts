/**
 * 023-unifi-widget: UniFi Network Controller proxy API routes.
 * Config CRUD, connection test, stats.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { requireAuth } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, UnifiConfigSchema } from '../lib/validation.js';
import {
  getUnifiConfig,
  saveUnifiConfig,
  deleteUnifiConfig,
  testUnifiConnection,
  fetchUnifiStats,
} from '../services/unifi-service.js';

type WidgetParams = { Params: { widgetInstanceId: string } };

export function registerUnifiRoutes(app: FastifyInstance): void {
  // ── GET /api/unifi/config/:widgetInstanceId ─────────────────────────────
  // Readable by any signed-in user (#100): the widget gates both its stats
  // query and its rendering on `configured`, so an admin-only read left
  // standard users staring at "UniFi not configured". Credentials are
  // reported only as the boolean `hasCredentials`. Writes stay admin-only.
  app.get<WidgetParams>(
    '/api/unifi/config/:widgetInstanceId',
    async (request, reply) => {
      requireAuth(request, reply);
      const config = getUnifiConfig(request.params.widgetInstanceId);
      if (!config) {
        return reply.status(200).send({ configured: false });
      }
      return reply.status(200).send({ configured: true, ...config });
    },
  );

  // ── PUT /api/unifi/config/:widgetInstanceId ─────────────────────────────
  app.put<WidgetParams>(
    '/api/unifi/config/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(UnifiConfigSchema, request.body);
      const config = saveUnifiConfig(
        request.params.widgetInstanceId,
        body.baseUrl,
        body.username,
        body.password,
        body.siteName ?? 'default',
        body.pollIntervalSec ?? 30,
      );
      return reply.status(200).send(config);
    },
  );

  // ── DELETE /api/unifi/config/:widgetInstanceId ──────────────────────────
  app.delete<WidgetParams>(
    '/api/unifi/config/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deleteUnifiConfig(request.params.widgetInstanceId);
      return reply.status(204).send();
    },
  );

  // ── POST /api/unifi/config/:widgetInstanceId/test ──────────────────────
  app.post<WidgetParams>(
    '/api/unifi/config/:widgetInstanceId/test',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const { baseUrl, username, password } = request.body as {
        baseUrl?: string;
        username?: string;
        password?: string;
      };
      if (!baseUrl || !username || !password) {
        return reply.status(400).send({ success: false, message: 'baseUrl, username, and password are required' });
      }
      const normalizedUrl = baseUrl.replace(/\/+$/, '');
      const result = await testUnifiConnection(normalizedUrl, username, password);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/unifi/stats/:widgetInstanceId ─────────────────────────────
  app.get<WidgetParams>(
    '/api/unifi/stats/:widgetInstanceId',
    async (request, reply) => {
      requireAuth(request, reply);
      try {
        const stats = await fetchUnifiStats(request.params.widgetInstanceId);
        return reply.status(200).send(stats);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch stats';
        return reply.status(502).send({ error: msg });
      }
    },
  );

  // ── GET /api/unifi/debug/:widgetInstanceId — raw API data for troubleshooting
  app.get<WidgetParams>(
    '/api/unifi/debug/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      try {
        const { fetchRawData } = await import('../services/unifi-service.js');
        const raw = await fetchRawData(request.params.widgetInstanceId);
        return reply.status(200).send(raw);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch debug data';
        return reply.status(502).send({ error: msg });
      }
    },
  );
}
