import type { FastifyInstance } from 'fastify';
import { requireAdmin, requireAuthHook } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { AppError, ErrorCode, Errors } from '../lib/errors.js';
import { getCollectionConfig, previewCollections, saveCollections, resolveCollectionWidget, readCollectionDisplay } from '../services/collectionService.js';
import { z } from 'zod';

const paramsSchema = z.object({ widgetId: z.string().uuid() }).strict();

export function registerCollectionRoutes(app: FastifyInstance): void {
  // Scoped parser-limit handling: auth runs before body parsing; the existing
  // global handler otherwise turns Fastify's parser 413 into a generic 500.
  void app.register((scope, _options, done) => {
    scope.setErrorHandler((error, request, reply) => {
      const status = error instanceof Error && 'statusCode' in error ? error.statusCode : undefined;
      if (error instanceof AppError) {
        request.log.warn({ component: 'collections', reason: error.code }, 'Collection request rejected');
        return reply.status(error.statusCode).send({ error: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) });
      }
      if (status === 413) return reply.status(413).send({ error: ErrorCode.ASSET_TOO_LARGE, message: 'Collection request exceeds 2 MiB' });
      if (status === 400) return reply.status(400).send({ error: ErrorCode.BAD_REQUEST, message: 'Invalid JSON request' });
      request.log.error({ component: 'collections', reason: 'request_failure' }, 'Collection request failed');
      return reply.status(500).send({ error: ErrorCode.INTERNAL, message: 'Unable to process collections; retry the request' });
    });
    const root = '/api/admin/calendar/collections';
    scope.get(root, { onRequest: requireAdmin }, (_request, reply) => reply.header('Cache-Control', 'no-store').send(getCollectionConfig()));
    const mutation = {
      bodyLimit: 2 * 1024 * 1024,
      onRequest: [requireAdmin, assertCsrf],
    };
    scope.post(`${root}/preview`, mutation, (request, reply) => reply.header('Cache-Control', 'no-store').send(previewCollections(request.body)));
    scope.put(root, mutation, (request, reply) => reply.header('Cache-Control', 'no-store').send(saveCollections(request.body)));
    scope.get('/api/user/calendar/widgets/:widgetId/collections', { onRequest: requireAuthHook }, (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const widget = params.success ? resolveCollectionWidget(params.data.widgetId) : null;
      if (!widget) throw Errors.notFound('Calendar widget not found');
      return reply.header('Cache-Control', 'no-store').send(readCollectionDisplay(widget.config.collectionStreamIds, request.query));
    });
    done();
  });
}
