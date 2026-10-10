/**
 * Unified Settings navigation, driven by {@link SETTINGS_GROUPS}. Desktop renders
 * a grouped left rail ({@link SettingsNav}) that collapses in place to an
 * icon-only rail, toggled by {@link SettingsRailToggle} in the page header (the
 * same far-left slot the mobile hamburger uses, so the affordance never moves);
 * mobile renders a hamburger that opens the same list in a slide-in drawer
 * ({@link SettingsNavTrigger}) inline with the page title. The caller owns the
 * active leaf id, URL, and collapsed state; these components only render and
 * report selection.
 */

import { useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet.js';
import { getVisibleGroups, type SettingsGroup } from './settingsNavConfig.js';

interface SettingsNavProps {
  activeLeafId: string;
  isAdmin: boolean;
  onSelect: (leafId: string) => void;
}

function NavList({
  groups,
  activeLeafId,
  onSelect,
  collapsed = false,
}: {
  groups: SettingsGroup[];
  activeLeafId: string;
  onSelect: (leafId: string) => void;
  collapsed?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {collapsed ? (
            groupIndex > 0 && (
              <div className="mx-auto mb-2 h-px w-6 bg-border/60" aria-hidden="true" />
            )
          ) : (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {group.leaves.map((leaf) => {
            const Icon = leaf.icon;
            const isActive = leaf.id === activeLeafId;
            return (
              <button
                type="button"
                key={leaf.id}
                onClick={() => onSelect(leaf.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={collapsed ? leaf.label : undefined}
                title={collapsed ? leaf.label : undefined}
                className={`flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{leaf.label}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SettingsNavTrigger({ activeLeafId, isAdmin, onSelect }: SettingsNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = getVisibleGroups(isAdmin);

  function handleSelect(leafId: string) {
    setDrawerOpen(false);
    onSelect(leafId);
  }

  return (
    <div className="lg:hidden">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Open settings navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
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
  );
}

export function SettingsNav({
  activeLeafId,
  isAdmin,
  onSelect,
  collapsed = false,
}: SettingsNavProps & { collapsed?: boolean }) {
  const groups = getVisibleGroups(isAdmin);

  return (
    <nav
      className={`hidden lg:block lg:shrink-0 lg:border-r lg:border-border ${
        collapsed ? 'lg:w-14 lg:pr-2' : 'lg:w-56 lg:pr-4'
      }`}
      aria-label="Settings sections"
    >
      <NavList
        groups={groups}
        activeLeafId={activeLeafId}
        onSelect={onSelect}
        collapsed={collapsed}
      />
    </nav>
  );
}

/**
 * Desktop-only control that collapses / expands {@link SettingsNav} in place.
 * It lives in the page header — the same far-left slot the mobile hamburger
 * occupies — so the collapse affordance has one stable location.
 */
export function SettingsRailToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand settings menu' : 'Collapse settings menu'}
      className="hidden h-11 w-11 shrink-0 lg:inline-flex"
    >
      {collapsed ? (
        <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
      ) : (
        <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  );
}
