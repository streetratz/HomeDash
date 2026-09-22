/**
 * 004 Phase 5: TanStack Query hooks for calendar data.
 *
 * Provides hooks for calendar sources, events, OAuth accounts,
 * and related mutations (create/update/delete/sync).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarSource {
  id: string;
  oauthAccountId: string | null;
  type: 'microsoft' | 'google' | 'ical' | 'ical_file' | 'birthday_local';
  name: string;
  url: string | null;
  fileName: string | null;
  color: string;
  syncIntervalSeconds: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  sourceId: string;
  providerEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  startTz: string | null;
  endTz: string | null;
  isAllDay: boolean;
  isPrivate: boolean;
  recurrenceRule: string | null;
  calendarName: string | null;
}

export interface OAuthAccount {
  id: string;
  provider: 'microsoft' | 'google' | 'spotify' | 'sonos';
  email: string | null;
  displayName: string | null;
  status: 'active' | 'error';
  lastError: string | null;
  createdAt: string;
}

export interface OAuthProviders {
  microsoft: boolean;
  google: boolean;
  spotify: boolean;
  sonos: boolean;
}

export interface BirthdayRecord {
  id: string;
  sourceId: string;
  firstName: string;
  lastName: string | null;
  month: number;
  day: number;
  birthYear: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BirthdayInput {
  firstName: string;
  lastName?: string | null;
  month: number;
  day: number;
  birthYear?: number | null;
  notes?: string | null;
}

export interface BirthdayCsvPreview {
  rows: Array<
    BirthdayInput & { birthYear: number | null; notes: string | null; rowNumber: number }
  >;
  errors: Array<{ rowNumber: number; message: string }>;
  validCount: number;
  invalidCount: number;
}

export interface BirthdayExport {
  fileName: string;
  mimeType: string;
  content: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const calendarKeys = {
  sources: ['calendar-sources'] as const,
  events: (sourceIds: string[], from: string, to: string) =>
    ['calendar-events', sourceIds, from, to] as const,
  oauthAccounts: ['oauth-accounts'] as const,
  oauthProviders: ['oauth-providers'] as const,
  birthdays: (sourceId: string) => ['calendar-birthdays', sourceId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useCalendarSources() {
  return useQuery({
    queryKey: calendarKeys.sources,
    queryFn: () => apiClient.get<CalendarSource[]>('/api/user/calendar/sources'),
  });
}

export function useCalendarEvents(sourceIds: string[], from: string, to: string) {
  return useQuery({
    queryKey: calendarKeys.events(sourceIds, from, to),
    queryFn: () =>
      apiClient.get<CalendarEvent[]>(
        `/api/public/calendar/events?sourceIds=${sourceIds.join(',')}&from=${from}&to=${to}`,
      ),
    enabled: sourceIds.length > 0,
    staleTime: 60_000,
  });
}

export function useOAuthAccounts() {
  return useQuery({
    queryKey: calendarKeys.oauthAccounts,
    queryFn: () => apiClient.get<OAuthAccount[]>('/api/user/oauth/accounts'),
  });
}

export function useOAuthProviders() {
  return useQuery({
    queryKey: calendarKeys.oauthProviders,
    queryFn: () => apiClient.get<OAuthProviders>('/api/user/oauth/providers'),
  });
}

export function useBirthdays(sourceId: string | undefined) {
  return useQuery({
    queryKey: calendarKeys.birthdays(sourceId ?? ''),
    queryFn: () =>
      apiClient.get<BirthdayRecord[]>(`/api/admin/calendar/sources/${sourceId}/birthdays`),
    enabled: Boolean(sourceId),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useDeleteOAuthAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/oauth/accounts/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.oauthAccounts });
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
    },
  });
}

export function useCreateCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: 'ical';
      name: string;
      url: string;
      color?: string;
      syncIntervalSeconds?: number;
    }) => apiClient.post<CalendarSource>('/api/admin/calendar/sources', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
    },
  });
}

export function useCreateBirthdaySource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      apiClient.post<CalendarSource>('/api/admin/calendar/birthday-sources', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
    },
  });
}

export function useCreateBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, ...data }: BirthdayInput & { sourceId: string }) =>
      apiClient.post<BirthdayRecord>(`/api/admin/calendar/sources/${sourceId}/birthdays`, data),
    onSuccess: (birthday) => {
      void qc.invalidateQueries({ queryKey: calendarKeys.birthdays(birthday.sourceId) });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useUpdateBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      birthdayId,
      ...data
    }: BirthdayInput & { sourceId: string; birthdayId: string }) =>
      apiClient.put<BirthdayRecord>(
        `/api/admin/calendar/sources/${sourceId}/birthdays/${birthdayId}`,
        data,
      ),
    onSuccess: (birthday) => {
      void qc.invalidateQueries({ queryKey: calendarKeys.birthdays(birthday.sourceId) });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useDeleteBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, birthdayId }: { sourceId: string; birthdayId: string }) =>
      apiClient.delete(`/api/admin/calendar/sources/${sourceId}/birthdays/${birthdayId}`),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: calendarKeys.birthdays(variables.sourceId) });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function usePreviewBirthdayCsv() {
  return useMutation({
    mutationFn: (csvContent: string) =>
      apiClient.post<BirthdayCsvPreview>('/api/admin/calendar/birthdays/preview', {
        csvContent,
      }),
  });
}

export function useImportBirthdayCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      csvContent,
      mode,
    }: {
      sourceId: string;
      csvContent: string;
      mode: 'append' | 'replace';
    }) =>
      apiClient.post<{ imported: number; skipped: number; mode: 'append' | 'replace' }>(
        `/api/admin/calendar/sources/${sourceId}/birthdays/import`,
        { csvContent, mode },
      ),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: calendarKeys.birthdays(variables.sourceId) });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useExportBirthdays() {
  return useMutation({
    mutationFn: ({ sourceId, format }: { sourceId: string; format: 'csv' | 'ics' }) =>
      apiClient.get<BirthdayExport>(
        `/api/admin/calendar/sources/${sourceId}/birthdays/export?format=${format}`,
      ),
  });
}

export function useImportCalendarFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id?: string;
      name: string;
      color: string;
      fileName: string;
      icsContent: string;
    }) =>
      id
        ? apiClient.post<CalendarSource>(`/api/admin/calendar/sources/${id}/import`, data)
        : apiClient.post<CalendarSource>('/api/admin/calendar/sources/import', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useUpdateCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      url?: string;
      color?: string;
      syncIntervalSeconds?: number;
      enabled?: boolean;
    }) => apiClient.put<CalendarSource>(`/api/admin/calendar/sources/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useDeleteCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/calendar/sources/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: calendarKeys.sources });
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useSyncCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/admin/calendar/sources/${id}/sync`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}
