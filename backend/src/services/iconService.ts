/**
 * Phase R3: Icon cache service.
 *
 * Manages the icon_cache_entries table. Actual HTTP fetching of icons
 * from selfh.st is deferred to a later phase — this service provides
 * the CRUD and placeholder recording.
 */

import { eq, asc } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { iconCacheEntries } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IconCacheRow {
  iconKey: string;
  source: 'selfh' | 'built_in';
  sourceUrl: string | null;
  assetId: string | null;
  etag: string | null;
  lastFetchedAt: string | null;
  status: 'ok' | 'missing' | 'error';
  errorMessage: string | null;
}

export interface RefreshIconsInput {
  /** URL hostnames or icon keys to record in the cache. */
  keys: string[];
}

export interface RefreshResult {
  recorded: number;
  existing: number;
  keys: string[];
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listIconCacheEntries(): IconCacheRow[] {
  const db = getDb();
  return db.select().from(iconCacheEntries).orderBy(asc(iconCacheEntries.iconKey)).all().map(toRow);
}

export function getIconCacheEntry(key: string): IconCacheRow {
  const db = getDb();
  const row = db.select().from(iconCacheEntries).where(eq(iconCacheEntries.iconKey, key)).get();
  if (!row) throw Errors.notFound(`Icon cache entry not found: ${key}`);
  return toRow(row);
}

/**
 * Record icon keys in the cache as 'missing' (idempotent upsert).
 * Actual fetch from selfh.st is deferred to a later phase.
 */
export function refreshIcons(input: RefreshIconsInput): RefreshResult {
  const db = getDb();
  let recorded = 0;
  let existing = 0;

  for (const key of input.keys) {
    const normalizedKey = key.toLowerCase().trim();
    if (!normalizedKey) continue;

    const existingRow = db
      .select()
      .from(iconCacheEntries)
      .where(eq(iconCacheEntries.iconKey, normalizedKey))
      .get();

    if (existingRow) {
      existing++;
    } else {
      db.insert(iconCacheEntries)
        .values({
          iconKey: normalizedKey,
          source: 'selfh',
          status: 'missing',
        })
        .run();
      recorded++;
    }
  }

  return { recorded, existing, keys: input.keys };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function toRow(row: typeof iconCacheEntries.$inferSelect): IconCacheRow {
  return {
    iconKey: row.iconKey,
    source: row.source,
    sourceUrl: row.sourceUrl ?? null,
    assetId: row.assetId ?? null,
    etag: row.etag ?? null,
    lastFetchedAt: row.lastFetchedAt ?? null,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
  };
}
