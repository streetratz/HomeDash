/**
 * T017: Backup & restore TanStack Query hooks.
 */

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackupSummary {
  users: number;
  dashboards: number;
  widgets: number;
  groups: number;
  scheduledJobs: number;
  calendarSources: number;
  todoLists: number;
  integrations: number;
  photoSources: number;
}

export interface RestorePreview {
  summary: BackupSummary;
  appVersion: string;
  exportedAt: string;
  warnings: string[];
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  return fallback;
}

// ── Download backup ───────────────────────────────────────────────────────────

export function useDownloadBackup() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/backup', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Download failed'));
      }
      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homedash-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Backup downloaded'),
    onError: (err: Error) => toast.error(`Backup failed: ${err.message}`),
  });
}

// ── Download full database backup ─────────────────────────────────────────────

export function useDownloadFullBackup() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/backup/database', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Download failed'));
      }
      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homedash-full-${dateStr}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Full backup downloaded'),
    onError: (err: Error) => toast.error(`Full backup failed: ${err.message}`),
  });
}

// ── Preview restore ───────────────────────────────────────────────────────────

export function usePreviewRestore() {
  return useMutation({
    mutationFn: async (backupData: unknown): Promise<RestorePreview> => {
      return apiClient.post<RestorePreview>('/api/admin/backup/preview', backupData);
    },
  });
}

// ── Execute restore ───────────────────────────────────────────────────────────

export function useExecuteRestore() {
  return useMutation({
    mutationFn: async (backup: unknown): Promise<{ success: boolean; summary: BackupSummary }> => {
      return apiClient.post('/api/admin/backup/restore', { backup, confirmationWord: 'RESTORE' });
    },
  });
}
