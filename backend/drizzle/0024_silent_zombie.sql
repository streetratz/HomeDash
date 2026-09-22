CREATE TABLE `scheduled_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`action_type` text NOT NULL,
	`action_params` text DEFAULT '{}' NOT NULL,
	`cron_expression` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`last_run_at` text,
	`last_run_status` text,
	`last_run_error` text,
	`disabled_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
