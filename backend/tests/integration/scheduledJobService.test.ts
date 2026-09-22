/**
 * T030 (US5): Unit tests for scheduledJobService.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import * as jobService from '../../src/services/scheduledJobService.js';

describe('scheduledJobService', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('listJobs() returns seeded system jobs (≥3)', () => {
    const jobs = jobService.listJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(3);

    const names = jobs.map((j) => j.name);
    expect(names).toContain('Calendar Sync');
    expect(names).toContain('Database Backup');
    expect(names).toContain('Portable Backup');

    for (const job of jobs.filter((j) => j.isSystem === 1)) {
      expect(job.isSystem).toBe(1);
    }
  });

  it('createJob() inserts a job and returns it with an id', () => {
    const job = jobService.createJob({
      name: 'Service Test Job',
      actionType: 'calendar_sync',
      actionParams: '{}',
      cronExpression: '0 */6 * * *',
      enabled: true,
    });

    expect(job.id).toBeDefined();
    expect(job.name).toBe('Service Test Job');
    expect(job.actionType).toBe('calendar_sync');
    expect(job.isSystem).toBe(0);
  });

  it('updateJob() on a system job can change enabled field', () => {
    const systemJob = jobService.listJobs().find((j) => j.isSystem === 1);
    expect(systemJob).toBeDefined();

    const updated = jobService.updateJob(systemJob!.id, { enabled: false });
    expect(updated).not.toBeNull();
    expect(updated!.enabled).toBe(0);

    // restore
    jobService.updateJob(systemJob!.id, { enabled: true });
  });

  it('updateJob() on a system job throws when changing actionType', () => {
    const systemJob = jobService.listJobs().find((j) => j.isSystem === 1);
    expect(systemJob).toBeDefined();

    expect(() => {
      jobService.updateJob(systemJob!.id, { actionType: 'portable_backup' });
    }).toThrow();
  });

  it('deleteJob() on a system job throws with message containing "system job"', () => {
    const systemJob = jobService.listJobs().find((j) => j.isSystem === 1);
    expect(systemJob).toBeDefined();

    expect(() => {
      jobService.deleteJob(systemJob!.id);
    }).toThrow(/system job/i);
  });

  it('deleteJob() on a user-created job returns true', () => {
    const job = jobService.createJob({
      name: 'Temp Job',
      actionType: 'calendar_sync',
      actionParams: '{}',
      cronExpression: '0 */6 * * *',
      enabled: false,
    });

    const result = jobService.deleteJob(job.id);
    expect(result).toBe(true);

    // Verify it's gone
    const found = jobService.listJobs().find((j) => j.id === job.id);
    expect(found).toBeUndefined();
  });
});
