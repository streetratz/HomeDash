CREATE TABLE `calendar_birthdays` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`birth_year` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `calendar_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_birthdays_source_id_idx` ON `calendar_birthdays` (`source_id`);