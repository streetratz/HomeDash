import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#64748b', '#ffffff',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value);

  function handleOpenChange(open: boolean) {
    if (open) {
      setCustomColor(value);
    }
  }

  function handlePreset(color: string) {
    onChange(color);
    setCustomColor(color);
  }

  function handleCustomChange(hex: string) {
    setCustomColor(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:border-primary/50 disabled:opacity-50"
          style={{ backgroundColor: value }}
          title="Change color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-6 w-6 rounded-md border transition-[border-color,box-shadow] duration-150 ease-out ${
                  value === color
                    ? 'border-primary ring-2 ring-primary/30 scale-110'
                    : 'border-border/50 hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handlePreset(color)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customColor}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="#3b82f6"
              maxLength={7}
              className="h-7 w-[5.5rem] rounded border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="color"
              value={value}
              onChange={(e) => handlePreset(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
