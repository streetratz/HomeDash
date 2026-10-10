PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_collection_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text DEFAULT 'Trash2' NOT NULL,
	`enabled` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`schedule_mode` text NOT NULL,
	`weekdays_mask` integer,
	`interval_weeks` integer,
	`anchor_date` text,
	`start_date` text,
	`end_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `collection_household`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "collection_streams_order" CHECK("__new_collection_streams"."sort_order" BETWEEN 0 AND 31),
	CONSTRAINT "collection_streams_enabled" CHECK("__new_collection_streams"."enabled" IN (0,1)),
	CONSTRAINT "collection_streams_shape" CHECK((
    "__new_collection_streams"."schedule_mode" = 'regular' AND "__new_collection_streams"."weekdays_mask" IS NOT NULL AND "__new_collection_streams"."weekdays_mask" BETWEEN 1 AND 127
    AND "__new_collection_streams"."interval_weeks" IS NOT NULL AND "__new_collection_streams"."interval_weeks" BETWEEN 1 AND 52 AND "__new_collection_streams"."anchor_date" IS NOT NULL
    AND ("__new_collection_streams"."start_date" IS NULL OR "__new_collection_streams"."end_date" IS NULL OR "__new_collection_streams"."start_date" <= "__new_collection_streams"."end_date")
  ) OR (
    "__new_collection_streams"."schedule_mode" = 'explicit' AND "__new_collection_streams"."weekdays_mask" IS NULL AND "__new_collection_streams"."interval_weeks" IS NULL AND "__new_collection_streams"."anchor_date" IS NULL
    AND "__new_collection_streams"."start_date" IS NULL AND "__new_collection_streams"."end_date" IS NULL
  ))
);
--> statement-breakpoint
INSERT INTO `__new_collection_streams`("id", "household_id", "name", "color", "icon", "enabled", "sort_order", "schedule_mode", "weekdays_mask", "interval_weeks", "anchor_date", "start_date", "end_date", "created_at", "updated_at") SELECT "id", "household_id", "name", "color", "icon", "enabled", "sort_order", "schedule_mode", "weekdays_mask", "interval_weeks", "anchor_date", "start_date", "end_date", "created_at", "updated_at" FROM `collection_streams`;--> statement-breakpoint
DROP TABLE `collection_streams`;--> statement-breakpoint
ALTER TABLE `__new_collection_streams` RENAME TO `collection_streams`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `collection_streams_household_idx` ON `collection_streams` (`household_id`);