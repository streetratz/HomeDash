import { createElement, useState } from 'react';
import {
  COLLECTION_ICONS,
  collectionIconComponent,
  type CollectionIcon,
} from '../../lib/collectionIcons.js';
import { Button } from '../ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';

/**
 * Offline icon selector for custom calendar events. Renders the bundled
 * allowlist only; no external/CDN icon is ever requested. The picker collapses
 * to a single trigger showing the current icon, with an anchored palette that
 * does not reflow the event editor.
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
  const [open, setOpen] = useState(false);
  const label = name.trim() || 'this event';
  return (
    <div className="space-y-1 text-sm">
      <p>Icon</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 p-0"
            aria-label={`Change icon for ${label}`}
            disabled={disabled}
          >
            {createElement(collectionIconComponent(value), {
              'aria-hidden': true,
              className: 'h-5 w-5',
            })}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={`Icon for ${label}`}
          className="max-w-[calc(100vw-2rem)] p-3 motion-reduce:animate-none"
        >
          <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto">
            {COLLECTION_ICONS.map((icon) => {
              const Icon = collectionIconComponent(icon);
              const selected = icon === value;
              return (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={selected}
                  aria-label={icon}
                  title={icon}
                  disabled={disabled}
                  className={`flex h-11 w-11 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
