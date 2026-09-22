ALTER TABLE `app_shell_settings` ADD `screensaver_weather_lat` real;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_weather_lon` real;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_weather_location` text;--> statement-breakpoint
ALTER TABLE `app_shell_settings` ADD `screensaver_weather_unit` text DEFAULT 'C';