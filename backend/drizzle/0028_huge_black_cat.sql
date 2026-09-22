PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_widget_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`placeholder_id` text NOT NULL,
	`type` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`public_visibility` text DEFAULT 'hidden' NOT NULL,
	`public_source_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`placeholder_id`) REFERENCES `placeholder_widgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`public_source_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "app_widget_instances_public_visibility_check" CHECK("__new_app_widget_instances"."public_visibility" in ('hidden', 'read-only', 'visible'))
);
--> statement-breakpoint
INSERT INTO `__new_app_widget_instances`("id", "placeholder_id", "type", "order_index", "config_json", "public_visibility", "public_source_user_id", "created_at", "updated_at") SELECT "id", "placeholder_id", "type", "order_index", "config_json", "public_visibility", "public_source_user_id", "created_at", "updated_at" FROM `app_widget_instances`;--> statement-breakpoint
DROP TABLE `app_widget_instances`;--> statement-breakpoint
ALTER TABLE `__new_app_widget_instances` RENAME TO `app_widget_instances`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `app_widget_instances_placeholder_order_idx` ON `app_widget_instances` (`placeholder_id`,`order_index`);