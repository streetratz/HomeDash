import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { exportBackup, previewRestore, executeRestore } from '../../src/services/backupService.js';
import { backupFileSchema } from '../../src/services/backupTypes.js';
import { getCollectionConfig, previewCollections, saveCollections } from '../../src/services/collectionService.js';
import { collectionIds, collectionPreset, seedCollectionContext } from '../helpers/collectionFixtures.js';
import { getDb } from '../../src/db/drizzle.js';
import { users } from '../../src/db/schema/index.js';
import { getSqliteDb } from '../../src/db/sqlite.js';
import { setAppLogger } from '../../src/lib/logger.js';
import pino from 'pino';

describe('portable collection format', () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  it('exports v2 with all four arrays, required rather than optional', () => {
    const backup = exportBackup();
    expect(backup.version).toBe(2);
    for (const key of ['collectionHousehold', 'collectionStreams', 'collectionExplicitDates', 'collectionExceptions']) {
      expect(backup.data).toHaveProperty(key, []);
      const raw = structuredClone(backup) as unknown as { data: Record<string, unknown> };
      delete raw.data[key];
      expect(backupFileSchema.safeParse(raw).success).toBe(false);
    }
  });
  it('warns that collection-free v1 is full replacement and rejects collection-bearing v1', () => {
    const raw = structuredClone(exportBackup()) as unknown as { version: number; data: Record<string, unknown> };
    raw.version = 1;
    for (const key of ['collectionHousehold', 'collectionStreams', 'collectionExplicitDates', 'collectionExceptions']) delete raw.data[key];
    expect(previewRestore(raw).warnings.join(' ')).toMatch(/no collections.*remov/i);
    raw.data['collectionHousehold'] = [];
    expect(backupFileSchema.safeParse(raw).success).toBe(false);
  });
  it('roundtrips exact authoritative values, invalidates equal-revision stale drafts and rejects malicious rows before deletion', async () => {
    await app.request.post('/api/first-run/admin').send({ username: 'admin', displayName: 'Synthetic admin', password: 'disposable-test-pass1' });
    const config = getCollectionConfig();
    const preset = collectionPreset();
    const input = { ...preset, streams: [
      { ...preset.streams[0], enabled: false, exceptions: [{ id: collectionIds.exceptionA, kind: 'replace', originalDate: '2026-10-14', actualDate: '2026-10-15' }] },
      preset.streams[1],
      { id: collectionIds.garden, name: 'Garden', color: '#00AA00', enabled: true, schedule: { mode: 'explicit', dates: ['2026-10-21', '2028-02-29'] } },
    ], expectedRevision: config.revision, runtimeEpoch: config.runtimeEpoch,
      range: { from: '2026-10-14', to: '2026-11-10' },
      confirmations: { timezoneConfirmed: true, deletedStreamIds: [], removedExceptionIds: [], clearedExplicitStreamIds: [] },
    };
    const preview = previewCollections(input);
    saveCollections({ ...input, previewDigest: preview.previewDigest });
    const backup = exportBackup();
    const adminId = getDb().select().from(users).get()!.id;
    seedCollectionContext(adminId);
    const populated = exportBackup();
    const current = getCollectionConfig();
    const stale = { ...input, expectedRevision: current.revision, runtimeEpoch: current.runtimeEpoch };
    const stalePreview = previewCollections(stale);
    executeRestore(populated, adminId);
    const restored = exportBackup();
    for (const key of ['collectionHousehold', 'collectionStreams', 'collectionExplicitDates', 'collectionExceptions', 'appWidgetInstances'] as const) expect(restored.data[key]).toEqual(populated.data[key]);
    expect(() => saveCollections({ ...stale, previewDigest: stalePreview.previewDigest })).toThrow(/changed/i);
    for (const modify of [
      (b: typeof backup) => { b.data.collectionStreams[0]!['householdId'] = 'unknown'; },
      (b: typeof backup) => { b.data.collectionStreams[0]!['sortOrder'] = 31; },
      (b: typeof backup) => { b.data.collectionStreams[0]!['anchorDate'] = '2026-10-15'; },
      (b: typeof backup) => { b.data.collectionExplicitDates.push({ streamId: collectionIds.general, date: '2026-10-14' }); },
      (b: typeof backup) => { b.data.collectionStreams[0]!['scheduleMode'] = 'explicit'; },
      (b: typeof backup) => { b.data.appWidgetInstances.push({ ...populated.data.appWidgetInstances[0], configJson: JSON.stringify({ collectionStreamIds: ['06500000-0000-4000-8000-000000000099'] }) }); },
      (b: typeof backup) => { b.data.collectionExceptions.push({ id: collectionIds.exceptionA, streamId: collectionIds.general, kind: 'add', originalDate: null, actualDate: '2026-10-14', createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }); },
      (b: typeof backup) => { b.data.collectionStreams = Array.from({ length: 33 }, () => b.data.collectionStreams[0]!); },
    ]) {
      const bad = structuredClone(backup);
      modify(bad);
      expect(() => executeRestore(bad, adminId)).toThrow();
      expect(exportBackup().data.collectionStreams).toEqual(backup.data.collectionStreams);
    }
  });
  it('sanitizes insertion failure inside restore catch/logger and rolls back sessions/configuration', () => {
    const backup = exportBackup();
    const adminId = getDb().select().from(users).get()!.id;
    const before = getCollectionConfig();
    const logs: string[] = [];
    setAppLogger(pino({ level: 'trace' }, { write: text => { logs.push(text); } }));
    getSqliteDb().exec("CREATE TEMP TRIGGER restore_collection_failure BEFORE INSERT ON collection_household BEGIN SELECT RAISE(ABORT, 'private-sentinel SQL bind parameters backup-content'); END");
    try {
      let message = '';
      try { executeRestore(backup, adminId); } catch (error) { message = error instanceof Error ? error.message : ''; }
      expect(message).toMatch(/restore|integrity/i);
      expect(`${message} ${logs.join(' ')}`).not.toMatch(/private-sentinel|bind parameters|backup-content|Synthetic private provider/);
      expect(getCollectionConfig()).toEqual(before);
      expect(exportBackup().data.collectionStreams).toEqual(backup.data.collectionStreams);
    } finally {
      getSqliteDb().exec('DROP TRIGGER restore_collection_failure');
      setAppLogger(pino({ level: 'silent' }));
    }
  });
});
