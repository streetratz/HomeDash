/**
 * Startup reconciliation for Docker connection rows written by older releases.
 *
 * Before the strict endpoint grammar, absolute paths such as
 * `/var/run/docker.sock` were valid Unix socket endpoints. Preserve those
 * existing connections by adding the explicit `unix://` scheme in place.
 * Ambiguous and invalid values remain untouched so they continue to fail
 * closed.
 */

import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';

import { getDb } from '../db/drizzle.js';
import { dockerConnections } from '../db/schema/index.js';
import { normalizeLegacyPersistedDockerEndpoint } from '../lib/validation.js';

export interface DockerConnectionUpgradeResult {
  normalized: string[];
}

export function normalizeLegacyDockerConnections(): DockerConnectionUpgradeResult {
  const db = getDb();

  return db.transaction((tx) => {
    const result: DockerConnectionUpgradeResult = { normalized: [] };
    const rows = tx
      .select({ id: dockerConnections.id, dockerUrl: dockerConnections.dockerUrl })
      .from(dockerConnections)
      .all();
    const updatedAt = new Date().toISOString();

    for (const row of rows) {
      const normalized = normalizeLegacyPersistedDockerEndpoint(row.dockerUrl);
      if (normalized === null) continue;

      tx.update(dockerConnections)
        .set({ dockerUrl: normalized, updatedAt })
        .where(eq(dockerConnections.id, row.id))
        .run();
      result.normalized.push(row.id);
    }

    return result;
  });
}

export function runDockerConnectionUpgrade(log: FastifyBaseLogger): DockerConnectionUpgradeResult {
  const result = normalizeLegacyDockerConnections();
  for (const connectionId of result.normalized) {
    log.warn(
      { connectionId },
      'Normalized legacy Docker connection endpoint to an explicit Unix socket scheme',
    );
  }
  return result;
}
