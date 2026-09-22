/**
 * T036 (US5): TanStack Query hooks for scheduled jobs CRUD.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { queryClient } from './queryClient.js';
import { toast } from 'sonner';

interface ScheduledJob {
  id: string;
  name: string;
  actionType: string;
  actionParams: string;
  cronExpression: string;
  enabled: number;
  isSystem: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const JOBS_KEY = ['scheduled-jobs'];

function invalidateJobs() {
  void queryClient.invalidateQueries({ queryKey: JOBS_KEY });
}

export function useScheduledJobs() {
  return useQuery({
    queryKey: JOBS_KEY,
    queryFn: () => apiClient.get<{ jobs: ScheduledJob[] }>('/api/admin/scheduled-jobs'),
    select: (data) => data.jobs,
  });
}

export function useCreateJob() {
  return useMutation({
    mutationFn: (data: { name: string; actionType: string; actionParams: string; cronExpression: string; enabled?: boolean }) =>
      apiClient.post<ScheduledJob>('/api/admin/scheduled-jobs', data),
    onSuccess: () => {
      toast.success('Job created');
      invalidateJobs();
    },
    onError: (err: Error) => toast.error(`Failed to create job: ${err.message}`),
  });
}

export function useUpdateJob() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; actionType?: string; actionParams?: string; cronExpression?: string; enabled?: boolean }) =>
      apiClient.put<ScheduledJob>(`/api/admin/scheduled-jobs/${id}`, data),
    onSuccess: () => {
      toast.success('Job updated');
      invalidateJobs();
    },
    onError: (err: Error) => toast.error(`Failed to update job: ${err.message}`),
  });
}

export function useDeleteJob() {
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/scheduled-jobs/${id}`),
    onSuccess: () => {
      toast.success('Job deleted');
      invalidateJobs();
    },
    onError: (err: Error) => toast.error(`Failed to delete job: ${err.message}`),
  });
}

export function useRunJobNow() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ status: string; error?: string }>(`/api/admin/scheduled-jobs/${id}/run`),
    onSuccess: (data) => {
      if (data.status === 'success') {
        toast.success('Job executed successfully');
      } else {
        toast.error(`Job failed: ${data.error ?? 'Unknown error'}`);
      }
      invalidateJobs();
    },
    onError: (err: Error) => toast.error(`Failed to run job: ${err.message}`),
  });
}

export type { ScheduledJob };
