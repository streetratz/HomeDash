/**
 * Adoption of legacy per-widget Docker URLs (043 / FR-022, FR-023).
 *
 * Before this feature a Docker widget could carry its endpoint inline as
 * `config.dockerUrl`. That is now unsupported: routes resolve the endpoint from
 * `widget_connections` → `docker_connections`, so an un-adopted widget would
 * simply stop working with "no Docker connection configured".
 *
 * This pass moves those values into real connection rows at startup. It writes
 * **rows into existing tables only — no DDL**, so it is not a migration and
 * carries no schema version. That matters: it is safe to run on every boot, and
 * it is safe for it to do nothing.
 *
 * Two properties it must hold:
 *
 * - **Idempotent.** A widget already linked to a Docker connection is skipped,
 *   and the `config.dockerUrl` field is removed once adopted, so a second run
 *   has nothing to find.
 * - **Non-destructive on bad input.** A value that fails the endpoint grammar
 *   is *left in the config and reported*, never imported (RK-7). Importing it
 *   would create a connection row that can never be dialled and would strip the
 *   only copy of what the user originally typed.
 */

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { appWidgetInstances, widgetConnections, dockerConnections } from '../db/schema/index.js';
import { normalizeLegacyPersistedDockerEndpoint, parseDockerEndpoint } from '../lib/validation.js';
import type { FastifyBaseLogger } from 'fastify';

export interface AdoptionResult {
  /** Widgets whose legacy URL became a connection row. */
  adopted: string[];
  /** Widgets left untouched because the stored value is not a valid endpoint. */
  skipped: { widgetInstanceId: string; reason: string }[];
}

/**
 * Adopt every widget carrying a legacy `config.dockerUrl`.
 *
 * Safe to call repeatedly. Never throws for a single bad widget — one bad row
 * must not stop the server from booting.
 */
export function adoptLegacyDockerWidgets(): AdoptionResult {
  const db = getDb();
  const result: AdoptionResult = { adopted: [], skipped: [] };

  const widgets = db
    .select({ id: appWidgetInstances.id, configJson: appWidgetInstances.configJson })
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.type, 'docker'))
    .all();

  for (const widget of widgets) {
    let config: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(widget.configJson);
      if (typeof parsed !== 'object' || parsed === null) continue;
      config = parsed as Record<string, unknown>;
    } catch {
      result.skipped.push({ widgetInstanceId: widget.id, reason: 'config is not valid JSON' });
      continue;
    }

    const legacyUrl = config['dockerUrl'];
    if (typeof legacyUrl !== 'string' || legacyUrl.trim().length === 0) continue;

    const existing = db
      .select({ connectionId: widgetConnections.connectionId })
      .from(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, widget.id),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .get();

    if (existing) {
      // Already linked; the link wins. Drop the stale inline copy so the two
      // cannot drift and so this widget is not reconsidered next boot.
      writeConfigWithoutDockerUrl(widget.id, config);
      result.adopted.push(widget.id);
      continue;
    }

    const dockerUrl = normalizeLegacyPersistedDockerEndpoint(legacyUrl) ?? legacyUrl.trim();
    const endpoint = parseDockerEndpoint(dockerUrl);
    if (!endpoint.ok) {
      result.skipped.push({ widgetInstanceId: widget.id, reason: endpoint.error });
      continue;
    }

    const now = new Date().toISOString();
    const connectionId = randomUUID();
    const name =
      typeof config['title'] === 'string' && config['title'].trim().length > 0
        ? `${config['title']} (adopted)`
        : `Adopted Docker host (${widget.id.slice(0, 8)})`;

    db.insert(dockerConnections)
      .values({
        id: connectionId,
        name,
        dockerUrl,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(widgetConnections)
      .values({
        widgetInstanceId: widget.id,
        connectionType: 'docker',
        connectionId,
        sortOrder: 0,
      })
      .run();

    writeConfigWithoutDockerUrl(widget.id, config);
    result.adopted.push(widget.id);
  }

  return result;
}

function writeConfigWithoutDockerUrl(
  widgetInstanceId: string,
  config: Record<string, unknown>,
): void {
  const rest = { ...config };
  delete rest['dockerUrl'];
  getDb()
    .update(appWidgetInstances)
    .set({ configJson: JSON.stringify(rest), updatedAt: new Date().toISOString() })
    .where(eq(appWidgetInstances.id, widgetInstanceId))
    .run();
}

/**
 * Run the pass and report one line per widget.
 *
 * Defaults to `console` rather than the Fastify logger: `app.log` is typed
 * `any` in this codebase, so passing it would add fresh `no-unsafe-argument`
 * lint errors. console→pino is tracked separately as #184.
 */
export function runDockerWidgetAdoption(
  log: FastifyBaseLogger | Console = console,
): AdoptionResult {
  const result = adoptLegacyDockerWidgets();
  for (const id of result.adopted) {
    log.warn(`[docker-adoption] widget ${id}: legacy dockerUrl adopted into a connection`);
  }
  for (const { widgetInstanceId, reason } of result.skipped) {
    log.warn(
      `[docker-adoption] widget ${widgetInstanceId}: left unchanged, not a valid endpoint — ${reason}`,
    );
  }
  return result;
}
