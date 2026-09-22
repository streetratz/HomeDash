import { AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { Button } from '../ui/button.js';

export function SettingsLoadingState({ label = 'Loading settings…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function SettingsErrorState({
  message = 'Settings could not be loaded.',
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      role="alert"
    >
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
