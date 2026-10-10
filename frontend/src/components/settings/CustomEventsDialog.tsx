import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { CollectionManager } from './CollectionManager.js';

/**
 * Admin-only dialog that hosts the custom events manager, launched from the
 * Calendar Sources controls beside "Add Birthdays". Non-admins never mount this
 * because the launching button is gated on `isAdmin`.
 */
export function CustomEventsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom events</DialogTitle>
          <DialogDescription>
            Local one-off and recurring events — bin days, chores, reminders — shown in your
            Calendar widgets.
          </DialogDescription>
        </DialogHeader>
        <CollectionManager />
      </DialogContent>
    </Dialog>
  );
}
