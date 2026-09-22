ALTER TABLE `placeholder_widgets` ADD `show_title` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Populate empty titles with the widget type name for existing placeholders
UPDATE `placeholder_widgets`
SET `title` = (
  SELECT CASE `type`
    WHEN 'clock' THEN 'Clock'
    WHEN 'links_list' THEN 'Links List'
    WHEN 'notes' THEN 'Notes'
    WHEN 'iframe' THEN 'Web Frame'
    WHEN 'system_monitor' THEN 'System Monitor'
    WHEN 'weather' THEN 'Weather'
    WHEN 'calendar' THEN 'Calendar'
    WHEN 'todo' THEN 'Todo'
    WHEN 'docker' THEN 'Docker'
    WHEN 'photo_frame' THEN 'Photo Frame'
    WHEN 'sonos' THEN 'Sonos'
    WHEN 'app_shortcuts' THEN 'App Shortcuts'
    WHEN 'pihole' THEN 'Pi-hole'
    WHEN 'sonos_browse' THEN 'Sonos Browse'
    WHEN 'stocks' THEN 'Stocks'
    ELSE `type`
  END
  FROM `app_widget_instances`
  WHERE `app_widget_instances`.`placeholder_id` = `placeholder_widgets`.`id`
  LIMIT 1
)
WHERE `title` IS NULL OR `title` = '';