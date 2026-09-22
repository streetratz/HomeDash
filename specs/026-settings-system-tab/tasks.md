# Tasks: Settings System Tab + Cron Scheduler

**Input**: Design documents from `/specs/026-settings-system-tab/`  
**GitHub Issue**: #74

## Phase 1: System Tab Consolidation

**Purpose**: Move infrastructure settings out of General into a new System tab

- [x] T001 [US1] Create `frontend/src/components/settings/SystemTab.tsx` — composite component rendering TimezoneSelector, ScheduledJobsTab (as section), and BackupRestoreSection
- [x] T002 [US1] Update `frontend/src/pages/SettingsPage.tsx` — replace "scheduled-jobs" tab with "system", add legacy redirect, update icon
- [x] T003 [US1] Update `frontend/src/components/settings/GeneralTab.tsx` — remove TimezoneSelector and BackupRestoreSection renders

**Checkpoint**: System tab visible with all three sections; General tab only shows Theme + Dashboard Prefs

---

## Phase 2: Cron Schedule Builder

**Purpose**: Replace raw cron input with human-friendly visual builder

- [x] T004 [US2] Create `frontend/src/components/settings/CronScheduleBuilder.tsx` — controlled component with frequency presets, sub-controls, preview text, and auto-detection
- [x] T005 [US2] Integrate CronScheduleBuilder into `ScheduledJobsTab.tsx` JobFormDialog — replace raw Input with new builder component

**Checkpoint**: Job create/edit uses visual builder; raw cron still stored in DB unchanged

---

## Phase 3: Validation & Polish

**Purpose**: Verify everything works correctly

- [x] T006 [US1,US2] Run typecheck + lint + build to verify no errors
- [x] T007 [US1,US2] Manual browser test — System tab layout, cron builder presets, legacy URL redirect

---

## Dependencies

- T001 → T002 (SystemTab must exist before SettingsPage references it)
- T002 → T003 (move sections to System before removing from General)
- T004 → T005 (builder must exist before integrating into form)
- T001–T005 → T006 → T007
