CREATE TABLE `unifi_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'UniFi' NOT NULL,
	`widget_instance_id` text,
	`base_url` text NOT NULL,
	`username_encrypted` text NOT NULL,
	`password_encrypted` text NOT NULL,
	`site_name` text DEFAULT 'default' NOT NULL,
	`poll_interval_sec` integer DEFAULT 30 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`widget_instance_id`) REFERENCES `app_widget_instances`(`id`) ON UPDATE no action ON DELETE set null
);
