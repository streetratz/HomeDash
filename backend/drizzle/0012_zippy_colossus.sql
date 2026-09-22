CREATE TABLE `pihole_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_instance_id` text NOT NULL,
	`base_url` text NOT NULL,
	`api_token_encrypted` text NOT NULL,
	`poll_interval_sec` integer DEFAULT 30 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pihole_instances_widget_instance_id_unique` ON `pihole_instances` (`widget_instance_id`);