CREATE TABLE `dashboard_access_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`group_id` text NOT NULL,
	`access_level` text NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dashboard_access_rules_dashboard_id_idx` ON `dashboard_access_rules` (`dashboard_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_access_rules_unique_idx` ON `dashboard_access_rules` (`dashboard_id`,`group_id`,`access_level`);--> statement-breakpoint
CREATE TABLE `group_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_permissions_group_id_idx` ON `group_permissions` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_permissions_unique_idx` ON `group_permissions` (`group_id`,`category`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`description` text,
	`is_built_in` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_slug_idx` ON `groups` (`slug`);--> statement-breakpoint
CREATE TABLE `user_group_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_group_memberships_user_id_idx` ON `user_group_memberships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_group_memberships_unique_idx` ON `user_group_memberships` (`user_id`,`group_id`);--> statement-breakpoint

-- ── Seed: Built-in groups ────────────────────────────────────────────────────
INSERT OR IGNORE INTO `groups` (`id`, `name`, `slug`, `description`, `is_built_in`, `created_at`, `updated_at`)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Administrators', 'administrators', 'Full access to all features', 1, datetime('now'), datetime('now')),
  ('00000000-0000-4000-8000-000000000002', 'Users',          'users',          'Standard dashboard and widget access', 1, datetime('now'), datetime('now')),
  ('00000000-0000-4000-8000-000000000003', 'Viewers',        'viewers',        'View-only dashboard access', 1, datetime('now'), datetime('now'));
--> statement-breakpoint

-- ── Seed: Administrators permissions (all categories at manage) ──────────────
INSERT OR IGNORE INTO `group_permissions` (`id`, `group_id`, `category`, `level`)
VALUES
  ('00000000-0000-4000-9001-000000000001', '00000000-0000-4000-8000-000000000001', 'dashboards',   'manage'),
  ('00000000-0000-4000-9001-000000000002', '00000000-0000-4000-8000-000000000001', 'widgets',      'manage'),
  ('00000000-0000-4000-9001-000000000003', '00000000-0000-4000-8000-000000000001', 'settings',     'manage'),
  ('00000000-0000-4000-9001-000000000004', '00000000-0000-4000-8000-000000000001', 'users',        'manage'),
  ('00000000-0000-4000-9001-000000000005', '00000000-0000-4000-8000-000000000001', 'integrations', 'manage');
--> statement-breakpoint

-- ── Seed: Users permissions (view dashboards, widgets, settings, integrations) ─
INSERT OR IGNORE INTO `group_permissions` (`id`, `group_id`, `category`, `level`)
VALUES
  ('00000000-0000-4000-9002-000000000001', '00000000-0000-4000-8000-000000000002', 'dashboards',   'view'),
  ('00000000-0000-4000-9002-000000000002', '00000000-0000-4000-8000-000000000002', 'widgets',      'view'),
  ('00000000-0000-4000-9002-000000000003', '00000000-0000-4000-8000-000000000002', 'settings',     'view'),
  ('00000000-0000-4000-9002-000000000004', '00000000-0000-4000-8000-000000000002', 'integrations', 'view');
--> statement-breakpoint

-- ── Seed: Viewers permissions (view dashboards only) ─────────────────────────
INSERT OR IGNORE INTO `group_permissions` (`id`, `group_id`, `category`, `level`)
VALUES
  ('00000000-0000-4000-9003-000000000001', '00000000-0000-4000-8000-000000000003', 'dashboards',   'view');
--> statement-breakpoint

-- ── Migration: Map existing admin users → Administrators group ───────────────
INSERT OR IGNORE INTO `user_group_memberships` (`id`, `user_id`, `group_id`, `created_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  u.id,
  '00000000-0000-4000-8000-000000000001',
  datetime('now')
FROM users u WHERE u.role = 'admin';
--> statement-breakpoint

-- ── Migration: Map existing standard users → Users group ─────────────────────
INSERT OR IGNORE INTO `user_group_memberships` (`id`, `user_id`, `group_id`, `created_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  u.id,
  '00000000-0000-4000-8000-000000000002',
  datetime('now')
FROM users u WHERE u.role = 'standard';