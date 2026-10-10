import { createElement, useId, useState } from 'react';
import {
  COLLECTION_ICONS,
  collectionIconComponent,
  type CollectionIcon,
} from '../../lib/collectionIcons.js';
import { Button } from '../ui/button.js';

/**
 * Offline icon selector for custom calendar events. Renders the bundled
 * allowlist only; no external/CDN icon is ever requested. The picker collapses
 * to a single trigger showing the current icon and expands to a compact grid so
 * one event editor stays readable on small screens.
 */
export function CollectionIconPicker({
  value,
  name,
  disabled = false,
  onChange,
}: {
  value: string;
  name: string;
  disabled?: boolean;
  onChange: (icon: CollectionIcon) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const label = name.trim() || 'this event';
  return (
    <div className="space-y-1 text-sm">
      <p id={`${id}-label`}>Icon</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-11 p-0"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        aria-label={`Change icon for ${label}`}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        {createElement(collectionIconComponent(value), {
          'aria-hidden': true,
          className: 'h-5 w-5',
        })}
      </Button>
      {open && (
        <div
          role="listbox"
          aria-label={`Icon for ${label}`}
          className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto rounded-md border border-border bg-background p-2 sm:grid-cols-9"
        >
          {COLLECTION_ICONS.map((icon) => {
            const Icon = collectionIconComponent(icon);
            const selected = icon === value;
            return (
              <button
                key={icon}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={icon}
                title={icon}
                disabled={disabled}
                className={`flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-transparent'
                }`}
                onClick={() => {
                  onChange(icon);
                  setOpen(false);
                }}
              >
                <Icon aria-hidden className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
