/**
 * T026: Operations routes — /healthz and /readyz.
 */

import type { FastifyInstance } from 'fastify';
import { isMigrationHealthy } from '../db/migrate.js';

export function registerOpsRoutes(app: FastifyInstance): void {
  /** Liveness probe — always returns 200 if the process is running. */
  app.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  /** Readiness probe — returns 200 only if DB/migrations are usable. */
  app.get('/readyz', async (_request, reply) => {
    const dbOk = isMigrationHealthy();
    if (!dbOk) {
      return reply.status(503).send({ status: 'error', reason: 'database_not_ready' });
    }
    return reply.status(200).send({ status: 'ok' });
  });
}
