import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { getSqliteDb } from '../../src/db/sqlite.js';
import { runMigrations } from '../../src/db/migrate.js';
import { exportBackup } from '../../src/services/backupService.js';
import { getDb } from '../../src/db/drizzle.js';
import { collectionHousehold, collectionStreams, collectionExplicitDates, users } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { seedCollectionContext } from '../helpers/collectionFixtures.js';

describe('additive collection migration', () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  it('creates four empty authoritative tables without seeding a preset', () => {
    const sqlite = getSqliteDb();
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'collection_%' ORDER BY name").all();
    expect(tables).toHaveLength(4);
    for (const row of tables as { name: string }[]) {
      expect(sqlite.prepare(`SELECT count(*) AS count FROM ${row.name}`).get()).toEqual({ count: 0 });
    }
  });
  it('repeated startup preserves all existing configuration and foreign keys', () => {
    const before = exportBackup().data;
    runMigrations(app.app.log);
    runMigrations(app.app.log);
    expect(exportBackup().data).toEqual(before);
    expect(getSqliteDb().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
  it('enforces singleton, CHECKs, PKs and child cascades independent of setup admin', async () => {
    await app.request.post('/api/first-run/admin').send({ username: 'admin', displayName: 'Admin', password: 'synthetic-pass1' });
    const db = getDb();
    const now = '2026-10-10T00:00:00.000Z';
    const household = { id: 'global', timezone: 'UTC', providerLabel: null, revision: 1, createdAt: now, updatedAt: now };
    expect(() => db.insert(collectionHousehold).values({ ...household, id: 'second' }).run()).toThrow();
    expect(() => db.insert(collectionHousehold).values({ ...household, revision: 0 }).run()).toThrow();
    db.insert(collectionHousehold).values(household).run();
    expect(() => db.insert(collectionHousehold).values(household).run()).toThrow();
    const stream = { id: '06500000-0000-4000-8000-000000000001', householdId: 'global', name: 'Synthetic', color: '#FFFFFF', enabled: true, sortOrder: 0, scheduleMode: 'explicit' as const, weekdaysMask: null, intervalWeeks: null, anchorDate: null, createdAt: now, updatedAt: now };
    expect(() => db.insert(collectionStreams).values({ ...stream, sortOrder: 32 }).run()).toThrow();
    expect(() => db.insert(collectionStreams).values({ ...stream, weekdaysMask: 1 }).run()).toThrow();
    db.insert(collectionStreams).values(stream).run();
    db.insert(collectionExplicitDates).values({ streamId: stream.id, date: '2028-02-29' }).run();
    expect(() => db.insert(collectionExplicitDates).values({ streamId: stream.id, date: '2028-02-29' }).run()).toThrow();
    const admin = db.select().from(users).get()!;
    seedCollectionContext(admin.id);
    const before = exportBackup().data;
    runMigrations();
    const after = exportBackup().data;
    for (const key of ['users', 'calendarSources', 'calendarBirthdays', 'dashboards', 'placeholderWidgets', 'appWidgetInstances'] as const) expect(after[key]).toEqual(before[key]);
    db.delete(users).where(eq(users.id, admin.id)).run();
    expect(db.select().from(collectionHousehold).get()).toEqual(household);
    db.delete(collectionStreams).where(eq(collectionStreams.id, stream.id)).run();
    expect(db.select().from(collectionExplicitDates).all()).toEqual([]);
    expect(getSqliteDb().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
