DROP INDEX `widget_conn_pk`;--> statement-breakpoint
ALTER TABLE `widget_connections` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `widget_conn_pk` ON `widget_connections` (`widget_instance_id`,`connection_type`,`connection_id`);