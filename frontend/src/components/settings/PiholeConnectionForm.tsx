/**
 * PiholeConnectionForm — Add/edit form for Pi-hole connections.
 * Shows in create mode (no connection prop) or edit mode (connection prop provided).
 */

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import type { PiholeConnection } from '../../hooks/useConnections.js';
import {
  useCreatePiholeConnection,
  useUpdatePiholeConnection,
  useTestPiholeConnection,
} from '../../hooks/useConnections.js';

interface PiholeConnectionFormProps {
  connection?: PiholeConnection;
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function PiholeConnectionForm({ connection, onClose }: PiholeConnectionFormProps) {
  const isEdit = !!connection;

  const [name, setName] = useState(connection?.name ?? 'Pi-hole');
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? '');
  const [apiToken, setApiToken] = useState('');
  const [pollInterval, setPollInterval] = useState(connection?.pollIntervalSec ?? 30);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

  const createMutation = useCreatePiholeConnection();
  const updateMutation = useUpdatePiholeConnection();
  const testMutation = useTestPiholeConnection();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function handleTest() {
    setTestStatus('testing');
    setTestMessage('');

    const params = connection
      ? { id: connection.id }
      : { baseUrl, apiToken };

    testMutation.mutate(params, {
      onSuccess: (result) => {
        if (result.success) {
          setTestStatus('success');
          setTestMessage('Connection successful');
        } else {
          setTestStatus('error');
          setTestMessage(result.message ?? 'Connection failed');
        }
      },
      onError: (err) => {
        setTestStatus('error');
        setTestMessage(err instanceof Error ? err.message : 'Connection failed');
      },
    });
  }

  function handleSave() {
    if (isEdit) {
      updateMutation.mutate(
        {
          id: connection.id,
          name,
          baseUrl,
          ...(apiToken ? { apiToken } : {}),
          pollIntervalSec: pollInterval,
        },
        { onSuccess: onClose },
      );
    } else {
      createMutation.mutate(
        { name, baseUrl, apiToken, pollIntervalSec: pollInterval },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label htmlFor="pihole-name">Name</Label>
        <Input
          id="pihole-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pi-hole"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pihole-url">Base URL</Label>
        <Input
          id="pihole-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://192.168.1.x"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pihole-token">API Password / Token</Label>
        <Input
          id="pihole-token"
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder={isEdit ? 'Unchanged' : 'Enter API password'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pihole-poll">Poll Interval (seconds)</Label>
        <Input
          id="pihole-poll"
          type="number"
          min={10}
          max={300}
          value={pollInterval}
          onChange={(e) => setPollInterval(Number(e.target.value))}
        />
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testStatus === 'testing' || !baseUrl}
        >
          {testStatus === 'testing' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Test Connection
        </Button>

        {testStatus === 'success' && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {testMessage}
          </span>
        )}
        {testStatus === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <XCircle className="h-3.5 w-3.5" />
            {testMessage}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving || !name || !baseUrl}>
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {isEdit ? 'Save' : 'Add Connection'}
        </Button>
      </div>
    </div>
  );
}
