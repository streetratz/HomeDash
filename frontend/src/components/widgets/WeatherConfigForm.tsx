/**
 * T043 (US8): WeatherConfigForm — configure weather widget
 * location and display options via Open-Meteo geocoding.
 */

import { useState } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { WeatherConfig } from '../../state/dashboards.js';

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export function WeatherConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as Partial<WeatherConfig>;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  function update(patch: Record<string, unknown>) {
    const next = { ...cfg, ...patch };
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined) cleaned[k] = v;
    }
    onChange(cleaned);
  }

  async function handleSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?name=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Geocode failed');
      const json = (await res.json()) as { results?: GeoResult[] };
      setSearchResults(json.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(loc: GeoResult) {
    update({
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationName: loc.admin1 ? `${loc.name}, ${loc.admin1}, ${loc.country}` : `${loc.name}, ${loc.country}`,
    });
    setSearchResults([]);
    setSearchQuery('');
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Search Location</Label>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a city name…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); } }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleSearch()}
            disabled={searching || searchQuery.trim().length < 2}
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="rounded-md border border-border bg-popover">
            {searchResults.map((loc, i) => (
              <button
                key={i}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                onClick={() => selectLocation(loc)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {loc.name}
                  {loc.admin1 ? `, ${loc.admin1}` : ''}, {loc.country}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-name">Location Name</Label>
        <Input
          id="location-name"
          value={cfg.locationName ?? ''}
          onChange={(e) => update({ locationName: e.target.value })}
          placeholder="e.g., New York"
        />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="0.0001"
              min={-90}
              max={90}
              value={cfg.latitude ?? ''}
              onChange={(e) => update({ latitude: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="40.7128"
            />
          </div>
          <div>
            <Label htmlFor="lon">Longitude</Label>
            <Input
              id="lon"
              type="number"
              step="0.0001"
              min={-180}
              max={180}
              value={cfg.longitude ?? ''}
              onChange={(e) => update({ longitude: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="-74.006"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Temperature Unit</Label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm border ${(cfg.temperatureUnit ?? 'C') === 'C' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            onClick={() => update({ temperatureUnit: 'C' })}
          >
            °C
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm border ${cfg.temperatureUnit === 'F' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            onClick={() => update({ temperatureUnit: 'F' })}
          >
            °F
          </button>
        </div>
      </div>
    </div>
  );
}
