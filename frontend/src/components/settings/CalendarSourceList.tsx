/**
 * 004 Phase 6 (T032): Calendar source list with sync/edit/delete actions.
 */

import { useState } from 'react';
import {
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  FileUp,
  CakeSlice,
  Clock3,
  Link2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Switch } from '../ui/switch.js';
import { ColorPicker } from '../ui/color-picker.js';
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
  useCalendarSources,
  useDeleteCalendarSource,
  useSyncCalendarSource,
  useUpdateCalendarSource,
  type CalendarSource,
} from '../../state/calendarHooks.js';
import { ICalSourceForm } from './ICalSourceForm.js';
import { ICalFileSourceForm } from './ICalFileSourceForm.js';
import { BirthdaySourceDialog } from './BirthdaySourceDialog.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

const TYPE_LABELS: Record<string, string> = {
  microsoft: 'Microsoft',
  google: 'Google',
  ical: 'iCal',
  ical_file: 'ICS File',
  birthday_local: 'Birthdays',
};

const TYPE_VARIANTS: Record<string, 'info' | 'purple' | 'secondary'> = {
  microsoft: 'info',
  google: 'purple',
  ical: 'secondary',
  ical_file: 'secondary',
  birthday_local: 'purple',
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getSourceDetail(source: CalendarSource): {
  label: string;
  value: string;
  icon: typeof Link2;
} {
  if (source.type === 'ical' && source.url) {
    return { label: 'Feed', value: source.url, icon: Link2 };
  }
  if (source.type === 'ical_file' && source.fileName) {
    return { label: 'File', value: source.fileName, icon: FileText };
  }
  if (source.type === 'birthday_local') {
    return { label: 'Storage', value: 'Editable local birthdays', icon: CakeSlice };
  }
  return { label: 'Account', value: 'Connected calendar account', icon: Link2 };
}

export function CalendarSourceList() {
  const sourcesQuery = useCalendarSources();
  const deleteMutation = useDeleteCalendarSource();
  const syncMutation = useSyncCalendarSource();
  const updateMutation = useUpdateCalendarSource();

  const [urlFormOpen, setUrlFormOpen] = useState(false);
  const [fileFormOpen, setFileFormOpen] = useState(false);
  const [birthdayFormOpen, setBirthdayFormOpen] = useState(false);
  const [editSource, setEditSource] = useState<CalendarSource | undefined>(undefined);

  const sources = sourcesQuery.data ?? [];

  if (sourcesQuery.isLoading) {
    return <SettingsLoadingState label="Loading calendar sources…" />;
  }

  if (sourcesQuery.isError) {
    return (
      <SettingsErrorState
        message="Calendar sources could not be loaded."
        onRetry={() => {
          void sourcesQuery.refetch();
        }}
      />
    );
  }

  function handleSync(id: string) {
    syncMutation.mutate(id, {
      onSuccess: () => toast.success('Sync started'),
      onError: (err) =>
        toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`),
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Source deleted'),
      onError: (err) =>
        toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`),
    });
  }

  function handleToggleEnabled(source: CalendarSource) {
    updateMutation.mutate(
      { id: source.id, enabled: !source.enabled },
      {
        onError: (err) =>
          toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`),
      },
    );
  }

  function handleColorChange(id: string, color: string) {
    updateMutation.mutate(
      { id, color },
      {
        onError: () => toast.error('Failed to update color'),
      },
    );
  }

  function openEdit(source: CalendarSource) {
    setEditSource(source);
    if (source.type === 'ical_file') {
      setFileFormOpen(true);
    } else if (source.type === 'birthday_local') {
      setBirthdayFormOpen(true);
    } else {
      setUrlFormOpen(true);
    }
  }

  function openAddUrl() {
    setEditSource(undefined);
    setUrlFormOpen(true);
  }

  function openAddFile() {
    setEditSource(undefined);
    setFileFormOpen(true);
  }

  function openAddBirthdays() {
    setEditSource(undefined);
    setBirthdayFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold">Calendar Sources</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={openAddUrl}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Calendar URL
          </Button>
          <Button variant="outline" size="sm" onClick={openAddFile}>
            <FileUp className="mr-1 h-3.5 w-3.5" />
            Import ICS File
          </Button>
          <Button variant="outline" size="sm" onClick={openAddBirthdays}>
            <CakeSlice className="mr-1 h-3.5 w-3.5" />
            Add Birthdays
          </Button>
        </div>
      </div>

      {sources.length === 0 && (
        <p className="text-sm text-muted-foreground">No calendar sources configured.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {sources.map((source) => {
          const detail = getSourceDetail(source);
          const DetailIcon = detail.icon;
          const editLabel =
            source.type === 'birthday_local' ? 'Manage' : 'Edit';
          const canEdit =
            source.type === 'ical' ||
            source.type === 'ical_file' ||
            source.type === 'birthday_local';

          return (
            <article
              key={source.id}
              aria-label={`${source.name} calendar source`}
              className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card/30 p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ColorPicker
                  value={source.color}
                  onChange={(color) => handleColorChange(source.id, color)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h4 className="min-w-0 truncate text-sm font-semibold">{source.name}</h4>
                    <Badge
                      variant={TYPE_VARIANTS[source.type] ?? 'secondary'}
                      className="text-[10px]"
                    >
                      {TYPE_LABELS[source.type] ?? source.type}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Synced {formatSyncTime(source.lastSyncAt)}</span>
                    {source.lastSyncError && (
                      <span className="font-medium text-destructive" title={source.lastSyncError}>
                        · Error
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {source.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={() => handleToggleEnabled(source)}
                    disabled={updateMutation.isPending}
                    aria-label={`${source.enabled ? 'Disable' : 'Enable'} ${source.name}`}
                  />
                </div>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                <DetailIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="shrink-0 font-medium text-foreground/70">{detail.label}</span>
                <span className="truncate" title={detail.value}>
                  {detail.value}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 sm:flex sm:items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-10 justify-center sm:min-h-9"
                  onClick={() => handleSync(source.id)}
                  disabled={syncMutation.isPending}
                  aria-label={`Sync ${source.name}`}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Sync
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10 justify-center sm:min-h-9"
                    onClick={() => openEdit(source)}
                    aria-label={`${editLabel} ${source.name}`}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {editLabel}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${canEdit ? 'col-span-2' : ''} min-h-10 text-destructive hover:text-destructive sm:col-span-1 sm:ml-auto sm:min-h-9`}
                      aria-label={`Delete ${source.name}`}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Calendar Source</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove &ldquo;{source.name}&rdquo; and all cached events. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(source.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </article>
          );
        })}
      </div>

      <ICalSourceForm
        open={urlFormOpen}
        onOpenChange={setUrlFormOpen}
        editSource={editSource?.type === 'ical' ? editSource : undefined}
      />
      <ICalFileSourceForm
        open={fileFormOpen}
        onOpenChange={setFileFormOpen}
        editSource={editSource?.type === 'ical_file' ? editSource : undefined}
      />
      <BirthdaySourceDialog
        open={birthdayFormOpen}
        onOpenChange={setBirthdayFormOpen}
        source={editSource?.type === 'birthday_local' ? editSource : undefined}
      />
    </div>
  );
}
