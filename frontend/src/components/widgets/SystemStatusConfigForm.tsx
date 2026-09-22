/**
 * T035 (US7): SystemStatusConfigForm — dynamic service row editor
 * with add/remove buttons and poll interval configuration.
 */

import { Plus, Trash2 } from 'lucide-react';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { SystemStatusConfig, ServiceEntry } from '../../state/dashboards.js';

const MAX_SERVICES = 20;

const DEFAULT_ENTRY: ServiceEntry = {
  name: '',
  url: '',
  expectedStatus: 200,
  timeoutSeconds: 10,
};

export function SystemStatusConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as Partial<SystemStatusConfig>;
  const services = cfg.services ?? [];
  const pollIntervalSeconds = cfg.pollIntervalSeconds ?? 60;

  function updateService(index: number, patch: Partial<ServiceEntry>) {
    const updated = services.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...cfg, services: updated });
  }

  function addService() {
    if (services.length >= MAX_SERVICES) return;
    onChange({ ...cfg, services: [...services, { ...DEFAULT_ENTRY }] });
  }

  function removeService(index: number) {
    onChange({ ...cfg, services: services.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Services</Label>
        {services.map((svc, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Service {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeService(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`svc-name-${i}`} className="text-xs">Name</Label>
                <Input
                  id={`svc-name-${i}`}
                  value={svc.name}
                  onChange={(e) => updateService(i, { name: e.target.value })}
                  placeholder="My Service"
                />
              </div>
              <div>
                <Label htmlFor={`svc-url-${i}`} className="text-xs">URL</Label>
                <Input
                  id={`svc-url-${i}`}
                  type="url"
                  value={svc.url}
                  onChange={(e) => updateService(i, { url: e.target.value })}
                  placeholder="http://192.168.1.x:8080"
                />
              </div>
              <div>
                <Label htmlFor={`svc-status-${i}`} className="text-xs">Expected Status</Label>
                <Input
                  id={`svc-status-${i}`}
                  type="number"
                  min={100}
                  max={599}
                  value={svc.expectedStatus}
                  onChange={(e) => updateService(i, { expectedStatus: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor={`svc-timeout-${i}`} className="text-xs">Timeout (s)</Label>
                <Input
                  id={`svc-timeout-${i}`}
                  type="number"
                  min={1}
                  max={30}
                  value={svc.timeoutSeconds}
                  onChange={(e) => updateService(i, { timeoutSeconds: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}
        {services.length < MAX_SERVICES && (
          <Button type="button" variant="outline" size="sm" onClick={addService} className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Add Service
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="poll-interval">Poll Interval (seconds)</Label>
        <Input
          id="poll-interval"
          type="number"
          min={15}
          max={3600}
          value={pollIntervalSeconds}
          onChange={(e) => onChange({ ...cfg, pollIntervalSeconds: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Minimum 15 seconds, maximum 1 hour
        </p>
      </div>
    </div>
  );
}
