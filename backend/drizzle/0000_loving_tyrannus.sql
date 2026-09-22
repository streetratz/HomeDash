CREATE TABLE `app_shell_settings` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`title_text` text DEFAULT 'HomeDash' NOT NULL,
	`title_font` text DEFAULT 'system' NOT NULL,
	`title_font_size_px` integer DEFAULT 20 NOT NULL,
	`header_height_px` integer DEFAULT 56 NOT NULL,
	`logo_asset_id` text,
	`clock_strip_enabled` integer DEFAULT false NOT NULL,
	`home_timezone` text,
	`timezones_json` text DEFAULT '[]' NOT NULL,
	`footer_text` text,
	`repo_url` text,
	`unauth_web_dashboard_id` text,
	`unauth_mobile_dashboard_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`logo_asset_id`) REFERENCES `uploaded_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`unauth_web_dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`unauth_mobile_dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `app_widget_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`placeholder_id` text NOT NULL,
	`type` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`placeholder_id`) REFERENCES `placeholder_widgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`applicability` text DEFAULT 'both' NOT NULL,
	`background_type` text DEFAULT 'solid' NOT NULL,
	`background_color` text,
	`background_asset_id` text,
	`background_display_mode` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`background_asset_id`) REFERENCES `uploaded_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `icon_cache_entries` (
	`icon_key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`asset_id` text,
	`etag` text,
	`last_fetched_at` text,
	`status` text DEFAULT 'missing' NOT NULL,
	`error_message` text,
	FOREIGN KEY (`asset_id`) REFERENCES `uploaded_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `links_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_instance_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`icon_key` text,
	`icon_override_key` text,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `placeholder_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`stable_key` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`w` integer NOT NULL,
	`h` integer NOT NULL,
	`border_color` text DEFAULT '#ffffff' NOT NULL,
	`title` text,
	`opacity` real DEFAULT 0.3 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`csrf_secret` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `uploaded_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_path` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme_mode` text DEFAULT 'dark' NOT NULL,
	`web_dashboard_id` text,
	`mobile_dashboard_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`web_dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mobile_dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `app_widget_instances_placeholder_order_idx` ON `app_widget_instances` (`placeholder_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `dashboards_applicability_idx` ON `dashboards` (`applicability`);--> statement-breakpoint
CREATE INDEX `links_list_items_widget_order_idx` ON `links_list_items` (`widget_instance_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `placeholder_widgets_dashboard_id_idx` ON `placeholder_widgets` (`dashboard_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);