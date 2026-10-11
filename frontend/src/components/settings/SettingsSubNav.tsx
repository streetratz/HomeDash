/**
 * Reusable second-level ("leaf") navigation for switching sub-sections inside a
 * settings leaf. It is responsive by design and keeps the same grouped
 * information architecture on both breakpoints:
 *
 *   - Desktop (md+): a vertical grouped rail. Category captions stack as section
 *     labels so every sub-section stays scannable without horizontal scrolling.
 *   - Mobile (< md): a grouped disclosure. A full-width trigger shows the active
 *     trail ("Media · Sonos") so you always know where you are; tapping it
 *     reveals the full grouped list so grouping is visible without hunting.
 *
 * The caller owns the active id and reports selection; this component only
 * renders. Shared by Integrations today and reserved for Widgets (#20).
 *
 * Layout note: place this before the content panel inside a
 * `flex flex-col md:flex-row` container so the disclosure stacks above content
 * on mobile and the rail sits beside content on desktop.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SettingsSubNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SettingsSubNavGroup {
  /** Optional category caption; omit for an ungrouped nav. */
  label?: string;
  items: SettingsSubNavItem[];
}

interface SettingsSubNavProps {
  groups: SettingsSubNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Accessible name for the nav landmark, e.g. "Integration sections". */
  ariaLabel: string;
}

const itemClasses = (isActive: boolean) =>
  `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  }`;

function GroupedList({
  groups,
  activeId,
  onSelect,
}: {
  groups: SettingsSubNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? `group-${groupIndex}`} className="flex shrink-0 flex-col gap-0.5">
          {group.label && (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full ${itemClasses(isActive)}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SettingsSubNav({ groups, activeId, onSelect, ariaLabel }: SettingsSubNavProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  const activeItem = groups.flatMap((group) => group.items).find((item) => item.id === activeId);
  const activeGroupLabel = groups.find((group) =>
    group.items.some((item) => item.id === activeId),
  )?.label;

  return (
    <>
      {/* Mobile: grouped disclosure — active trail always visible, full grouped list on expand */}
      <nav aria-label={ariaLabel} className="md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
        >
          <span className="flex min-w-0 items-center gap-2">
            {activeItem?.icon}
            {activeGroupLabel && (
              <>
                <span className="shrink-0 text-muted-foreground">{activeGroupLabel}</span>
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ·
                </span>
              </>
            )}
            <span className="truncate">{activeItem?.label}</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div id={listId} className="mt-1 rounded-md border border-border p-2">
            <GroupedList
              groups={groups}
              activeId={activeId}
              onSelect={(id) => {
                setOpen(false);
                onSelect(id);
              }}
            />
          </div>
        )}
      </nav>

      {/* Desktop: vertical grouped rail */}
      <nav
        aria-label={ariaLabel}
        className="hidden shrink-0 md:block md:w-44 md:border-r md:border-border md:pr-4"
      >
        <GroupedList groups={groups} activeId={activeId} onSelect={onSelect} />
      </nav>
    </>
  );
}
