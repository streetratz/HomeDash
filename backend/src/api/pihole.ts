/**
 * 014-pihole-widget: Pi-hole proxy API routes.
 * Config CRUD, connection test, stats, system health, blocking control.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { requireAuth } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, PiholeConfigSchema, PiholeBlockingSchema } from '../lib/validation.js';
import {
  getPiholeConfig,
  savePiholeConfig,
  deletePiholeConfig,
  testConnection,
  fetchStats,
  fetchSystemHealth,
  setBlocking,
} from '../services/pihole-service.js';

type WidgetParams = { Params: { widgetInstanceId: string } };

export function registerPiholeRoutes(app: FastifyInstance): void {
  // ── GET /api/pihole/config/:widgetInstanceId ────────────────────────────
  // Readable by any signed-in user (#100): the widget needs `configured` and
  // the poll interval to render at all, and the payload carries no secret —
  // the API token is reported only as the boolean `hasToken`. Writes below
  // stay admin-only.
  app.get<WidgetParams>(
    '/api/pihole/config/:widgetInstanceId',
    async (request, reply) => {
      requireAuth(request, reply);
      const config = getPiholeConfig(request.params.widgetInstanceId);
      if (!config) {
        return reply.status(200).send({ configured: false });
      }
      return reply.status(200).send({ configured: true, ...config });
    },
  );

  // ── PUT /api/pihole/config/:widgetInstanceId ────────────────────────────
  app.put<WidgetParams>(
    '/api/pihole/config/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(PiholeConfigSchema, request.body);
      const config = savePiholeConfig(
        request.params.widgetInstanceId,
        body.baseUrl,
        body.apiToken,
        body.pollIntervalSec ?? 30,
      );
      return reply.status(200).send(config);
    },
  );

  // ── DELETE /api/pihole/config/:widgetInstanceId ─────────────────────────
  app.delete<WidgetParams>(
    '/api/pihole/config/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      deletePiholeConfig(request.params.widgetInstanceId);
      return reply.status(204).send();
    },
  );

  // ── POST /api/pihole/config/:widgetInstanceId/test ──────────────────────
  app.post<WidgetParams>(
    '/api/pihole/config/:widgetInstanceId/test',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const { baseUrl, apiToken } = request.body as { baseUrl?: string; apiToken?: string };
      if (!baseUrl || !apiToken) {
        return reply.status(400).send({ success: false, message: 'baseUrl and apiToken are required' });
      }
      const normalizedUrl = baseUrl.replace(/\/+$/, '');
      const result = await testConnection(normalizedUrl, apiToken);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/pihole/stats/:widgetInstanceId ─────────────────────────────
  app.get<WidgetParams>(
    '/api/pihole/stats/:widgetInstanceId',
    async (request, reply) => {
      requireAuth(request, reply);
      const stats = await fetchStats(request.params.widgetInstanceId);
      return reply.status(200).send(stats);
    },
  );

  // ── GET /api/pihole/system/:widgetInstanceId ────────────────────────────
  app.get<WidgetParams>(
    '/api/pihole/system/:widgetInstanceId',
    async (request, reply) => {
      requireAuth(request, reply);
      const health = await fetchSystemHealth(request.params.widgetInstanceId);
      return reply.status(200).send(health);
    },
  );

  // ── POST /api/pihole/blocking/:widgetInstanceId ─────────────────────────
  app.post<WidgetParams>(
    '/api/pihole/blocking/:widgetInstanceId',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const body = validate(PiholeBlockingSchema, request.body);
      const result = await setBlocking(
        request.params.widgetInstanceId,
        body.action,
        body.duration,
      );
      return reply.status(200).send(result);
    },
  );
}
