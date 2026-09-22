/**
 * 015-integrations-hub: Connection CRUD API routes.
 * Manages Pi-hole and Docker connections from the Integrations Hub.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  validate,
  CreatePiholeConnectionSchema,
  UpdatePiholeConnectionSchema,
  CreateDockerConnectionSchema,
  UpdateDockerConnectionSchema,
  parseDockerEndpoint,
} from '../lib/validation.js';
import { isAllowedDockerEndpoint } from '../lib/url-validator.js';
import {
  listAllConnections,
  listPiholeConnections,
  createPiholeConnection,
  updatePiholeConnection,
  deletePiholeConnection,
  testPiholeConnection,
  listDockerConnections,
  createDockerConnection,
  updateDockerConnection,
  deleteDockerConnection,
  testDockerConnection,
  linkWidgetToConnection,
  unlinkWidgetConnection,
  resolveConnection,
  replaceDockerWidgetConnections,
} from '../services/connectionService.js';
import { decryptToken } from '../lib/token-encryption.js';
import { getDb } from '../db/drizzle.js';
import { piholeInstances, dockerConnections } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

type IdParams = { Params: { id: string } };

const ReplaceDockerLinksSchema = z.object({
  widgetInstanceId: z.string().min(1),
  connectionIds: z.array(z.string().min(1)).max(50).refine(
    (ids) => new Set(ids).size === ids.length,
    'connectionIds must not contain duplicates',
  ),
});

/**
 * Gate an admin-supplied Docker endpoint before any outbound connection.
 *
 * These two test routes are the *only* place a caller-supplied endpoint is
 * accepted anywhere in the app (043 / FR-015), so both the grammar check and
 * the SSRF allowlist have to run here, before a socket is opened or `ssh` is
 * spawned — otherwise "test connection" becomes a probe for internal hosts
 * that the save path would have refused.
 *
 * @returns a response body when the endpoint must be rejected, else null.
 */
async function rejectDisallowedEndpoint(
  dockerUrl: string,
): Promise<{ success: false; message: string } | null> {
  const parsed = parseDockerEndpoint(dockerUrl);
  if (!parsed.ok) {
    return { success: false, message: parsed.error };
  }
  if (!(await isAllowedDockerEndpoint(parsed.endpoint))) {
    return {
      success: false,
      message:
        'That Docker host is not permitted. Link-local and unspecified addresses are blocked; ' +
        'loopback and LAN addresses are fine.',
    };
  }
  return null;
}

