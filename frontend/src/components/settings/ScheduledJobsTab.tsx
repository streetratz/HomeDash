/**
 * T037 (US5): Scheduled Jobs admin tab — CRUD UI for managing cron-based jobs.
 */

import { useState } from 'react';
import { Play, Plus, Pencil, Trash2, RefreshCw, Music } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Switch } from '../ui/switch.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';
import {
  useScheduledJobs,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  useRunJobNow,
} from '../../state/scheduledJobHooks.js';
import type { ScheduledJob } from '../../state/scheduledJobHooks.js';
import { CronScheduleBuilder } from './CronScheduleBuilder.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every minute';
  if (min?.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*') return 'Daily at midnight';
  if (min === '0' && hour !== '*' && dom === '*' && mon === '*' && dow === '*')
    return `Daily at ${hour}:00`;
  return expr;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  calendar_sync: 'Calendar Sync',
  sonos_playback: 'Sonos Playback',
};

function ActionIcon({ type }: { type: string }) {
  if (type === 'sonos_playback') return <Music className="h-3.5 w-3.5" />;
  return <RefreshCw className="h-3.5 w-3.5" />;
}

function LastRun({ job }: { job: ScheduledJob }) {
  if (!job.lastRunAt) {
    return <span className="text-xs text-muted-foreground">Never</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant={job.lastRunStatus === 'success' ? 'default' : 'destructive'}
        className="text-xs"
      >
        {job.lastRunStatus}
      </Badge>
      <span className="text-xs text-muted-foreground">{timeAgo(job.lastRunAt)}</span>
    </div>
  );
}

function JobActions({
  job,
  compact,
  isRunning,
  onRun,
  onEdit,
  onDelete,
}: {
  job: ScheduledJob;
  compact?: boolean;
  isRunning: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const buttonClass = compact ? undefined : 'h-11 flex-1';

  return (
    <div className={`flex items-center gap-1 ${compact ? 'justify-end' : ''}`}>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'sm'}
        className={buttonClass}
        aria-label={`Run ${job.name} now`}
        title="Run now"
        onClick={onRun}
        disabled={isRunning}
      >
        <Play className="h-4 w-4" />
        {!compact && 'Run'}
      </Button>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'sm'}
        className={buttonClass}
        aria-label={`Edit ${job.name}`}
        title="Edit"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
        {!compact && 'Edit'}
      </Button>
      {!job.isSystem ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant={compact ? 'ghost' : 'outline'}
              size={compact ? 'icon' : 'sm'}
              className={`${buttonClass ?? ''} text-destructive`}
              aria-label={`Delete ${job.name}`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
              {!compact && 'Delete'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{job.name}&rdquo;? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant={compact ? 'ghost' : 'outline'}
          size={compact ? 'icon' : 'sm'}
          className={buttonClass}
          disabled
          aria-label={`${job.name} is a system job and cannot be deleted`}
          title="System job"
        >
          <Trash2 className="h-4 w-4 opacity-30" />
          {!compact && 'Delete'}
        </Button>
      )}
    </div>
  );
}

// ── Job Form Dialog ──────────────────────────────────────────────────────────

interface JobFormState {
  name: string;
  actionType: string;
  cronExpression: string;
  enabled: boolean;
  actionParams: string;
}

const EMPTY_FORM: JobFormState = {
  name: '',
  actionType: 'calendar_sync',
  cronExpression: '* * * * *',
  enabled: true,
  actionParams: '{}',
};

function JobFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: JobFormState & { id?: string };
  onSubmit: (data: JobFormState & { id?: string }) => void;
  isPending: boolean;
}) {
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<JobFormState>(initialData ?? EMPTY_FORM);

  const handleOpen = (o: boolean) => {
    if (o && !isEdit) setForm(EMPTY_FORM);
    if (o && initialData) setForm(initialData);
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Job' : 'Add Scheduled Job'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the scheduled job configuration.' : 'Create a new cron-scheduled job.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="job-name">Name</Label>
            <Input
              id="job-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Job"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-action-type">Action Type</Label>
            <Select
              value={form.actionType}
              onValueChange={(v) => setForm((f) => ({ ...f, actionType: v, actionParams: v === 'calendar_sync' ? '{}' : f.actionParams }))}
            >
              <SelectTrigger id="job-action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar_sync">Calendar Sync</SelectItem>
                <SelectItem value="sonos_playback">Sonos Playback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <CronScheduleBuilder
              value={form.cronExpression}
              onChange={(cron) => setForm((f) => ({ ...f, cronExpression: cron }))}
            />
          </div>

          {form.actionType === 'sonos_playback' && (
            <div className="space-y-1.5">
              <Label htmlFor="job-params">Action Parameters (JSON)</Label>
              <textarea
                id="job-params"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.actionParams}
                onChange={(e) => setForm((f) => ({ ...f, actionParams: e.target.value }))}
                placeholder='{"userId":"...","groupId":"...","favoriteId":"..."}'
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="job-enabled"
              checked={form.enabled}
              onCheckedChange={(c) => setForm((f) => ({ ...f, enabled: c }))}
            />
            <Label htmlFor="job-enabled">Enabled</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isPending || !form.name.trim()}
            onClick={() => onSubmit({ ...form, id: initialData?.id ?? '' })}
          >
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

export function ScheduledJobsTab() {
  const jobsQuery = useScheduledJobs();
  const { data: jobs, isLoading } = jobsQuery;
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const runJobNow = useRunJobNow();

  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState<ScheduledJob | null>(null);

  function handleCreate(data: JobFormState) {
    createJob.mutate(
      {
        name: data.name,
        actionType: data.actionType,
        actionParams: data.actionParams,
        cronExpression: data.cronExpression,
        enabled: data.enabled,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleUpdate(data: JobFormState & { id?: string }) {
    if (!data.id) return;
    updateJob.mutate(
      {
        id: data.id,
        name: data.name,
        actionType: data.actionType,
        actionParams: data.actionParams,
        cronExpression: data.cronExpression,
        enabled: data.enabled,
      },
      { onSuccess: () => setEditJob(null) },
    );
  }

  function handleToggleEnabled(job: ScheduledJob) {
    updateJob.mutate({ id: job.id, enabled: !job.enabled });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>Manage cron-scheduled automation tasks.</CardDescription>
        </div>
        <Button size="sm" className="h-11 sm:h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Job
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <SettingsLoadingState label="Loading scheduled jobs…" />}

        {jobsQuery.isError && (
          <SettingsErrorState
            message="Scheduled jobs could not be loaded."
            onRetry={() => {
              void jobsQuery.refetch();
            }}
          />
        )}

        {!jobsQuery.isError && jobs && jobs.length === 0 && (
          <p className="text-sm text-muted-foreground">No scheduled jobs configured.</p>
        )}

        {!jobsQuery.isError && jobs && jobs.length > 0 && (
          <div className="space-y-3 md:hidden">
            {jobs.map((job) => (
              <section
                key={job.id}
                className="space-y-4 rounded-lg border border-border p-4"
                aria-labelledby={`job-${job.id}-name`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={`job-${job.id}-name`} className="truncate font-medium">
                      {job.name}
                    </h3>
                    <Badge variant="outline" className="mt-2 gap-1">
                      <ActionIcon type={job.actionType} />
                      {ACTION_TYPE_LABELS[job.actionType] ?? job.actionType}
                    </Badge>
                  </div>
                  {!!job.isSystem && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      System
                    </Badge>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Schedule</dt>
                    <dd title={job.cronExpression}>{describeCron(job.cronExpression)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Last run</dt>
                    <dd>
                      <LastRun job={job} />
                    </dd>
                  </div>
                </dl>

                <div className="flex min-h-11 items-center justify-between border-t border-border pt-3">
                  <Label htmlFor={`job-enabled-mobile-${job.id}`}>Enabled</Label>
                  <Switch
                    id={`job-enabled-mobile-${job.id}`}
                    checked={!!job.enabled}
                    onCheckedChange={() => handleToggleEnabled(job)}
                  />
                </div>

                <JobActions
                  job={job}
                  isRunning={runJobNow.isPending}
                  onRun={() => runJobNow.mutate(job.id)}
                  onEdit={() => setEditJob(job)}
                  onDelete={() => deleteJob.mutate(job.id)}
                />
              </section>
            ))}
          </div>
        )}

        {!jobsQuery.isError && jobs && jobs.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Schedule</th>
                  <th className="pb-2 pr-4 font-medium">Enabled</th>
                  <th className="pb-2 pr-4 font-medium">Last Run</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.name}</span>
                        {!!job.isSystem && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="gap-1">
                        <ActionIcon type={job.actionType} />
                        {ACTION_TYPE_LABELS[job.actionType] ?? job.actionType}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <span title={job.cronExpression}>{describeCron(job.cronExpression)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Switch
                        aria-label={`Enable ${job.name}`}
                        checked={!!job.enabled}
                        onCheckedChange={() => handleToggleEnabled(job)}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <LastRun job={job} />
                    </td>
                    <td className="py-3 text-right">
                      <JobActions
                        job={job}
                        compact
                        isRunning={runJobNow.isPending}
                        onRun={() => runJobNow.mutate(job.id)}
                        onEdit={() => setEditJob(job)}
                        onDelete={() => deleteJob.mutate(job.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <JobFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={createJob.isPending}
      />

      {/* Edit Dialog */}
      {editJob && (
        <JobFormDialog
          open={!!editJob}
          onOpenChange={(o) => { if (!o) setEditJob(null); }}
          initialData={{
            id: editJob.id,
            name: editJob.name,
            actionType: editJob.actionType,
            cronExpression: editJob.cronExpression,
            enabled: !!editJob.enabled,
            actionParams: editJob.actionParams,
          }}
          onSubmit={handleUpdate}
          isPending={updateJob.isPending}
        />
      )}
    </Card>
  );
}
