/**
 * Integration config key-value store.
 * Stores per-provider configuration (e.g. Spotify client ID/secret) in the DB
 * so admins can configure integrations from the Settings UI.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { integrationConfigs } from '../db/schema/index.js';

/** Get a single config value for a provider. Returns null if not set. */
export function getIntegrationConfig(provider: string, key: string): string | null {
  const db = getDb();
  const row = db
    .select({ value: integrationConfigs.value })
    .from(integrationConfigs)
    .where(and(eq(integrationConfigs.provider, provider), eq(integrationConfigs.key, key)))
    .get();
  return row?.value ?? null;
}

/** Get all config values for a provider as a Record. */
export function getIntegrationConfigs(provider: string): Record<string, string> {
  const db = getDb();
  const rows = db
    .select({ key: integrationConfigs.key, value: integrationConfigs.value })
    .from(integrationConfigs)
    .where(eq(integrationConfigs.provider, provider))
    .all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/** Set a config value for a provider. */
export function setIntegrationConfig(provider: string, key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(integrationConfigs)
    .values({ provider, key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: [integrationConfigs.provider, integrationConfigs.key],
      set: { value, updatedAt: now },
    })
    .run();
}

/** Set multiple config values for a provider at once. */
export function setIntegrationConfigs(provider: string, configs: Record<string, string>): void {
  for (const [key, value] of Object.entries(configs)) {
    setIntegrationConfig(provider, key, value);
  }
}

/** Delete all config values for a provider. */
export function deleteIntegrationConfigs(provider: string): void {
  const db = getDb();
  db.delete(integrationConfigs).where(eq(integrationConfigs.provider, provider)).run();
}
