/**
 * DockerConnectionForm — Add/edit form for Docker connections.
 * Shows in create mode (no connection prop) or edit mode (connection prop provided).
 */

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import type { DockerConnection } from '../../hooks/useConnections.js';
import {
  useCreateDockerConnection,
  useUpdateDockerConnection,
  useTestDockerConnection,
} from '../../hooks/useConnections.js';

interface DockerConnectionFormProps {
  connection?: DockerConnection;
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function DockerConnectionForm({ connection, onClose }: DockerConnectionFormProps) {
  const isEdit = !!connection;

  const [name, setName] = useState(connection?.name ?? 'Docker');
  const [dockerUrl, setDockerUrl] = useState(connection?.dockerUrl ?? '');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const createMutation = useCreateDockerConnection();
  const updateMutation = useUpdateDockerConnection();
  const testMutation = useTestDockerConnection();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function handleTest() {
    setTestStatus('testing');
    setTestMessage('');

    const params = connection ? { id: connection.id } : { dockerUrl };

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
    setSaveError('');
    // The server's rejection names the accepted formats, so it is shown
    // verbatim rather than replaced with a generic "invalid URL" (FR-020).
    const onError = (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Could not save the connection.');
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: connection.id, name, dockerUrl },
        { onSuccess: onClose, onError },
      );
    } else {
      createMutation.mutate({ name, dockerUrl }, { onSuccess: onClose, onError });
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label htmlFor="docker-name">Name</Label>
        <Input
          id="docker-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Docker"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="docker-url">Docker endpoint</Label>
        <Input
          id="docker-url"
          value={dockerUrl}
          onChange={(e) => {
            setDockerUrl(e.target.value);
            setSaveError('');
            setTestStatus('idle');
          }}
          placeholder="unix:///var/run/docker.sock"
          aria-describedby="docker-url-help"
          aria-invalid={saveError ? true : undefined}
        />
        {/* Stating the grammar up front is cheaper than a rejection after the
            fact — an http:// URL or a bare host:port is the common mistake. */}
        <div id="docker-url-help" className="space-y-1 text-xs text-muted-foreground">
          <p>One of four forms. A scheme is required.</p>
          <ul className="space-y-0.5 pl-4">
            <li className="list-disc">
              <code>unix:///var/run/docker.sock</code>
            </li>
            <li className="list-disc">
              <code>tcp://host</code> — port defaults to 2375
            </li>
            <li className="list-disc">
              <code>https://host</code> — port defaults to 2376
            </li>
            <li className="list-disc">
              <code>ssh://user@host</code> — port defaults to 22
            </li>
          </ul>
          <p>
            <code>http://…</code> and a bare <code>host:port</code> are not accepted.
          </p>
        </div>
        {saveError && (
          <p role="alert" className="text-xs text-red-500">
            {saveError}
          </p>
        )}
      </div>

      {/* Test connection — wraps at narrow widths so the result stays legible */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testStatus === 'testing' || !dockerUrl}
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
          <span role="alert" className="flex items-start gap-1 break-words text-xs text-red-500">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {testMessage}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving || !name || !dockerUrl}>
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {isEdit ? 'Save' : 'Add Connection'}
        </Button>
      </div>
    </div>
  );
}
