/**
 * Unified Settings navigation: a grouped, non-collapsing rail on desktop and a
 * slide-in drawer on mobile, both driven by {@link SETTINGS_GROUPS}. The caller
 * owns the active leaf id and URL; this component only renders and reports
 * selection.
 */

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet.js';
import { getLeaf, getVisibleGroups, type SettingsGroup } from './settingsNavConfig.js';

interface SettingsNavProps {
  activeLeafId: string;
  isAdmin: boolean;
  onSelect: (leafId: string) => void;
}

function NavList({
  groups,
  activeLeafId,
  onSelect,
}: {
  groups: SettingsGroup[];
  activeLeafId: string;
  onSelect: (leafId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.leaves.map((leaf) => {
            const Icon = leaf.icon;
            const isActive = leaf.id === activeLeafId;
            return (
              <button
                type="button"
                key={leaf.id}
                onClick={() => onSelect(leaf.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{leaf.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SettingsNav({ activeLeafId, isAdmin, onSelect }: SettingsNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = getVisibleGroups(isAdmin);
  const activeLabel = getLeaf(activeLeafId)?.label ?? 'Settings';

  function handleSelect(leafId: string) {
    setDrawerOpen(false);
    onSelect(leafId);
  }

  return (
    <>
      {/* Mobile: drawer trigger */}
      <div className="lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-start gap-2">
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="text-muted-foreground">Section:</span>
              <span className="font-medium">{activeLabel}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto p-6">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <nav aria-label="Settings sections">
              <NavList groups={groups} activeLeafId={activeLeafId} onSelect={handleSelect} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: persistent rail */}
      <nav
        className="hidden lg:block lg:w-56 lg:shrink-0 lg:border-r lg:border-border lg:pr-4"
        aria-label="Settings sections"
      >
        <NavList groups={groups} activeLeafId={activeLeafId} onSelect={handleSelect} />
      </nav>
    </>
  );
}
