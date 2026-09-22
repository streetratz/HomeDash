/**
 * T021 (US3): Timezone list endpoint.
 * Returns all IANA timezone identifiers supported by this runtime.
 * Available to all authenticated users (not admin-only).
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/requireRole.js';
import { getTimezoneList } from '../services/shellSettingsService.js';

export function registerTimezoneRoutes(app: FastifyInstance): void {
  app.get('/api/admin/timezones', async (request, reply) => {
    requireAuth(request, reply);
    return reply.status(200).send({ timezones: getTimezoneList() });
  });
}
