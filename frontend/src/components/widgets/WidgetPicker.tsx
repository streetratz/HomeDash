import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { widgetRegistry, type WidgetCategory, type WidgetTypeDefinition } from './registry.js';

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: string, defaultConfig: Record<string, unknown>) => void;
}

const CATEGORY_ORDER: WidgetCategory[] = ['essentials', 'content', 'media', 'monitoring'];

export const WIDGET_CATEGORY_META: Record<WidgetCategory, { label: string; description: string }> =
  {
    essentials: {
      label: 'Essentials',
      description: 'Everyday information and planning',
    },
    content: {
      label: 'Links & Content',
      description: 'Shortcuts, notes, and embedded content',
    },
    media: {
      label: 'Media',
      description: 'Music and photo experiences',
    },
    monitoring: {
      label: 'Monitoring',
      description: 'Home-lab services, networks, and data',
    },
  };

export interface WidgetPickerSection {
  category: WidgetCategory;
  widgets: WidgetTypeDefinition[];
}

export function buildWidgetPickerSections(
  definitions: WidgetTypeDefinition[],
  query: string,
): WidgetPickerSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return CATEGORY_ORDER.map((category) => ({
    category,
    widgets: definitions
      .filter((definition) => {
        if (definition.category !== category) return false;
        if (!normalizedQuery) return true;
        return [
          definition.displayName,
          definition.description,
          WIDGET_CATEGORY_META[category].label,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
  })).filter((section) => section.widgets.length > 0);
}

export function WidgetPicker({ open, onOpenChange, onSelect }: WidgetPickerProps) {
  const [query, setQuery] = useState('');
  const sections = useMemo(
    () => buildWidgetPickerSections([...widgetRegistry.values()], query),
    [query],
  );
  const resultCount = sections.reduce((total, section) => total + section.widgets.length, 0);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setQuery('');
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]">
        <div className="border-b border-border/70 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget for this space. You can configure it after adding it.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search widgets"
              aria-label="Search widgets"
              className="h-11 bg-muted/40 pl-10 pr-24"
            />
            <span
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {resultCount} {resultCount === 1 ? 'widget' : 'widgets'}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {sections.length > 0 ? (
            <div className="space-y-7">
              {sections.map((section) => {
                const category = WIDGET_CATEGORY_META[section.category];
                return (
                  <section
                    key={section.category}
                    aria-labelledby={`widget-category-${section.category}`}
                  >
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <h3
                          id={`widget-category-${section.category}`}
                          className="text-sm font-semibold text-foreground"
                        >
                          {category.label}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {section.widgets.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {section.widgets.map((definition) => {
                        const Icon = definition.icon;
                        return (
                          <button
                            key={definition.type}
                            type="button"
                            className="group flex min-h-24 items-start gap-4 rounded-xl border border-border/70 bg-card/40 p-4 text-left transition-[border-color,background-color,transform] duration-150 hover:border-primary/50 hover:bg-accent/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            onClick={() => {
                              onSelect(definition.type, definition.defaultConfig);
                              handleOpenChange(false);
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary/15">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <div className="font-medium leading-5 text-foreground">
                                {definition.displayName}
                              </div>
                              <div className="mt-1 text-sm leading-5 text-muted-foreground">
                                {definition.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
              <Search className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No widgets found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different name, description, or category.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
