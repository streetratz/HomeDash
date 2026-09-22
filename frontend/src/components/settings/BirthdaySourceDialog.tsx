import { useRef, useState } from 'react';
import { Download, FileUp, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBirthdays,
  useCreateBirthday,
  useCreateBirthdaySource,
  useDeleteBirthday,
  useExportBirthdays,
  useImportBirthdayCsv,
  usePreviewBirthdayCsv,
  useUpdateBirthday,
  useUpdateCalendarSource,
  type BirthdayInput,
  type BirthdayRecord,
  type CalendarSource,
} from '../../state/calendarHooks.js';
import { Button } from '../ui/button.js';
import { ColorPicker } from '../ui/color-picker.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';
import { Textarea } from '../ui/textarea.js';
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

const MAX_CSV_BYTES = 1024 * 1024;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface BirthdaySourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: CalendarSource | undefined;
}

const emptyBirthday: BirthdayInput = {
  firstName: '',
  lastName: null,
  month: 1,
  day: 1,
  birthYear: null,
  notes: null,
};

function downloadText(fileName: string, mimeType: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function BirthdayEditor({
  source,
  onSourceUpdated,
  onClose,
}: {
  source: CalendarSource;
  onSourceUpdated: (source: CalendarSource) => void;
  onClose: () => void;
}) {
  const birthdaysQuery = useBirthdays(source.id);
  const createMutation = useCreateBirthday();
  const updateMutation = useUpdateBirthday();
  const deleteMutation = useDeleteBirthday();
  const previewMutation = usePreviewBirthdayCsv();
  const importMutation = useImportBirthdayCsv();
  const exportMutation = useExportBirthdays();
  const sourceMutation = useUpdateCalendarSource();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceName, setSourceName] = useState(source.name);
  const [draft, setDraft] = useState<BirthdayInput>(emptyBirthday);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<{ name: string; content: string } | null>(null);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const birthdays = birthdaysQuery.data ?? [];
  const trimmedSourceName = sourceName.trim();
  const sourceNameChanged = trimmedSourceName !== source.name;

  function saveSourceName() {
    if (!trimmedSourceName) {
      toast.error('Calendar title is required');
      return;
    }

    sourceMutation.mutate(
      { id: source.id, name: trimmedSourceName },
      {
        onSuccess: (updatedSource) => {
          onSourceUpdated(updatedSource);
          setSourceName(updatedSource.name);
          toast.success('Calendar title updated');
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Could not update calendar title'),
      },
    );
  }

  function resetDraft() {
    setDraft(emptyBirthday);
    setEditingId(null);
  }

  function editBirthday(record: BirthdayRecord) {
    setDraft({
      firstName: record.firstName,
      lastName: record.lastName,
      month: record.month,
      day: record.day,
      birthYear: record.birthYear,
      notes: record.notes,
    });
    setEditingId(record.id);
  }

  function saveBirthday() {
    const firstName = draft.firstName.trim();
    if (!firstName) {
      toast.error('First name is required');
      return;
    }

    const input = {
      sourceId: source.id,
      firstName,
      lastName: draft.lastName?.trim() || null,
      month: Number(draft.month),
      day: Number(draft.day),
      birthYear: draft.birthYear ? Number(draft.birthYear) : null,
      notes: draft.notes?.trim() || null,
    };
    const options = {
      onSuccess: () => {
        toast.success(editingId ? 'Birthday updated' : 'Birthday added');
        resetDraft();
      },
      onError: (error: Error) =>
        toast.error(error instanceof Error ? error.message : 'Could not save birthday'),
    };

    if (editingId) {
      updateMutation.mutate({ ...input, birthdayId: editingId }, options);
    } else {
      createMutation.mutate(input, options);
    }
  }

  async function chooseCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      toast.error('Birthday CSV files must be 1 MiB or smaller');
      return;
    }

    try {
      const content = await file.text();
      setCsvFile({ name: file.name, content });
      previewMutation.mutate(content);
    } catch {
      toast.error('The selected CSV could not be read');
    }
  }

  function importCsv(mode: 'append' | 'replace') {
    if (!csvFile || !previewMutation.data || previewMutation.data.errors.length > 0) return;
    importMutation.mutate(
      { sourceId: source.id, csvContent: csvFile.content, mode },
      {
        onSuccess: ({ imported, skipped }) => {
          toast.success(
            `${imported} birthday${imported === 1 ? '' : 's'} imported${
              skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''
            }`,
          );
          setCsvFile(null);
          previewMutation.reset();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Birthday import failed'),
      },
    );
  }

  function exportBirthdays(format: 'csv' | 'ics') {
    exportMutation.mutate(
      { sourceId: source.id, format },
      {
        onSuccess: (file) => downloadText(file.fileName, file.mimeType, file.content),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Birthday export failed'),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Manage birthdays</DialogTitle>
        <DialogDescription>
          Update this calendar and manage date-only birthday records.
        </DialogDescription>
      </DialogHeader>

      <section
        className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        aria-label="Calendar settings"
      >
        <div className="space-y-1.5">
          <Label htmlFor="birthday-calendar-title">Calendar title</Label>
          <Input
            id="birthday-calendar-title"
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            maxLength={100}
            disabled={sourceMutation.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Used in calendar filters and birthday exports.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-10"
          onClick={saveSourceName}
          disabled={sourceMutation.isPending || !trimmedSourceName || !sourceNameChanged}
        >
          <Save className="mr-2 h-4 w-4" />
          {sourceMutation.isPending ? 'Saving…' : 'Save title'}
        </Button>
      </section>

      <Tabs defaultValue="birthdays" className="min-h-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="birthdays">Birthdays</TabsTrigger>
          <TabsTrigger value="transfer">Import &amp; Export</TabsTrigger>
        </TabsList>

        <TabsContent value="birthdays" className="mt-4 space-y-5">
          <section className="space-y-3" aria-labelledby="birthday-editor-heading">
            <div>
              <h3 id="birthday-editor-heading" className="text-sm font-semibold">
                {editingId ? 'Edit birthday' : 'Add birthday'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Month and day are stored without timezone conversion.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-8">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="birthday-first-name">First name</Label>
                <Input
                  id="birthday-first-name"
                  value={draft.firstName}
                  onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
                  maxLength={100}
                  placeholder="Alex"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="birthday-last-name">Last name</Label>
                <Input
                  id="birthday-last-name"
                  value={draft.lastName ?? ''}
                  onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
                  maxLength={100}
                  placeholder="Optional"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthday-month">Month</Label>
                <Select
                  value={String(draft.month)}
                  onValueChange={(value) => setDraft({ ...draft, month: Number(value) })}
                  disabled={isSaving}
                >
                  <SelectTrigger id="birthday-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={String(index + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthday-day">Day</Label>
                <Input
                  id="birthday-day"
                  type="number"
                  min={1}
                  max={31}
                  value={draft.day}
                  onChange={(event) => setDraft({ ...draft, day: Number(event.target.value) })}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="birthday-year">Year</Label>
                <Input
                  id="birthday-year"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear()}
                  value={draft.birthYear ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      birthYear: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday-notes">Notes</Label>
              <Textarea
                id="birthday-notes"
                value={draft.notes ?? ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                maxLength={500}
                rows={2}
                placeholder="Optional"
                disabled={isSaving}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {editingId && (
                <Button variant="outline" onClick={resetDraft} disabled={isSaving}>
                  Cancel edit
                </Button>
              )}
              <Button onClick={saveBirthday} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                {editingId ? 'Save changes' : 'Add birthday'}
              </Button>
            </div>
          </section>

          <section className="space-y-2 border-t border-border/60 pt-4" aria-label="Birthdays">
            {birthdaysQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading birthdays…</p>
            )}
            {birthdaysQuery.isError && (
              <p className="text-sm text-destructive">Birthdays could not be loaded.</p>
            )}
            {!birthdaysQuery.isLoading && birthdays.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-5 text-center">
                <p className="text-sm font-medium">No birthdays yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add one above or import a CSV in the next tab.
                </p>
              </div>
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {birthdays.map((birthday) => (
                <div
                  key={birthday.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <div className="w-14 shrink-0 text-sm font-semibold tabular-nums">
                    {birthday.month}/{birthday.day}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {[birthday.firstName, birthday.lastName].filter(Boolean).join(' ')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[birthday.birthYear, birthday.notes].filter(Boolean).join(' · ') ||
                        'No year or notes'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => editBirthday(birthday)}
                    aria-label={`Edit ${[birthday.firstName, birthday.lastName]
                      .filter(Boolean)
                      .join(' ')}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive hover:text-destructive"
                        aria-label={`Delete ${[birthday.firstName, birthday.lastName]
                          .filter(Boolean)
                          .join(' ')}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete {[birthday.firstName, birthday.lastName].filter(Boolean).join(' ')}
                          ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This birthday will also be removed from the calendar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            deleteMutation.mutate(
                              { sourceId: source.id, birthdayId: birthday.id },
                              {
                                onSuccess: () => toast.success('Birthday removed'),
                                onError: (error) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : 'Could not remove birthday',
                                  ),
                              },
                            )
                          }
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="transfer" className="mt-4 space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Import CSV</h3>
              <p className="text-xs text-muted-foreground">
                Required header: first_name,last_name,month,day,birth_year,notes. Last name, birth
                year, and notes may be blank.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void chooseCsv(event)}
            />
            <Button
              variant="outline"
              className="min-h-11 w-full justify-start"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewMutation.isPending || importMutation.isPending}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {csvFile?.name ?? 'Choose CSV file'}
            </Button>
            {previewMutation.data && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  previewMutation.data.errors.length > 0
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border bg-muted/30'
                }`}
              >
                <p className="font-medium">
                  {previewMutation.data.validCount} valid · {previewMutation.data.invalidCount}{' '}
                  invalid
                </p>
                {previewMutation.data.errors.slice(0, 5).map((error) => (
                  <p key={`${error.rowNumber}-${error.message}`} className="mt-1 text-xs">
                    Row {error.rowNumber}: {error.message}
                  </p>
                ))}
                {previewMutation.data.rows.length > 0 && (
                  <div className="mt-3 max-h-36 divide-y divide-border/60 overflow-y-auto border-t border-border/60">
                    {previewMutation.data.rows.slice(0, 10).map((row) => (
                      <div
                        key={`${row.rowNumber}-${row.firstName}-${row.lastName ?? ''}`}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {[row.firstName, row.lastName].filter(Boolean).join(' ')}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {MONTHS[row.month - 1]} {row.day}
                          {row.birthYear ? `, ${row.birthYear}` : ''}
                        </span>
                      </div>
                    ))}
                    {previewMutation.data.rows.length > 10 && (
                      <p className="pt-2 text-xs text-muted-foreground">
                        +{previewMutation.data.rows.length - 10} more valid rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={
                      importMutation.isPending ||
                      !previewMutation.data ||
                      previewMutation.data.errors.length > 0
                    }
                  >
                    Replace all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Replace every birthday?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Existing birthdays in {source.name} will be removed and replaced by the valid
                      rows in this CSV.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => importCsv('replace')}>
                      Replace all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                onClick={() => importCsv('append')}
                disabled={
                  importMutation.isPending ||
                  !previewMutation.data ||
                  previewMutation.data.errors.length > 0
                }
              >
                Append rows
              </Button>
            </div>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-5">
            <div>
              <h3 className="text-sm font-semibold">Export</h3>
              <p className="text-xs text-muted-foreground">
                CSV can be edited and re-imported. ICS works with standard calendar apps.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => exportBirthdays('csv')}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportBirthdays('ics')}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Export ICS
              </Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

function BirthdaySourceSetup({
  onCreated,
  onClose,
}: {
  onCreated: (source: CalendarSource) => void;
  onClose: () => void;
}) {
  const createMutation = useCreateBirthdaySource();
  const [name, setName] = useState('Family Birthdays');
  const [color, setColor] = useState('#ec4899');

  function createSource() {
    createMutation.mutate(
      { name: name.trim(), color },
      {
        onSuccess: onCreated,
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Could not create birthday source'),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Local Birthdays</DialogTitle>
        <DialogDescription>
          Keep birthdays in HomeDash as editable date-only records, without an online calendar.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="birthday-source-name">Calendar name</Label>
          <Input
            id="birthday-source-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            disabled={createMutation.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Calendar color</Label>
          <div className="flex items-center gap-2">
            <ColorPicker value={color} onChange={setColor} disabled={createMutation.isPending} />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={createSource}
          disabled={createMutation.isPending || name.trim().length === 0}
        >
          Create birthday calendar
        </Button>
      </DialogFooter>
    </>
  );
}

function BirthdaySourceDialogContent({
  initialSource,
  onClose,
}: {
  initialSource?: CalendarSource | undefined;
  onClose: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  return source ? (
    <BirthdayEditor source={source} onSourceUpdated={setSource} onClose={onClose} />
  ) : (
    <BirthdaySourceSetup onCreated={setSource} onClose={onClose} />
  );
}

export function BirthdaySourceDialog({ open, onOpenChange, source }: BirthdaySourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <BirthdaySourceDialogContent
          key={`${open}-${source?.id ?? 'new'}`}
          initialSource={source}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
