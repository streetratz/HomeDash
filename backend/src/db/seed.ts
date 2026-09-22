/**
 * T056 (US1): DB seed — ensures at least one starter dashboard and the global shell
 * settings singleton exist after migrations run.
 *
 * Rules per spec:
 * - Creates an "Overview" dashboard (applicability: both) if no dashboards exist.
 * - Creates the `app_shell_settings` singleton row (id='global') if it doesn't exist.
 * - Does NOT auto-select any dashboard as the unauthenticated default — admin must
 *   explicitly configure that (FR requirement: unauth defaults are opt-in).
 */

import { getDb } from './drizzle.js';
import { appShellSettings, dashboards } from './schema/index.js';

export function seedDatabase(log?: { info: (msg: string) => void }): void {
  const db = getDb();
  const now = new Date().toISOString();

  // ── Shell settings singleton ─────────────────────────────────────────────────
  const existingShell = db.select().from(appShellSettings).limit(1).get();
  if (!existingShell) {
    db.insert(appShellSettings)
      .values({
        id: 'global',
        titleText: 'HomeDash',
        titleFont: 'system',
        titleFontSizePx: 20,
        headerHeightPx: 56,
        clockStripEnabled: false,
        timezonesJson: '[]',
        updatedAt: now,
      })
      .run();
    log?.info('Seeded: app_shell_settings singleton created');
  }

  // ── Starter dashboard ────────────────────────────────────────────────────────
  const existingDashboards = db.select().from(dashboards).limit(1).get();
  if (!existingDashboards) {
    const id = crypto.randomUUID();
    db.insert(dashboards)
      .values({
        id,
        name: 'Overview',
        applicability: 'both',
        backgroundType: 'solid',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    log?.info(`Seeded: starter dashboard created (id=${id})`);
  }
}
