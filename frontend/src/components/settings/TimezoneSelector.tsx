/**
 * T023 (US3): Searchable timezone selector component.
 * Uses Popover + Input + scrollable list for a combobox-style picker.
 * Fetches the timezone list from /api/admin/timezones and allows the user
 * to update the homeTimezone shell setting.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../lib/apiClient.js';
import { useAdminShellSettings, useUpdateShellSettings } from '../../state/settings.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';

const SYSTEM_DEFAULT = '__system__';

function useTimezoneList() {
  return useQuery({
    queryKey: ['timezones'],
    queryFn: () => apiClient.get<{ timezones: string[] }>('/api/admin/timezones'),
    staleTime: 5 * 60_000,
  });
}

export function TimezoneSelector() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const tzQuery = useTimezoneList();
  const shellQuery = useAdminShellSettings({ enabled: true });
  const updateSettings = useUpdateShellSettings();

  const currentTz = shellQuery.data?.homeTimezone ?? null;

  const filtered = useMemo(() => {
    const timezones = tzQuery.data?.timezones ?? [];
    if (!search) return timezones;
    const lower = search.toLowerCase();
    return timezones.filter((tz) => tz.toLowerCase().includes(lower));
  }, [tzQuery.data?.timezones, search]);

  function handleSelect(value: string) {
    const newTz = value === SYSTEM_DEFAULT ? null : value;
    setOpen(false);
    setSearch('');
    updateSettings.mutate(
      { homeTimezone: newTz },
      {
        onSuccess: () =>
          toast.success(newTz ? `Timezone set to ${newTz}` : 'Timezone reset to system default'),
        onError: (err: Error) => toast.error(`Failed to update timezone: ${err.message}`),
      },
    );
  }

  const displayValue = currentTz ?? '(System default)';

  return (
    <Card id="timezone">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Home Timezone
        </CardTitle>
        <CardDescription>
          Set the primary timezone for clocks and timestamps displayed on the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
                disabled={updateSettings.isPending}
              >
                <span className="truncate">{displayValue}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <div className="p-2 border-b border-border">
                <Input
                  placeholder="Search timezones…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto p-1">
                {/* System default option */}
                <button
                  type="button"
                  className="relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(SYSTEM_DEFAULT)}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${currentTz === null ? 'opacity-100' : 'opacity-0'}`}
                  />
                  (System default)
                </button>

                {filtered.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No timezones found.
                  </p>
                )}

                {filtered.map((tz) => (
                  <button
                    key={tz}
                    type="button"
                    className="relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleSelect(tz)}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${currentTz === tz ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {tz}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
