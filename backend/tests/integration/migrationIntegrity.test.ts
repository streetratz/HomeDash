/**
 * Regression coverage for #209.
 *
 * Drizzle's synchronous SQLite migrator starts a transaction before executing
 * each migration's SQL. SQLite ignores `PRAGMA foreign_keys=OFF` inside that
 * transaction, so migration 0028's app_widget_instances rebuild previously
 * cascaded into child tables.
 */

import path from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '../../src/db/migrate.js';
import { getSqliteDb } from '../../src/db/sqlite.js';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');

describe('migration relationship integrity', () => {
  beforeAll(() => {
    const raw = getSqliteDb();
    const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR });
    const migrationBeforePublicVisibility = migrations.find(
      (migration) => migration.folderMillis === 1782097699829,
    );
    if (!migrationBeforePublicVisibility) {
      throw new Error('Could not find migration 0026_good_tomorrow_man');
    }

    raw.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL
      );
      CREATE TABLE placeholder_widgets (
        id TEXT PRIMARY KEY NOT NULL
      );
      CREATE TABLE app_widget_instances (
        id TEXT PRIMARY KEY NOT NULL,
        placeholder_id TEXT NOT NULL REFERENCES placeholder_widgets(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE links_list_items (
        id TEXT PRIMARY KEY NOT NULL,
        widget_instance_id TEXT NOT NULL REFERENCES app_widget_instances(id) ON DELETE CASCADE
      );
      CREATE TABLE shortcut_groups (
        id TEXT PRIMARY KEY NOT NULL,
        widget_instance_id TEXT NOT NULL REFERENCES app_widget_instances(id) ON DELETE CASCADE
      );
      CREATE TABLE app_shortcuts (
        id TEXT PRIMARY KEY NOT NULL,
        widget_instance_id TEXT NOT NULL REFERENCES app_widget_instances(id) ON DELETE CASCADE
      );
      CREATE TABLE pihole_instances (
        id TEXT PRIMARY KEY NOT NULL,
        widget_instance_id TEXT REFERENCES app_widget_instances(id) ON DELETE SET NULL
      );
      CREATE TABLE unifi_instances (
        id TEXT PRIMARY KEY NOT NULL,
        widget_instance_id TEXT REFERENCES app_widget_instances(id) ON DELETE SET NULL
      );
      CREATE TABLE widget_connections (
        widget_instance_id TEXT NOT NULL REFERENCES app_widget_instances(id) ON DELETE CASCADE,
        connection_type TEXT NOT NULL,
        connection_id TEXT NOT NULL
      );
      CREATE UNIQUE INDEX widget_conn_pk
        ON widget_connections (widget_instance_id, connection_type);
      CREATE INDEX widget_conn_by_connection
        ON widget_connections (connection_type, connection_id);
      CREATE TABLE calendar_sources (
        id TEXT PRIMARY KEY NOT NULL
      );
      CREATE TABLE __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at NUMERIC
      );

      INSERT INTO users (id) VALUES ('user-1');
      INSERT INTO placeholder_widgets (id) VALUES ('placeholder-1');
      INSERT INTO app_widget_instances (
        id, placeholder_id, type, order_index, config_json, created_at, updated_at
      ) VALUES (
        'widget-1', 'placeholder-1', 'links_list', 0, '{}', '2026-09-17', '2026-09-17'
      );
      INSERT INTO links_list_items (id, widget_instance_id) VALUES ('link-1', 'widget-1');
      INSERT INTO shortcut_groups (id, widget_instance_id) VALUES ('group-1', 'widget-1');
      INSERT INTO app_shortcuts (id, widget_instance_id) VALUES ('shortcut-1', 'widget-1');
      INSERT INTO pihole_instances (id, widget_instance_id) VALUES ('pihole-1', 'widget-1');
      INSERT INTO unifi_instances (id, widget_instance_id) VALUES ('unifi-1', 'widget-1');
      INSERT INTO widget_connections (
        widget_instance_id, connection_type, connection_id
      ) VALUES ('widget-1', 'docker', 'docker-1');
    `);
    raw
      .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
      .run(migrationBeforePublicVisibility.hash, migrationBeforePublicVisibility.folderMillis);

    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1);
    runMigrations();
  });

  it.each([
    'app_widget_instances',
    'links_list_items',
    'shortcut_groups',
    'app_shortcuts',
    'pihole_instances',
    'unifi_instances',
    'widget_connections',
  ])('preserves rows in %s during the parent-table rebuild', (table) => {
    const row = getSqliteDb().prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as {
      count: number;
    };
    expect(row.count).toBe(1);
  });

  it('preserves every relationship to the rebuilt widget row', () => {
    const raw = getSqliteDb();
    expect(raw.prepare('SELECT widget_instance_id FROM pihole_instances').pluck().get()).toBe(
      'widget-1',
    );
    expect(raw.prepare('SELECT widget_instance_id FROM unifi_instances').pluck().get()).toBe(
      'widget-1',
    );
    expect(raw.prepare('SELECT widget_instance_id FROM widget_connections').pluck().get()).toBe(
      'widget-1',
    );
  });

  it('adds ordered multi-link support without changing legacy rows', () => {
    const raw = getSqliteDb();
    const legacyRow = raw
      .prepare(
        `SELECT widget_instance_id, connection_type, connection_id, sort_order
         FROM widget_connections
         WHERE widget_instance_id = 'widget-1'`,
      )
      .get();
    expect(legacyRow).toEqual({
      widget_instance_id: 'widget-1',
      connection_type: 'docker',
      connection_id: 'docker-1',
      sort_order: 0,
    });

    raw
      .prepare(
        `INSERT INTO widget_connections
          (widget_instance_id, connection_type, connection_id, sort_order)
         VALUES ('widget-1', 'docker', 'docker-2', 1)`,
      )
      .run();
    expect(
      raw
        .prepare(
          `SELECT connection_id
           FROM widget_connections
           WHERE widget_instance_id = 'widget-1' AND connection_type = 'docker'
           ORDER BY sort_order`,
        )
        .pluck()
        .all(),
    ).toEqual(['docker-1', 'docker-2']);
    expect(() =>
      raw
        .prepare(
          `INSERT INTO widget_connections
            (widget_instance_id, connection_type, connection_id, sort_order)
           VALUES ('widget-1', 'docker', 'docker-2', 2)`,
        )
        .run(),
    ).toThrow();
  });

  it('restores foreign-key enforcement and leaves no violations', () => {
    const raw = getSqliteDb();
    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(raw.pragma('foreign_key_check')).toEqual([]);
  });

  it('is safe to run again when no migrations are pending', () => {
    runMigrations();

    const raw = getSqliteDb();
    expect(raw.prepare('SELECT COUNT(*) FROM links_list_items').pluck().get()).toBe(1);
    expect(raw.prepare('SELECT COUNT(*) FROM app_shortcuts').pluck().get()).toBe(1);
    expect(raw.prepare('SELECT COUNT(*) FROM widget_connections').pluck().get()).toBe(2);
    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
