CREATE TABLE `photo_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`manifest_json` text,
	`last_scanned_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_idle_minutes` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_source_id` text;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_interval_seconds` integer DEFAULT 30 NOT NULL;