export function registerConnectionRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/connections ─────────────────────────────────────────
  app.get('/api/admin/connections', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.status(200).send(listAllConnections());
  });

  // ─── Pi-hole connections ──────────────────────────────────────────────

  app.get('/api/admin/connections/pihole', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.status(200).send(listPiholeConnections());
  });

  app.post('/api/admin/connections/pihole', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(CreatePiholeConnectionSchema, request.body);
    const conn = createPiholeConnection(
      body.name ?? 'Pi-hole',
      body.baseUrl,
      body.apiToken,
      body.pollIntervalSec ?? 30,
    );
    return reply.status(201).send(conn);
  });

  app.put<IdParams>('/api/admin/connections/pihole/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(UpdatePiholeConnectionSchema, request.body);
    const conn = updatePiholeConnection(request.params.id, body);
    return reply.status(200).send(conn);
  });

  app.delete<IdParams>('/api/admin/connections/pihole/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    deletePiholeConnection(request.params.id);
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/admin/connections/pihole/:id/test', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const body = request.body as { baseUrl?: string; apiToken?: string } | undefined;

    let baseUrl: string;
    let apiToken: string;

    if (body?.baseUrl && body?.apiToken) {
      baseUrl = body.baseUrl.replace(/\/+$/, '');
      apiToken = body.apiToken;
    } else {
      // Load stored config
      const db = getDb();
      const stored = db
        .select({
          baseUrl: piholeInstances.baseUrl,
          apiTokenEncrypted: piholeInstances.apiTokenEncrypted,
        })
        .from(piholeInstances)
        .where(eq(piholeInstances.id, request.params.id))
        .get();

      if (!stored) {
        return reply.status(404).send({ success: false, message: 'Pi-hole connection not found' });
      }
      baseUrl = stored.baseUrl;
      apiToken = decryptToken(stored.apiTokenEncrypted);
    }

    const result = await testPiholeConnection(baseUrl, apiToken);
    return reply.status(200).send(result);
  });

  // ─── Docker connections ───────────────────────────────────────────────

  app.get('/api/admin/connections/docker', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.status(200).send(listDockerConnections());
  });

  app.post('/api/admin/connections/docker', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(CreateDockerConnectionSchema, request.body);
    const conn = createDockerConnection(body.name ?? 'Docker', body.dockerUrl);
    return reply.status(201).send(conn);
  });

  app.put<IdParams>('/api/admin/connections/docker/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(UpdateDockerConnectionSchema, request.body);
    const conn = updateDockerConnection(request.params.id, body);
    return reply.status(200).send(conn);
  });

  app.delete<IdParams>('/api/admin/connections/docker/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    deleteDockerConnection(request.params.id);
    return reply.status(204).send();
  });

  // Test a docker connection without saving (new connection form)
  app.post('/api/admin/connections/docker/test', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = request.body as { dockerUrl?: string } | undefined;
    if (!body?.dockerUrl) {
      return reply.status(400).send({ success: false, message: 'dockerUrl is required' });
    }
    const rejection = await rejectDisallowedEndpoint(body.dockerUrl);
    if (rejection) return reply.status(400).send(rejection);
    const result = await testDockerConnection(body.dockerUrl);
    return reply.status(200).send(result);
  });

  app.post<IdParams>('/api/admin/connections/docker/:id/test', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const body = request.body as { dockerUrl?: string } | undefined;

    let dockerUrl: string;

    if (body?.dockerUrl) {
      dockerUrl = body.dockerUrl;
    } else {
      // Load stored config
      const db = getDb();
      const stored = db
        .select({ dockerUrl: dockerConnections.dockerUrl })
        .from(dockerConnections)
        .where(eq(dockerConnections.id, request.params.id))
        .get();

      if (!stored) {
        return reply.status(404).send({ ok: false, message: 'Docker connection not found' });
      }
      dockerUrl = stored.dockerUrl;
    }

    const rejection = await rejectDisallowedEndpoint(dockerUrl);
    if (rejection) return reply.status(400).send(rejection);

    const result = await testDockerConnection(dockerUrl);
    return reply.status(200).send(result);
  });

  // ─── Widget linking ───────────────────────────────────────────────────

  app.post<{
    Body: { widgetInstanceId: string; connectionType: 'pihole' | 'docker'; connectionId: string };
  }>('/api/admin/connections/link', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const { widgetInstanceId, connectionType, connectionId } = request.body;
    linkWidgetToConnection(widgetInstanceId, connectionType, connectionId);
    reply.send({ ok: true });
  });

  app.post<{ Body: { widgetInstanceId: string; connectionType: 'pihole' | 'docker' } }>(
    '/api/admin/connections/unlink',
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const { widgetInstanceId, connectionType } = request.body;
      unlinkWidgetConnection(widgetInstanceId, connectionType);
      reply.send({ ok: true });
    },
  );

  app.put('/api/admin/connections/docker-links', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(ReplaceDockerLinksSchema, request.body);
    const hosts = replaceDockerWidgetConnections(body.widgetInstanceId, body.connectionIds);
    return reply.status(200).send({ hosts });
  });

  app.get<{ Querystring: { widgetInstanceId: string; connectionType: 'pihole' | 'docker' } }>(
    '/api/admin/connections/resolve',
    async (request, reply) => {
      await requireAdmin(request, reply);
      const { widgetInstanceId, connectionType } = request.query;
      const result = resolveConnection(widgetInstanceId, connectionType);
      reply.send(result ? { connectionId: result.connectionId } : { connectionId: null });
    },
  );
}
