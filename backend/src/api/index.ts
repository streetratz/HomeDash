/**
 * T031: Wire all route registrations into the server.
 * T072 (US2): Assets routes added.
 * Import this in server.ts to register all API routes.
 */

import type { FastifyInstance } from 'fastify';
import { registerOpsRoutes } from './ops.js';
import { registerPublicRoutes } from './public.js';
import { registerAuthRoutes } from './auth.js';
import { registerUserRoutes } from './user.js';
import { registerAdminRoutes } from './admin.js';
import { registerAssetsRoutes } from './assets.js';
import { registerAuthOAuthRoutes } from './auth-oauth.js';
import { registerCalendarRoutes } from './admin-calendar.js';
import { registerAdminTodoRoutes } from './admin-todo.js';
import { registerAdminTodoSyncRoutes } from './admin-todo-sync.js';
import { registerDockerRoutes } from './docker.js';
import { registerPhotoRoutes } from './photos.js';
import { registerSpotifyRoutes } from './spotify.js';
import { registerAdminGroupRoutes } from './admin-groups.js';
import { registerAdminGroupMemberRoutes } from './admin-group-members.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerAdminAppShortcutRoutes } from './admin-app-shortcuts.js';
import { registerPiholeRoutes } from './pihole.js';
import { registerConnectionRoutes } from './connections.js';
import { registerSonosRoutes } from './sonos.js';
import { registerStocksRoutes } from './stocks.js';
import { registerUnifiRoutes } from './unifi.js';
import { registerAdminBackupRoutes } from './admin-backup.js';
import { registerTimezoneRoutes } from './admin-timezone.js';
import { registerAdminScheduledJobRoutes } from './admin-scheduled-jobs.js';
import { registerSystemRoutes } from './system.js';

export function registerAllRoutes(app: FastifyInstance): void {
  // Operations (no prefix — /healthz, /readyz)
  registerOpsRoutes(app);

  // Asset routes — /favicon.ico etc. (before static serving)
  registerAssetsRoutes(app);

  // Public API — no auth required
  registerPublicRoutes(app);

  // Auth API — login/logout/me/first-run
  registerAuthRoutes(app);

  // OAuth API — redirect flows + account management
  registerAuthOAuthRoutes(app);

  // Authenticated user API
  registerUserRoutes(app);

  // Admin-only API
  registerAdminRoutes(app);

  // Calendar source CRUD + events read API
  registerCalendarRoutes(app);

  // Todo list/item CRUD API
  registerAdminTodoRoutes(app);

  // Todo sync API (Microsoft To Do)
  registerAdminTodoSyncRoutes(app);

  // Docker container API
  registerDockerRoutes(app);

  // Photo source + image serving API
  registerPhotoRoutes(app);

  // Spotify OAuth + playback + search API
  registerSpotifyRoutes(app);

  // RBAC: Group management API
  registerAdminGroupRoutes(app);

  // RBAC: Group membership API
  registerAdminGroupMemberRoutes(app);

  // Admin: User management CRUD API
  registerAdminUserRoutes(app);

  // App Shortcuts widget CRUD API
  registerAdminAppShortcutRoutes(app);

  // Pi-hole DNS Controls widget proxy API
  registerPiholeRoutes(app);

  // Integrations Hub: connection CRUD API
  registerConnectionRoutes(app);

  // Sonos Cloud Control API — OAuth + playback + volume + groups
  registerSonosRoutes(app);

  // Stocks widget — market data proxy
  registerStocksRoutes(app);

  // UniFi Network Controller widget
  registerUnifiRoutes(app);

  // Backup & Restore API
  registerAdminBackupRoutes(app);

  // Timezone list API (all authenticated users)
  registerTimezoneRoutes(app);

  // Scheduled Jobs admin API
  registerAdminScheduledJobRoutes(app);

  // System info API (no auth — read-only)
  registerSystemRoutes(app);
}
