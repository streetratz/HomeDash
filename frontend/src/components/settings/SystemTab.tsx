/**
 * System settings tab — Admin-only infrastructure settings.
 * Contains: Timezone, Scheduled Jobs, and Backup & Restore.
 */

import { TimezoneSelector } from './TimezoneSelector.js';
import { ScheduledJobsTab } from './ScheduledJobsTab.js';
import { BackupRestoreSection } from './BackupRestoreSection.js';

export function SystemTab() {
  return (
    <div className="space-y-6">
      <TimezoneSelector />
      <ScheduledJobsTab />
      <BackupRestoreSection />
    </div>
  );
}
