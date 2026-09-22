import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  useImportCalendarFile,
  useUpdateCalendarSource,
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

const MAX_ICS_FILE_BYTES = 5 * 1024 * 1024;

interface ICalFileSourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSource?: CalendarSource | undefined;
}

function ICalFileSourceFormFields({
  editSource,
  onClose,
}: {
  editSource?: CalendarSource | undefined;
  onClose: () => void;
}) {
  const importMutation = useImportCalendarFile();
  const updateMutation = useUpdateCalendarSource();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(editSource?.name ?? '');
  const [color, setColor] = useState(editSource?.color ?? '#3b82f6');
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const isPending = importMutation.isPending || updateMutation.isPending;

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;

    if (selected.size > MAX_ICS_FILE_BYTES) {
      toast.error('ICS files must be 5 MiB or smaller');
      return;
    }

    try {
      const content = await selected.text();
      if (!content.includes('BEGIN:VCALENDAR')) {
        toast.error('This file does not contain a valid iCalendar');
        return;
      }

      setFile({ name: selected.name, content });
      if (!name.trim()) setName(selected.name.replace(/\.ics$/i, ''));
    } catch {
      toast.error('The selected file could not be read');
    }
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }
    if (!file && !editSource) {
      toast.error('Choose an ICS file');
      return;
    }

    if (editSource && !file) {
      updateMutation.mutate(
        { id: editSource.id, name: trimmedName, color },
        {
          onSuccess: () => {
            toast.success('Calendar details updated');
            onClose();
          },
          onError: (error) =>
            toast.error(
              `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ),
        },
      );
      return;
    }

    if (!file) return;

    importMutation.mutate(
      {
        ...(editSource ? { id: editSource.id } : {}),
        name: trimmedName,
        color,
        fileName: file.name,
        icsContent: file.content,
      },
      {
        onSuccess: () => {
          toast.success(editSource ? 'Calendar file re-imported' : 'Calendar file imported');
          onClose();
        },
        onError: (error) =>
          toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`),
      },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ical-file-name">Name</Label>
          <Input
            id="ical-file-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Family Birthdays"
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

        <div className="flex flex-col gap-2">
          <Label>ICS file</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={(event) => void handleFileSelect(event)}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-start"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <FileUp className="mr-2 h-4 w-4" />
            {file?.name ??
              (editSource?.fileName ? `Replace ${editSource.fileName}` : 'Choose ICS file')}
          </Button>
          <p className="text-xs text-muted-foreground">
            Up to 5 MiB. Leave the file unchanged to update only the title or color.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending || (!editSource && !file)}>
          {editSource ? (file ? 'Re-import File' : 'Save Changes') : 'Import Calendar'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ICalFileSourceForm({ open, onOpenChange, editSource }: ICalFileSourceFormProps) {
  const formKey = `${open}-${editSource?.id ?? 'new'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editSource ? 'Edit iCalendar File' : 'Import iCalendar File'}
          </DialogTitle>
          <DialogDescription>
            {editSource
              ? 'Update its display details or choose a replacement ICS file.'
              : 'Upload a static ICS file for birthdays or another calendar that has no publishable URL.'}
          </DialogDescription>
        </DialogHeader>
        <ICalFileSourceFormFields
          key={formKey}
          editSource={editSource}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
