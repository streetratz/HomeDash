import { Label } from '../ui/label.js';

export function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1.5fr] sm:gap-3">
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div>{children}</div>
    </div>
  );
}
