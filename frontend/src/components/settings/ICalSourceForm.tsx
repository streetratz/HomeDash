/**
 * 004 Phase 6 (T031): iCal source add/edit dialog form.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { ColorPicker } from '../ui/color-picker.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog.js';
import {
  useCreateCalendarSource,
  useUpdateCalendarSource,
  type CalendarSource,
} from '../../state/calendarHooks.js';

interface ICalSourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, form is in edit mode */
  editSource?: CalendarSource | undefined;
}

const SYNC_INTERVALS = [
  { label: '5 minutes', value: '300' },
  { label: '15 minutes', value: '900' },
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
];

function ICalSourceFormFields({
  editSource,
  onClose,
}: {
  editSource?: CalendarSource | undefined;
  onClose: () => void;
}) {
  const createMutation = useCreateCalendarSource();
  const updateMutation = useUpdateCalendarSource();

  const [url, setUrl] = useState(editSource?.url ?? '');
  const [name, setName] = useState(editSource?.name ?? '');
  const [color, setColor] = useState(editSource?.color ?? '#3b82f6');
  const [syncInterval, setSyncInterval] = useState(
    editSource ? String(editSource.syncIntervalSeconds) : '900',
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();

    if (!trimmedUrl || !trimmedName) {
      toast.error('URL and Name are required');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    if (editSource) {
      updateMutation.mutate(
        {
          id: editSource.id,
          name: trimmedName,
          url: trimmedUrl,
          color,
          syncIntervalSeconds: Number(syncInterval),
        },
        {
          onSuccess: () => {
            toast.success('Calendar source updated');
            onClose();
          },
          onError: (err) =>
            toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`),
        },
      );
    } else {
      createMutation.mutate(
        {
          type: 'ical',
          name: trimmedName,
          url: trimmedUrl,
          color,
          syncIntervalSeconds: Number(syncInterval),
        },
        {
          onSuccess: () => {
            toast.success('Calendar source added');
            onClose();
          },
          onError: (err) =>
            toast.error(`Failed to add: ${err instanceof Error ? err.message : 'Unknown error'}`),
        },
      );
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <Label>URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/calendar.ics"
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Calendar"
            maxLength={100}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <div className="flex items-center gap-2">
            <ColorPicker value={color} onChange={setColor} disabled={isPending} />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Sync Interval</Label>
          <Select value={syncInterval} onValueChange={setSyncInterval} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNC_INTERVALS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {editSource ? 'Save Changes' : 'Add Calendar'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ICalSourceForm({ open, onOpenChange, editSource }: ICalSourceFormProps) {
  // Use key to force fresh state when dialog opens or editSource changes
  const formKey = `${open}-${editSource?.id ?? 'new'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editSource ? 'Edit iCal Source' : 'Add iCal Calendar'}</DialogTitle>
          <DialogDescription>
            {editSource ? 'Update the iCal calendar source settings.' : 'Add an iCal calendar URL to sync events.'}
          </DialogDescription>
        </DialogHeader>
        <ICalSourceFormFields
          key={formKey}
          editSource={editSource}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
