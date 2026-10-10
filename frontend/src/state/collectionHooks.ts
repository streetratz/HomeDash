import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../lib/apiClient.js';
import { useAuthMe } from './bootstrap.js';
import type { CollectionDateGroup } from '../components/calendar/CollectionGroup.js';
import { householdToday } from '../lib/collectionDates.js';

export type CollectionWindow = { daysAhead: number } | { from: string; to: string };
export type CollectionException = { id: string; kind: 'skip'; originalDate: string } |
  { id: string; kind: 'replace'; originalDate: string; actualDate: string } |
  { id: string; kind: 'add'; actualDate: string };
export type CollectionStream = { id: string; name: string; color: string; enabled: boolean } & (
  { schedule: { mode: 'regular'; weekdays: number[]; intervalWeeks: number; anchorDate: string }; exceptions: CollectionException[] } |
  { schedule: { mode: 'explicit'; dates: string[] } }
);
export interface CollectionConfig {
  configured: boolean; revision: number; runtimeEpoch: string; timezone: string | null;
  providerLabel: string | null; streams: CollectionStream[];
}
export interface CollectionDraft {
  expectedRevision: number; runtimeEpoch: string; timezone: string; providerLabel: string | null;
  streams: CollectionStream[]; range: { from: string; to: string };
  confirmations: { timezoneConfirmed: boolean; deletedStreamIds: string[]; removedExceptionIds: string[]; clearedExplicitStreamIds: string[] };
}
export interface CollectionPreview {
  canSave: boolean; expectedRevision: number; runtimeEpoch: string; previewDigest: string;
  range: { from: string; to: string }; groups: CollectionDateGroup[];
  blockers: { path: (string | number)[]; code: string; message: string }[]; warnings: string[];
}
export interface CollectionDisplay {
  timezone: string | null; householdToday: string | null; serverNow: string;
  range: { from: string; to: string };
  state: 'unconfigured' | 'not_selected' | 'disabled' | 'no_dates_in_range' | 'exhausted' | 'ready' | 'no_dates';
  groups: CollectionDateGroup[];
}
export const collectionKeys = {
  config: (session: string) => ['collections', 'config', session] as const,
  display: (mode: string, widgetId: string, window: CollectionWindow) => ['collections', 'display', mode, widgetId, window] as const,
};
const root = '/api/admin/calendar/collections';
export function useCollectionConfig() {
  const auth = useAuthMe();
  const session = `${auth.data?.user.id ?? 'none'}:${auth.dataUpdatedAt}`;
  return useQuery({
    queryKey: collectionKeys.config(session),
    queryFn: () => apiClient.get<CollectionConfig>(root),
    enabled: auth.isSuccess && auth.data.user.isAdmin,
    staleTime: 0,
  });
}
export function useCollectionPreview() {
  return useMutation({ mutationFn: (draft: CollectionDraft) => apiClient.post<CollectionPreview>(`${root}/preview`, draft) });
}
export function useCollectionSave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: CollectionDraft & { previewDigest: string }) => apiClient.put<CollectionConfig>(root, draft),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['collections'] }); },
  });
}
export function collectionDenied(error: unknown): boolean {
  return error instanceof ApiRequestError && [401, 403, 404].includes(error.status);
}
export function useCollectionDisplay(widgetId: string, window: CollectionWindow, active: boolean) {
  const auth = useAuthMe();
  const client = useQueryClient();
  const [foreground, setForeground] = useState(() => document.visibilityState !== 'hidden');
  const [clock, setClock] = useState<{ serverNow: string; timezone: string | null; receivedAt: number; today: string | null } | null>(null);
  const authenticated = auth.isSuccess && !!auth.data;
  const mode = authenticated ? `auth:${auth.data.user.id}:${auth.dataUpdatedAt}` : 'public';
  const daysAhead = 'daysAhead' in window ? window.daysAhead : null;
  const from = 'from' in window ? window.from : '';
  const to = 'to' in window ? window.to : '';
  const key = useMemo(() => collectionKeys.display(mode, widgetId, daysAhead !== null ? { daysAhead } : { from, to }), [mode, widgetId, daysAhead, from, to]);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const params = new URLSearchParams('daysAhead' in window
        ? { daysAhead: String(window.daysAhead) } : { from: window.from, to: window.to });
      const result = await apiClient.get<CollectionDisplay>(`/api/${authenticated ? 'user' : 'public'}/calendar/widgets/${widgetId}/collections?${params}`);
      setClock({ serverNow: result.serverNow, timezone: result.timezone, receivedAt: performance.now(), today: result.householdToday });
      return result;
    },
    enabled: active && foreground && !auth.isLoading,
    staleTime: 0,
    refetchInterval: active && foreground ? 30_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: (count, error) => !collectionDenied(error) && count < 2,
  });
  const denied = collectionDenied(query.error);
  useEffect(() => {
    return client.getQueryCache().subscribe(event => {
      if (!foreground || JSON.stringify(event.query.queryKey) !== JSON.stringify(key)) return;
      setClock(previous => {
        if (!previous?.timezone) return previous;
        const today = householdToday(previous.serverNow, previous.timezone, performance.now() - previous.receivedAt);
        return today === previous.today ? previous : { ...previous, today };
      });
    });
  }, [foreground, client, key]);
  const data = query.data && !denied ? {
    ...query.data,
    householdToday: clock && clock.serverNow === query.data.serverNow ? clock.today : query.data.householdToday,
  } : undefined;
  const { refetch } = query;
  useEffect(() => {
    // Keep the denied error on the active observer while removing its payload.
    // Removing the active Query object would reset denial and permit remount loops.
    const cached = client.getQueryCache().find({ queryKey: key, exact: true });
    if (denied && cached?.state.data !== undefined) cached?.setState({ data: undefined });
  }, [denied, client, key]);
  useEffect(() => {
    const resume = () => {
      const visible = document.visibilityState !== 'hidden';
      setForeground(visible);
      if (visible && active) void refetch();
    };
    document.addEventListener('visibilitychange', resume);
    globalThis.window.addEventListener('focus', resume);
    return () => { document.removeEventListener('visibilitychange', resume); globalThis.window.removeEventListener('focus', resume); };
  }, [active, refetch]);
  return { ...query, data, denied, stale: query.isError && !denied && !!query.data };
}
