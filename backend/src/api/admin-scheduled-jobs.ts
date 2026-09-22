/**
 * T033 (US5): Scheduled jobs admin API routes.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate } from '../lib/validation.js';
import { Errors } from '../lib/errors.js';
import { createScheduledJobSchema, updateScheduledJobSchema } from '../services/scheduledJobTypes.js';
import * as jobService from '../services/scheduledJobService.js';

export function registerAdminScheduledJobRoutes(app: FastifyInstance): void {
  // List all jobs
  app.get('/api/admin/scheduled-jobs', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.send({ jobs: jobService.listJobs() });
  });

  // Create job
  app.post('/api/admin/scheduled-jobs', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(createScheduledJobSchema, request.body);
    const job = jobService.createJob({
      ...body,
      enabled: body.enabled ?? true,
      actionParams: body.actionParams ?? '{}',
    });
    return reply.status(201).send(job);
  });

  // Update job
  app.put('/api/admin/scheduled-jobs/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const { id } = request.params as { id: string };
    const body = validate(updateScheduledJobSchema, request.body);
    try {
      const job = jobService.updateJob(id, body);
      if (!job) throw Errors.notFound('Scheduled job not found');
      return reply.send(job);
    } catch (err) {
      if (err instanceof Error && err.message.includes('system job')) {
        throw Errors.forbidden(err.message);
      }
      throw err;
    }
  });

  // Delete job
  app.delete('/api/admin/scheduled-jobs/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const { id } = request.params as { id: string };
    try {
      const deleted = jobService.deleteJob(id);
      if (!deleted) throw Errors.notFound('Scheduled job not found');
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message.includes('system job')) {
        throw Errors.forbidden(err.message);
      }
      throw err;
    }
  });

  // Run job immediately
  app.post('/api/admin/scheduled-jobs/:id/run', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const { id } = request.params as { id: string };
    try {
      const result = await jobService.runJobNow(id);
      return reply.send(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'Job not found') {
        throw Errors.notFound('Scheduled job not found');
      }
      throw err;
    }
  });
}
