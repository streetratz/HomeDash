# Implementation Plan: Settings System Tab + Cron Scheduler

## Architecture

**Approach**: Frontend-only changes. No backend/API/DB modifications needed.

### File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/SettingsPage.tsx` | Modify | Replace "scheduled-jobs" tab with "system", add legacy redirect, update icon |
| `frontend/src/components/settings/SystemTab.tsx` | Create | New composite tab containing Timezone + Jobs + Backup sections |
| `frontend/src/components/settings/CronScheduleBuilder.tsx` | Create | Visual frequency picker with presets |
| `frontend/src/components/settings/ScheduledJobsTab.tsx` | Modify | Use CronScheduleBuilder in job form dialog instead of raw input |
| `frontend/src/components/settings/GeneralTab.tsx` | Modify | Remove Timezone and BackupRestore imports/renders |

### Phase 1: System Tab Consolidation

1. Create `SystemTab.tsx` that composes:
   - `<TimezoneSelector />`
   - Scheduled Jobs section (inline the job list + form from ScheduledJobsTab)
   - `<BackupRestoreSection />`

2. Update `SettingsPage.tsx`:
   - Replace `scheduled-jobs` → `system` in TAB_IDS
   - Import `SystemTab` instead of `ScheduledJobsTab`
   - Change icon to `Server`
   - Add legacy redirect: `scheduled-jobs` → `system`

3. Update `GeneralTab.tsx`:
   - Remove `<TimezoneSelector />` render
   - Remove `<BackupRestoreSection />` render and `isAdmin` prop dependency for it

### Phase 2: Cron Schedule Builder

1. Create `CronScheduleBuilder.tsx`:
   - Frequency select: "Every X Minutes" | "Hourly" | "Daily" | "Weekly" | "Monthly" | "Advanced"
   - Sub-controls per frequency (minute picker, hour:minute, day-of-week, day-of-month)
   - Human-readable preview text
   - `value` / `onChange(cronExpr)` interface (controlled component)
   - Auto-detection: parse incoming cron → select matching preset

2. Integrate into `ScheduledJobsTab.tsx` `JobFormDialog`:
   - Replace raw `<Input>` for cron with `<CronScheduleBuilder>`
   - Keep same data flow (cron string stored in form state)

### Design Decisions

- CronScheduleBuilder is a controlled component (`value: string, onChange: (v: string) => void`)
- Auto-detect logic: try to match incoming cron against known presets; fall back to "Advanced"
- Time inputs use 24h format internally, display as AM/PM
- Preset list matches issue #74 exactly
