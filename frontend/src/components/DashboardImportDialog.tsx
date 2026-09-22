/**
 * T016: Dashboard Import Dialog.
 *
 * Accepts a .json file, parses it, shows a preview, and posts to
 * POST /api/admin/dashboards/import. Handles 409 conflict by
 * prompting for an override name.
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import { Button } from './ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { useImportDashboard } from '../state/adminDashboards.js';
import { ApiRequestError } from '../lib/apiClient.js';

interface ImportPayload {
  version: number;
  dashboard: {
    name: string;
    applicability: string;
    backgroundType: string;
    backgroundColor: string | null;
    backgroundDisplayMode: string | null;
  };
  placeholders: Array<{
    stableKey: string;
    widgets: Array<{ type: string }>;
    links: Array<{ title: string }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardImportDialog({ open, onOpenChange }: Props) {
  const importMutation = useImportDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [overrideName, setOverrideName] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPayload(null);
    setParseError(null);
    setConflictName(null);
    setOverrideName('');
    setApiError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setParseError(null);
      setApiError(null);
      setConflictName(null);

      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string) as unknown;
          const data = json as ImportPayload;
          if (data.version !== 1 || !data.dashboard?.name) {
            setParseError('Invalid export file: missing version or dashboard name');
            setPayload(null);
            return;
          }
          setPayload(data);
        } catch {
          setParseError('Failed to parse JSON file');
          setPayload(null);
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read file');
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleImport = useCallback(() => {
    if (!payload) return;

    const body: Record<string, unknown> = { ...payload };
    if (conflictName && overrideName.trim()) {
      body['overrideName'] = overrideName.trim();
    }

    setApiError(null);

    importMutation.mutate(body, {
      onSuccess: () => {
        handleOpenChange(false);
      },
      onError: (err: Error) => {
        if (err instanceof ApiRequestError && err.status === 409) {
          const errorBody = err.body as { existingName?: string };
          setConflictName(errorBody.existingName ?? payload.dashboard.name);
          setOverrideName(payload.dashboard.name + ' (Copy)');
          setApiError(null);
        } else {
          setApiError(err.message);
        }
      },
    });
  }, [payload, conflictName, overrideName, importMutation, handleOpenChange]);

  // Stats for preview
  const placeholderCount = payload?.placeholders.length ?? 0;
  const widgetCount =
    payload?.placeholders.reduce((sum, ph) => sum + (ph.widgets?.length ?? 0), 0) ?? 0;
  const linkCount =
    payload?.placeholders.reduce((sum, ph) => sum + (ph.links?.length ?? 0), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Dashboard
          </DialogTitle>
          <DialogDescription>
            Upload a previously exported dashboard JSON file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="import-file">Dashboard file</Label>
            <Input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {payload && !parseError && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                {payload.dashboard.name}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>{placeholderCount} placeholder{placeholderCount !== 1 ? 's' : ''}</span>
                <span>{widgetCount} widget{widgetCount !== 1 ? 's' : ''}</span>
                <span>{linkCount} link{linkCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Applicability: {payload.dashboard.applicability}
              </div>
            </div>
          )}

          {/* Conflict: override name */}
          {conflictName && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                A dashboard named &quot;{conflictName}&quot; already exists. Choose a different name.
              </div>
              <Label htmlFor="override-name">New name</Label>
              <Input
                id="override-name"
                value={overrideName}
                onChange={(e) => setOverrideName(e.target.value)}
                placeholder="Enter a unique name"
              />
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {apiError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!payload || importMutation.isPending || !!parseError}
          >
            {importMutation.isPending ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
