/**
 * T018: Backup & restore UI — download backup, upload + preview + confirm restore.
 */

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { toast } from 'sonner';
import {
  useDownloadBackup,
  useDownloadFullBackup,
  usePreviewRestore,
  useExecuteRestore,
  type RestorePreview,
} from '../../state/backupHooks.js';

function isHomeDashBackup(value: unknown): value is { format: 'homedash-backup' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'format' in value &&
    value.format === 'homedash-backup'
  );
}

export function BackupRestoreSection() {
  const downloadBackup = useDownloadBackup();
  const downloadFullBackup = useDownloadFullBackup();
  const previewRestore = usePreviewRestore();
  const executeRestore = useExecuteRestore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [backupPayload, setBackupPayload] = useState<unknown>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isHomeDashBackup(parsed)) {
        toast.error('Invalid backup file — not a HomeDash backup.');
        return;
      }

      setBackupPayload(parsed);
      const result = await previewRestore.mutateAsync(parsed);
      setPreview(result);
      setConfirmWord('');
      setDialogOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read backup file';
      toast.error(msg);
    } finally {
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [previewRestore]);

  const handleRestore = useCallback(async () => {
    if (confirmWord !== 'RESTORE') {
      toast.error('Please type RESTORE to confirm.');
      return;
    }

    try {
      const result = await executeRestore.mutateAsync(backupPayload);
      if (result.success) {
        toast.success('Restore complete — you will be logged out.');
        setDialogOpen(false);
        setPreview(null);
        // Redirect to login after restore invalidates sessions
        setTimeout(() => { window.location.href = '/login'; }, 2000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      toast.error(msg);
    }
  }, [confirmWord, backupPayload, executeRestore]);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setDialogOpen(false);
      setPreview(null);
      setBackupPayload(null);
      setConfirmWord('');
    }
  }, []);

  return (
    <>
      <Card id="backup-restore">
        <CardHeader>
          <CardTitle className="text-base">Backup & Restore</CardTitle>
          <CardDescription>
            Download a portable configuration backup or restore one into this installation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={() => downloadBackup.mutate()}
              disabled={downloadBackup.isPending}
              variant="outline"
            >
              {downloadBackup.isPending ? 'Downloading…' : 'Download Backup'}
            </Button>

            <div className="relative">
              <Button
                variant="destructive"
                onClick={() => fileInputRef.current?.click()}
                disabled={previewRestore.isPending}
              >
                {previewRestore.isPending ? 'Reading…' : 'Restore from Backup'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(event) => {
                  void handleFileSelect(event);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Backups include all dashboards, widgets, users, groups, and settings.
            Passwords, OAuth tokens, integration credentials, CalDAV passwords, and
            session data are excluded for security. Your current administrator login is
            preserved during restore; other users require a password reset.
          </p>
        </CardContent>
      </Card>

      <Card id="full-backup">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Full Database Backup
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
              Contains Sensitive Data
            </span>
          </CardTitle>
          <CardDescription>
            Download a complete copy of the database for disaster recovery.
            Includes all credentials and secrets — store securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => downloadFullBackup.mutate()}
            disabled={downloadFullBackup.isPending}
            variant="outline"
          >
            {downloadFullBackup.isPending ? 'Downloading…' : 'Download Full Backup'}
          </Button>

          <details className="group rounded-md border p-3">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground">
              How to restore from full backup
            </summary>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Restore steps (volume corrupted):</p>
              <div className="space-y-2">
                <p>1. Stop the container:</p>
                <pre className="rounded bg-muted p-2 text-[11px] overflow-x-auto">docker compose down</pre>
                <p>2. Copy the backup file to the data directory:</p>
                <pre className="rounded bg-muted p-2 text-[11px] overflow-x-auto">cp homedash_YYYYMMDD_HHmmss.db /path/to/data/db/homedash.sqlite</pre>
                <p>3. Start the container:</p>
                <pre className="rounded bg-muted p-2 text-[11px] overflow-x-auto">docker compose up -d</pre>
              </div>
              <p className="mt-2 text-yellow-700 dark:text-yellow-400">
                💡 Tip: Mount the backups directory as a separate volume for extra safety:
              </p>
              <pre className="rounded bg-muted p-2 text-[11px] overflow-x-auto">-v /host/path:/app/data/backups</pre>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Restore confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Restore</DialogTitle>
            <DialogDescription>
              This will replace <strong>all existing data</strong> with the backup contents.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-2 font-medium">Backup Summary</p>
                <p className="text-xs text-muted-foreground mb-1">
                  Created: {new Date(preview.exportedAt).toLocaleString()} (v{preview.appVersion})
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span>Users: {preview.summary.users}</span>
                  <span>Dashboards: {preview.summary.dashboards}</span>
                  <span>Widgets: {preview.summary.widgets}</span>
                  <span>Groups: {preview.summary.groups}</span>
                  <span>Calendar Sources: {preview.summary.calendarSources}</span>
                  <span>Todo Lists: {preview.summary.todoLists}</span>
                  <span>Integrations: {preview.summary.integrations}</span>
                  <span>Photo Sources: {preview.summary.photoSources}</span>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs space-y-1">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">⚠ Warnings</p>
                  {preview.warnings.map((w, i) => (
                    <p key={i} className="text-yellow-700 dark:text-yellow-300">• {w}</p>
                  ))}
                </div>
              )}

              {/* Confirmation input */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type <code className="rounded bg-muted px-1 py-0.5 text-destructive">RESTORE</code> to confirm:
                </p>
                <Input
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  placeholder="Type RESTORE"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmWord !== 'RESTORE' || executeRestore.isPending}
              onClick={() => {
                void handleRestore();
              }}
            >
              {executeRestore.isPending ? 'Restoring…' : 'Restore Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
