-- Add home_clock_config column to store per-clock display configuration for the home clock.
-- Stores: { label?, layout?, showOffset?, homeIconSide?, dayNightSide? } as JSON string or NULL.
ALTER TABLE `app_shell_settings` ADD `home_clock_config` text;
