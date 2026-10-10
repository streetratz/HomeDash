CREATE TABLE `collection_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`kind` text NOT NULL,
	`original_date` text,
	`actual_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `collection_streams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "collection_exceptions_shape" CHECK((
    "collection_exceptions"."kind" = 'skip' AND "collection_exceptions"."original_date" IS NOT NULL AND "collection_exceptions"."actual_date" IS NULL
  ) OR (
    "collection_exceptions"."kind" = 'replace' AND "collection_exceptions"."original_date" IS NOT NULL AND "collection_exceptions"."actual_date" IS NOT NULL AND "collection_exceptions"."original_date" != "collection_exceptions"."actual_date"
  ) OR (
    "collection_exceptions"."kind" = 'add' AND "collection_exceptions"."original_date" IS NULL AND "collection_exceptions"."actual_date" IS NOT NULL
  ))
);
--> statement-breakpoint
CREATE INDEX `collection_exceptions_stream_idx` ON `collection_exceptions` (`stream_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_exceptions_origin_idx` ON `collection_exceptions` (`stream_id`,`original_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_exceptions_actual_idx` ON `collection_exceptions` (`stream_id`,`actual_date`);--> statement-breakpoint
CREATE TABLE `collection_explicit_dates` (
	`stream_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`stream_id`, `date`),
	FOREIGN KEY (`stream_id`) REFERENCES `collection_streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collection_household` (
	`id` text PRIMARY KEY NOT NULL,
	`timezone` text NOT NULL,
	`provider_label` text,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "collection_household_singleton" CHECK("collection_household"."id" = 'global'),
	CONSTRAINT "collection_household_revision" CHECK("collection_household"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE `collection_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`enabled` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`schedule_mode` text NOT NULL,
	`weekdays_mask` integer,
	`interval_weeks` integer,
	`anchor_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `collection_household`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "collection_streams_order" CHECK("collection_streams"."sort_order" BETWEEN 0 AND 31),
	CONSTRAINT "collection_streams_enabled" CHECK("collection_streams"."enabled" IN (0,1)),
	CONSTRAINT "collection_streams_shape" CHECK((
    "collection_streams"."schedule_mode" = 'regular' AND "collection_streams"."weekdays_mask" IS NOT NULL AND "collection_streams"."weekdays_mask" BETWEEN 1 AND 127
    AND "collection_streams"."interval_weeks" IS NOT NULL AND "collection_streams"."interval_weeks" BETWEEN 1 AND 52 AND "collection_streams"."anchor_date" IS NOT NULL
  ) OR (
    "collection_streams"."schedule_mode" = 'explicit' AND "collection_streams"."weekdays_mask" IS NULL AND "collection_streams"."interval_weeks" IS NULL AND "collection_streams"."anchor_date" IS NULL
  ))
);
--> statement-breakpoint
CREATE INDEX `collection_streams_household_idx` ON `collection_streams` (`household_id`);