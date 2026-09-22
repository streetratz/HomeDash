CREATE TABLE `placeholder_breakpoint_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`placeholder_id` text NOT NULL,
	`breakpoint` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`w` integer NOT NULL,
	`h` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`placeholder_id`) REFERENCES `placeholder_widgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `placeholder_bp_unique_idx` ON `placeholder_breakpoint_layouts` (`placeholder_id`,`breakpoint`);