/**
 * Docker API routes — container listing and container actions.
 *
 * GET  /api/docker/containers  — list containers (authenticated)
 * POST /api/docker/action      — start/stop/restart (admin + CSRF)
 *
 * **No route here accepts an endpoint from the caller** (043 / FR-014, FR-015).
 * The endpoint is always resolved server-side from the widget's stored Docker
 * connection. The only place an endpoint may be supplied is the admin
 * connection-test route in `connections.ts`, which is admin-guarded and exists
 * so an admin can validate a destination before saving it.
 *
 * The previous `POST /api/docker/ping` route is deliberately absent: it was an
 * unauthenticated duplicate of that admin test route (#189 / FR-013).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listContainers, containerAction } from '../services/dockerService.js';
import { requireAuthHook, requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  listDockerWidgetHosts,
  resolveDockerWidgetEndpoint,
} from '../services/connectionService.js';

const ContainerActionSchema = z.object({
  widgetInstanceId: z.string().min(1),
  connectionId: z.string().min(1),
  containerId: z.string().min(1).max(64),
  action: z.enum(['start', 'stop', 'restart']),
});

const ContainerQuerySchema = z.object({
  widgetInstanceId: z.string().min(1),
  connectionId: z.string().min(1),
  all: z.enum(['true', 'false']).optional(),
});

const HostsQuerySchema = z.object({
  widgetInstanceId: z.string().min(1),
});

export function registerDockerRoutes(app: FastifyInstance): void {
  app.get('/api/docker/hosts', { preHandler: [requireAuthHook] }, async (request, reply) => {
    const parsed = HostsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(422).send({ error: parsed.error.flatten() });
    }
    return reply.status(200).send({
      hosts: listDockerWidgetHosts(parsed.data.widgetInstanceId).map(
        ({ connectionId, name }) => ({ connectionId, name }),
      ),
    });
  });

  // List containers — authentication is enforced in a preHandler, so it runs
  // before any endpoint resolution, DNS lookup, socket open or `ssh` spawn.
  // An anonymous caller therefore learns nothing from either the body or the
  // response time about which endpoints are configured (FR-019, SC-002).
  app.get('/api/docker/containers', { preHandler: [requireAuthHook] }, async (request, reply) => {
    const parsed = ContainerQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(422).send({ error: parsed.error.flatten() });
    }

    const dockerUrl = resolveDockerWidgetEndpoint(
      parsed.data.widgetInstanceId,
      parsed.data.connectionId,
    );
    const all = parsed.data.all !== 'false'; // default true — show all states

    const containers = await listContainers(dockerUrl, all);
    return reply.status(200).send({ containers });
  });

  // Container action — admin only, CSRF-protected.
  app.post(
    '/api/docker/action',
    { preHandler: [requireAdmin, assertCsrf] },
    async (request, reply) => {
      const parsed = ContainerActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: parsed.error.flatten() });
      }

      // Resolved server-side. A `dockerUrl` in the body is ignored by the
      // schema, so an admin cannot aim this at an arbitrary destination.
      const dockerUrl = resolveDockerWidgetEndpoint(
        parsed.data.widgetInstanceId,
        parsed.data.connectionId,
      );

      await containerAction(dockerUrl, parsed.data.containerId, parsed.data.action);
      return reply.status(200).send({ ok: true });
    },
  );
}
