CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`start_tz` text,
	`end_tz` text,
	`is_all_day` integer DEFAULT false NOT NULL,
	`recurrence_rule` text,
	`calendar_name` text,
	`raw_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `calendar_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_events_source_start_idx` ON `calendar_events` (`source_id`,`start_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_events_source_provider_idx` ON `calendar_events` (`source_id`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `calendar_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`oauth_account_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`sync_interval_seconds` integer DEFAULT 300 NOT NULL,
	`last_sync_at` text,
	`last_sync_error` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`oauth_account_id`) REFERENCES `oauth_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calendar_sources_user_id_idx` ON `calendar_sources` (`user_id`);--> statement-breakpoint
CREATE INDEX `calendar_sources_oauth_account_id_idx` ON `calendar_sources` (`oauth_account_id`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`access_token_enc` text NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`token_expires_at` text,
	`email` text,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_id_idx` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_account_idx` ON `oauth_accounts` (`provider`,`provider_account_id`);