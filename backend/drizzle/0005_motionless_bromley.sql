CREATE TABLE `caldav_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`server_url` text NOT NULL,
	`username` text NOT NULL,
	`encrypted_password` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `caldav_accounts_user_id_idx` ON `caldav_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`order_index` integer NOT NULL,
	`provider_item_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `todo_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_items_list_id_idx` ON `todo_items` (`list_id`);--> statement-breakpoint
CREATE INDEX `todo_items_provider_item_idx` ON `todo_items` (`provider_item_id`);--> statement-breakpoint
CREATE TABLE `todo_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`provider_type` text DEFAULT 'local' NOT NULL,
	`provider_list_id` text,
	`oauth_account_id` text,
	`caldav_account_id` text,
	`last_synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`oauth_account_id`) REFERENCES `oauth_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `todo_lists_user_id_idx` ON `todo_lists` (`user_id`);