CREATE TABLE `app_shortcuts` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_instance_id` text NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`icon_asset_id` text,
	`icon_override_asset_id` text,
	`ping_enabled` integer DEFAULT 0 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `shortcut_groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`icon_asset_id`) REFERENCES `uploaded_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`icon_override_asset_id`) REFERENCES `uploaded_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_shortcuts_widget_instance_id_idx` ON `app_shortcuts` (`widget_instance_id`);--> statement-breakpoint
CREATE INDEX `app_shortcuts_group_id_idx` ON `app_shortcuts` (`group_id`);--> statement-breakpoint
CREATE TABLE `shortcut_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_instance_id` text NOT NULL,
	`name` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shortcut_groups_widget_instance_id_idx` ON `shortcut_groups` (`widget_instance_id`);--> statement-breakpoint
CREATE TABLE `shortcut_ping_results` (
	`shortcut_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`response_time_ms` integer,
	`checked_at` text NOT NULL,
	`error` text,
	FOREIGN KEY (`shortcut_id`) REFERENCES `app_shortcuts`(`id`) ON UPDATE no action ON DELETE cascade
);
