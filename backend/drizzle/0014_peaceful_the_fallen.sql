CREATE TABLE `integration_configs` (
	`provider` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_configs_pk` ON `integration_configs` (`provider`,`key`);