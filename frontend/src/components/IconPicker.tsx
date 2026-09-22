/**
 * Searchable icon picker with two sources:
 *   1. Dashboard Icons — 2800+ colored app/service icons via walkxcode/dashboard-icons CDN
 *   2. Generic Icons — Lucide monochrome SVG icons
 *
 * Dashboard icon keys are stored as "cdn:<name>" (e.g. "cdn:sonarr").
 * Lucide icon keys are stored as plain names (e.g. "Globe") for backward compat.
 */

import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { icons, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.js';
import { Input } from './ui/input.js';
import { Button } from './ui/button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.js';

// ── Constants ────────────────────────────────────────────────────────────────

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main';
const TREE_URL = `${CDN_BASE}/tree.json`;
const INITIAL_LIMIT = 120;

/** Resolve a stored icon key to a CDN image URL. */
export function cdnIconUrl(cdnName: string): string {
  return `${CDN_BASE}/png/${cdnName}.png`;
}

/** Check if an icon key is a CDN dashboard icon. */
export function isCdnIcon(iconKey: string | null): boolean {
  return !!iconKey?.startsWith('cdn:');
}

/** Extract the CDN name from a stored icon key. */
export function parseCdnIcon(iconKey: string): string {
  return iconKey.slice(4); // strip "cdn:"
}

// ── Dashboard icon list (fetched once, cached in module scope) ────────────────

let cachedIconNames: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

function fetchDashboardIcons(): Promise<string[]> {
  if (cachedIconNames) return Promise.resolve(cachedIconNames);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch(TREE_URL)
    .then((r) => r.json())
    .then((data: { png?: string[] }) => {
      const names = (data.png ?? [])
        .map((f: string) => f.replace(/\.png$/, ''))
        // Filter out dark/light variants — keep the base icon
        .filter((n: string) => !n.endsWith('-dark') && !n.endsWith('-light'));
      // Deduplicate and sort
      cachedIconNames = [...new Set(names)].sort();
      return cachedIconNames;
    })
    .catch(() => {
      fetchPromise = null;
      return [] as string[];
    });
  return fetchPromise;
}

function useDashboardIcons() {
  const [names, setNames] = useState<string[]>(cachedIconNames ?? []);
  const [loading, setLoading] = useState(!cachedIconNames);
  useEffect(() => {
    if (cachedIconNames) return;
    let cancelled = false;
    void fetchDashboardIcons().then((result) => {
      if (!cancelled) {
        setNames(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);
  return { names, loading };
}

// ── Lucide icon names ────────────────────────────────────────────────────────

const allLucideNames = Object.keys(icons);

// ── Component ────────────────────────────────────────────────────────────────

interface IconPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIcon: string | null;
  onSelect: (iconKey: string | null) => void;
}

export function IconPicker({
  open,
  onOpenChange,
  selectedIcon,
  onSelect,
}: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<string>('dashboard');
  const searchRef = useRef<HTMLInputElement>(null);

  // Dashboard icons
  const { names: dashboardNames, loading: dashLoading } = useDashboardIcons();

  const filteredDashboard = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/[_\s-]/g, '');
    if (!term) return dashboardNames.slice(0, INITIAL_LIMIT);
    return dashboardNames.filter((n) =>
      n.toLowerCase().replace(/[_\s-]/g, '').includes(term),
    );
  }, [search, dashboardNames]);

  const filteredLucide = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allLucideNames.slice(0, INITIAL_LIMIT);
    return allLucideNames.filter((n) => n.toLowerCase().includes(term));
  }, [search]);

  function handleSelect(key: string | null) {
    onSelect(key);
    onOpenChange(false);
    setSearch('');
  }

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const selectedCdnName = selectedIcon && isCdnIcon(selectedIcon)
    ? parseCdnIcon(selectedIcon) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Pick an Icon</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              ref={searchRef}
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelect(null)}
            >
              Clear
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="dashboard" className="flex-1">
                🎨 App Icons
              </TabsTrigger>
              <TabsTrigger value="lucide" className="flex-1">
                Generic
              </TabsTrigger>
            </TabsList>

            {/* ── Dashboard Icons tab ─────────────────────────── */}
            <TabsContent value="dashboard" className="mt-2">
              {dashLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading icons…</span>
                </div>
              ) : (
                <div className="grid max-h-[400px] grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
                  {filteredDashboard.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-accent ${
                        selectedCdnName === name
                          ? 'ring-2 ring-primary bg-accent'
                          : ''
                      }`}
                      onClick={() => handleSelect(`cdn:${name}`)}
                    >
                      <img
                        src={cdnIconUrl(name)}
                        alt={name}
                        className="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                      <span className="max-w-full truncate text-[9px] text-muted-foreground leading-tight">
                        {name}
                      </span>
                    </button>
                  ))}
                  {filteredDashboard.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      No icons match &ldquo;{search}&rdquo;
                    </p>
                  )}
                  {!search && filteredDashboard.length < dashboardNames.length && (
                    <p className="col-span-full py-2 text-center text-[10px] text-muted-foreground">
                      Showing {filteredDashboard.length} of {dashboardNames.length} — type to search
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Lucide Icons tab ────────────────────────────── */}
            <TabsContent value="lucide" className="mt-2">
              <div className="grid max-h-[400px] grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6">
                {filteredLucide.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-accent ${
                      selectedIcon === name
                        ? 'ring-2 ring-primary bg-accent'
                        : ''
                    }`}
                    onClick={() => handleSelect(name)}
                  >
                    {createElement(
                      icons[name as keyof typeof icons],
                      { size: 20, 'aria-hidden': true } as React.SVGAttributes<SVGSVGElement>,
                    )}
                  </button>
                ))}
                {filteredLucide.length === 0 && (
                  <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    No icons match &ldquo;{search}&rdquo;
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
