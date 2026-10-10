import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { getSqliteDb } from '../../src/db/sqlite.js';
import { runMigrations } from '../../src/db/migrate.js';
import { exportBackup } from '../../src/services/backupService.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  collectionHousehold,
  collectionStreams,
  collectionExplicitDates,
  users,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { seedCollectionContext } from '../helpers/collectionFixtures.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  calendarSources,
  calendarBirthdays,
  dashboards,
  placeholderWidgets,
  appWidgetInstances,
} from '../../src/db/schema/index.js';

describe('additive collection migration', () => {
  it('upgrades populated pre-feature main bytes without changing any original table after restart', () => {
    const root = path.resolve(__dirname, '../../..');
    const baseline = 'c5bd8a1102cd2e7a1d22cbea93b68614be5903a5';
    const folder = mkdtempSync(path.join(tmpdir(), 'homedash065-main-migration-'));
    const file = path.join(folder, 'synthetic.sqlite');
    let raw = new Database(file);
    try {
      const migrationPaths = execFileSync(
        'git',
        ['ls-tree', '-r', '--name-only', baseline, 'backend/drizzle'],
        { cwd: root, encoding: 'utf8' },
      )
        .trim()
        .split('\n')
        .filter((name) => name.endsWith('.sql') || name.endsWith('/_journal.json'));
      const archive = execFileSync('git', ['archive', baseline, ...migrationPaths], { cwd: root });
      execFileSync('tar', ['-x', '-C', folder], { input: archive });
      raw.pragma('foreign_keys = OFF');
      const db = drizzle(raw);
      migrate(db, { migrationsFolder: path.join(folder, 'backend/drizzle') });
      raw.pragma('foreign_keys = ON');
      const now = '2026-10-10T00:00:00.000Z';
      db.insert(users)
        .values({
          id: 'synthetic-admin',
          username: 'synthetic',
          displayName: 'Synthetic',
          passwordHash: 'synthetic-not-a-real-hash',
          role: 'admin',
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(calendarSources)
        .values({
          id: 'synthetic-source',
          userId: 'synthetic-admin',
          type: 'birthday_local',
          name: 'Synthetic provider',
          enabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(calendarBirthdays)
        .values({
          id: 'synthetic-birthday',
          sourceId: 'synthetic-source',
          firstName: 'Synthetic',
          month: 2,
          day: 29,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(dashboards)
        .values({ id: 'synthetic-dashboard', name: 'Synthetic', createdAt: now, updatedAt: now })
        .run();
      db.insert(placeholderWidgets)
        .values({
          id: 'synthetic-widget',
          stableKey: 'synthetic-widget',
          dashboardId: 'synthetic-dashboard',
          x: 0,
          y: 0,
          w: 4,
          h: 4,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(appWidgetInstances)
        .values({
          id: 'synthetic-widget',
          placeholderId: 'synthetic-widget',
          type: 'calendar',
          configJson: JSON.stringify({
            sourceIds: ['synthetic-source'],
            daysAhead: 30,
            maxEvents: 10,
          }),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      const names = raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
        )
        .all() as { name: string }[];
      const before = names.map(({ name }) => ({
        name,
        columns: raw.prepare(`PRAGMA table_info("${name}")`).all(),
        rows: raw.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
      }));
      expect(names.some(({ name }) => name.startsWith('collection_'))).toBe(false);
      migrate(db, { migrationsFolder: path.join(root, 'backend/drizzle') });
      raw.close();
      raw = new Database(file);
      raw.pragma('foreign_keys = ON');
      migrate(drizzle(raw), { migrationsFolder: path.join(root, 'backend/drizzle') });
      for (const table of before) {
        expect(raw.prepare(`PRAGMA table_info("${table.name}")`).all()).toEqual(table.columns);
        expect(raw.prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`).all()).toEqual(
          table.rows,
        );
      }
      expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      for (const name of [
        'collection_household',
        'collection_streams',
        'collection_explicit_dates',
        'collection_exceptions',
      ]) {
        expect(raw.prepare(`SELECT count(*) AS count FROM "${name}"`).get()).toEqual({ count: 0 });
      }
    } finally {
      raw.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  it('creates four empty authoritative tables without seeding a preset', () => {
    const sqlite = getSqliteDb();
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'collection_%' ORDER BY name",
      )
      .all();
    expect(tables).toHaveLength(4);
    for (const row of tables as { name: string }[]) {
      expect(sqlite.prepare(`SELECT count(*) AS count FROM ${row.name}`).get()).toEqual({
        count: 0,
      });
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
    await app.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'synthetic-pass1' });
    const db = getDb();
    const now = '2026-10-10T00:00:00.000Z';
    const household = {
      id: 'global',
      timezone: 'UTC',
      providerLabel: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    expect(() =>
      db
        .insert(collectionHousehold)
        .values({ ...household, id: 'second' })
        .run(),
    ).toThrow();
    expect(() =>
      db
        .insert(collectionHousehold)
        .values({ ...household, revision: 0 })
        .run(),
    ).toThrow();
    db.insert(collectionHousehold).values(household).run();
    expect(() => db.insert(collectionHousehold).values(household).run()).toThrow();
    const stream = {
      id: '06500000-0000-4000-8000-000000000001',
      householdId: 'global',
      name: 'Synthetic',
      color: '#FFFFFF',
      enabled: true,
      sortOrder: 0,
      scheduleMode: 'explicit' as const,
      weekdaysMask: null,
      intervalWeeks: null,
      anchorDate: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(() =>
      db
        .insert(collectionStreams)
        .values({ ...stream, sortOrder: 32 })
        .run(),
    ).toThrow();
    expect(() =>
      db
        .insert(collectionStreams)
        .values({ ...stream, weekdaysMask: 1 })
        .run(),
    ).toThrow();
    db.insert(collectionStreams).values(stream).run();
    db.insert(collectionExplicitDates).values({ streamId: stream.id, date: '2028-02-29' }).run();
    expect(() =>
      db.insert(collectionExplicitDates).values({ streamId: stream.id, date: '2028-02-29' }).run(),
    ).toThrow();
    const admin = db.select().from(users).get()!;
    seedCollectionContext(admin.id);
    const before = exportBackup().data;
    runMigrations();
    const after = exportBackup().data;
    for (const key of [
      'users',
      'calendarSources',
      'calendarBirthdays',
      'dashboards',
      'placeholderWidgets',
      'appWidgetInstances',
    ] as const)
      expect(after[key]).toEqual(before[key]);
    db.delete(users).where(eq(users.id, admin.id)).run();
    expect(db.select().from(collectionHousehold).get()).toEqual(household);
    db.delete(collectionStreams).where(eq(collectionStreams.id, stream.id)).run();
    expect(db.select().from(collectionExplicitDates).all()).toEqual([]);
    expect(getSqliteDb().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
