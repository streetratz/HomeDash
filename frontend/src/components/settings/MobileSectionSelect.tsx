import { useId } from 'react';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';

interface MobileSectionOption<T extends string> {
  value: T;
  label: string;
}

interface MobileSectionSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly MobileSectionOption<T>[];
  onValueChange: (value: T) => void;
  breakpoint?: 'sm' | 'md' | 'lg';
}

export function MobileSectionSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  breakpoint = 'md',
}: MobileSectionSelectProps<T>) {
  const triggerId = useId();
  const hiddenClass =
    breakpoint === 'sm' ? 'sm:hidden' : breakpoint === 'lg' ? 'lg:hidden' : 'md:hidden';

  return (
    <div className={`space-y-1.5 ${hiddenClass}`}>
      <Label htmlFor={triggerId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          const selected = options.find((option) => option.value === nextValue);
          if (selected) onValueChange(selected.value);
        }}
      >
        <SelectTrigger id={triggerId} className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
