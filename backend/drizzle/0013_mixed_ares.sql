CREATE TABLE `docker_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Docker' NOT NULL,
	`docker_url` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `widget_connections` (
	`widget_instance_id` text NOT NULL,
	`connection_type` text NOT NULL,
	`connection_id` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `widget_conn_pk` ON `widget_connections` (`widget_instance_id`,`connection_type`);--> statement-breakpoint
CREATE INDEX `widget_conn_by_connection` ON `widget_connections` (`connection_type`,`connection_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pihole_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Pi-hole' NOT NULL,
	`widget_instance_id` text,
	`base_url` text NOT NULL,
	`api_token_encrypted` text NOT NULL,
	`poll_interval_sec` integer DEFAULT 30 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_pihole_instances`("id", "name", "widget_instance_id", "base_url", "api_token_encrypted", "poll_interval_sec", "created_at", "updated_at") SELECT "id", 'Pi-hole', "widget_instance_id", "base_url", "api_token_encrypted", "poll_interval_sec", "created_at", "updated_at" FROM `pihole_instances`;--> statement-breakpoint
DROP TABLE `pihole_instances`;--> statement-breakpoint
ALTER TABLE `__new_pihole_instances` RENAME TO `pihole_instances`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Backfill widget_connections for existing pihole instances
INSERT INTO `widget_connections` (`widget_instance_id`, `connection_type`, `connection_id`)
  SELECT `widget_instance_id`, 'pihole', `id` FROM `pihole_instances` WHERE `widget_instance_id` IS NOT NULL;