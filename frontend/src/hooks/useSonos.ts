/**
 * useSonos — TanStack Query hooks for Sonos Cloud Control API.
 * Handles households, groups, players, playback, and volume.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient, ApiRequestError } from '../lib/apiClient.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SonosStatus {
  mode: 'cloud' | 'local';
  connected: boolean;
  displayName?: string;
  email?: string;
  householdId?: string;
  householdCount?: number;
  speakerCount?: number;
}

export interface SonosHousehold {
  id: string;
  name?: string;
}

export interface SonosPlayer {
  id: string;
  name: string;
  websocketUrl?: string;
  softwareVersion?: string;
  apiVersion?: string;
  minApiVersion?: string;
  capabilities?: string[];
  deviceIds?: string[];
}

export interface SonosGroup {
  id: string;
  name: string;
  coordinatorId: string;
  playbackState: string;
  playerIds: string[];
  players?: SonosPlayer[];
}

export interface SonosGroupsResponse {
  groups: SonosGroup[];
  players: SonosPlayer[];
  householdId: string;
}

export interface SonosGroupMutationResult {
  succeededPlayerIds: string[];
  failures: Array<{
    playerId: string;
    playerName?: string;
    operation: 'add' | 'remove';
    message: string;
  }>;
}

export interface SonosPlaybackState {
  playbackState: string; // PLAYBACK_STATE_PLAYING, PAUSED, IDLE, BUFFERING
  positionMillis?: number;
  previousPositionMillis?: number;
  playModes?: {
    repeat: boolean;
    repeatOne: boolean;
    crossfade: boolean;
    shuffle: boolean;
  };
}

export interface SonosMetadata {
  currentItem?: {
    track?: {
      name?: string;
      artist?: { name?: string };
      album?: { name?: string };
      imageUrl?: string;
      durationMillis?: number;
      type?: string;
      service?: { name?: string; id?: string; sn?: number; accountLabel?: string };
    };
  };
  container?: {
    name?: string;
    type?: string;
    imageUrl?: string;
    service?: { name?: string; id?: string; sn?: number; accountLabel?: string };
  };
  streamInfo?: string;
}

export interface SonosVolumeState {
  volume: number;
  muted: boolean;
  fixed: boolean;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const sonosKeys = {
  status: ['sonos-status'] as const,
  config: ['sonos-config'] as const,
  mode: ['sonos-mode'] as const,
  households: ['sonos-households'] as const,
  groups: (householdId: string) => ['sonos-groups', householdId] as const,
  playbackState: (groupId: string) => ['sonos-playback', groupId] as const,
  metadata: (groupId: string) => ['sonos-metadata', groupId] as const,
  groupVolume: (groupId: string) => ['sonos-group-volume', groupId] as const,
  playerVolume: (playerId: string) => ['sonos-player-volume', playerId] as const,
  services: (householdId: string) => ['sonos-services', householdId] as const,
  discover: ['sonos-discover'] as const,
};

// ─── Connection status ──────────────────────────────────────────────────────

export function useSonosStatus(enabled = true) {
  return useQuery<SonosStatus>({
    queryKey: sonosKeys.status,
    queryFn: () => apiClient.get<SonosStatus>('/api/sonos/status'),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Config (admin credentials) ─────────────────────────────────────────────

export function useSonosConfig() {
  return useQuery<{ configured: boolean; clientId: string | null; redirectUri: string | null }>({
    queryKey: sonosKeys.config,
    queryFn: () =>
      apiClient.get<{ configured: boolean; clientId: string | null; redirectUri: string | null }>(
        '/api/sonos/config',
      ),
  });
}

// ─── Households ─────────────────────────────────────────────────────────────

export function useSonosHouseholds(enabled = true) {
  return useQuery<{ households: SonosHousehold[] }>({
    queryKey: sonosKeys.households,
    queryFn: () => apiClient.get<{ households: SonosHousehold[] }>('/api/sonos/households'),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Groups + players (polls every 15s) ─────────────────────────────────────

export function useSonosGroups(
  householdId: string | undefined,
  enabled = true,
  refetchMs: number | false = 15_000,
) {
  return useQuery<SonosGroupsResponse>({
    queryKey: sonosKeys.groups(householdId ?? ''),
    queryFn: () =>
      apiClient.get<SonosGroupsResponse>(`/api/sonos/households/${householdId}/groups`),
    enabled: enabled && !!householdId,
    staleTime: 10_000,
    refetchInterval: refetchMs,
    retry: 1,
  });
}

// ─── Playback state (polls every 5s by default) ─────────────────────────────

export function useSonosPlaybackState(
  groupId: string | undefined,
  enabled = true,
  refetchMs: number | false = 5_000,
) {
  return useQuery<SonosPlaybackState>({
    queryKey: sonosKeys.playbackState(groupId ?? ''),
    queryFn: () => apiClient.get<SonosPlaybackState>(`/api/sonos/groups/${groupId}/playback`),
    enabled: enabled && !!groupId,
    staleTime: 3_000,
    refetchInterval: refetchMs,
    retry: 1,
  });
}

// ─── Metadata (polls every 5s by default) ───────────────────────────────────

export function useSonosMetadata(
  groupId: string | undefined,
  enabled = true,
  refetchMs: number | false = 5_000,
) {
  return useQuery<SonosMetadata>({
    queryKey: sonosKeys.metadata(groupId ?? ''),
    queryFn: () => apiClient.get<SonosMetadata>(`/api/sonos/groups/${groupId}/metadata`),
    enabled: enabled && !!groupId,
    staleTime: 3_000,
    refetchInterval: refetchMs,
    retry: 1,
  });
}

// ─── Volume (group) ─────────────────────────────────────────────────────────

export function useSonosGroupVolume(
  groupId: string | undefined,
  enabled = true,
  refetchMs: number | false = 10_000,
) {
  return useQuery<SonosVolumeState>({
    queryKey: sonosKeys.groupVolume(groupId ?? ''),
    queryFn: () => apiClient.get<SonosVolumeState>(`/api/sonos/groups/${groupId}/volume`),
    enabled: enabled && !!groupId,
    staleTime: 5_000,
    refetchInterval: refetchMs,
    retry: 1,
  });
}

// ─── Volume (player) ────────────────────────────────────────────────────────

export function useSonosPlayerVolume(playerId: string | undefined, enabled = true) {
  return useQuery<SonosVolumeState>({
    queryKey: sonosKeys.playerVolume(playerId ?? ''),
    queryFn: () => apiClient.get<SonosVolumeState>(`/api/sonos/players/${playerId}/volume`),
    enabled: enabled && !!playerId,
    staleTime: 5_000,
    retry: 1,
  });
}

// ─── Playback controls ─────────────────────────────────────────────────────

export function useSonosControls() {
  const qc = useQueryClient();

  const invalidateAll = (groupId?: string) => {
    if (groupId) {
      void qc.invalidateQueries({ queryKey: sonosKeys.playbackState(groupId) });
      void qc.invalidateQueries({ queryKey: sonosKeys.metadata(groupId) });
    }
  };

  const handleError = (err: unknown) => {
    const message = err instanceof ApiRequestError ? err.body.message : 'Sonos command failed';
    const status = err instanceof ApiRequestError ? err.status : 0;

    // Stale group — 404 or explicit "not found" means the group dissolved
    if (status === 404 || (typeof message === 'string' && message.includes('NOT_FOUND'))) {
      void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
      toast.info('Speaker group no longer exists — refreshing rooms');
      return;
    }

    // Don't toast recoverable Sonos errors — the widget handles fallback silently
    if (
      typeof message === 'string' &&
      (message.includes('DISALLOWED_BY_POLICY') || message.includes('PLAYBACK_NO_CONTENT'))
    )
      return;
    toast.error(message);
  };

  const play = useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/play`),
    onSuccess: (_d, vars) => invalidateAll(vars.groupId),
    onError: handleError,
  });

  const pause = useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/pause`),
    onSuccess: (_d, vars) => invalidateAll(vars.groupId),
    onError: handleError,
  });

  const next = useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/next`),
    onSuccess: (_d, vars) => invalidateAll(vars.groupId),
    onError: handleError,
  });

  const previous = useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/previous`),
    onSuccess: (_d, vars) => invalidateAll(vars.groupId),
    onError: handleError,
  });

  const setGroupVolume = useMutation({
    mutationFn: (params: { groupId: string; volume: number }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/volume`, {
        volume: params.volume,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: sonosKeys.groupVolume(vars.groupId) });
    },
    onError: handleError,
  });

  const setPlayerVolume = useMutation({
    mutationFn: (params: { playerId: string; volume: number }) =>
      apiClient.post(`/api/sonos/players/${params.playerId}/volume`, {
        volume: params.volume,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: sonosKeys.playerVolume(vars.playerId) });
    },
    onError: handleError,
  });

  const setGroupMute = useMutation({
    mutationFn: (params: { groupId: string; muted: boolean }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/mute`, {
        muted: params.muted,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: sonosKeys.groupVolume(vars.groupId) });
    },
    onError: handleError,
  });

  return { play, pause, next, previous, setGroupVolume, setPlayerVolume, setGroupMute };
}

// ─── Group modification (add/remove speakers) ──────────────────────────────

export function useSonosModifyGroup() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMutation({
    mutationFn: (params: {
      groupId: string;
      playerIdsToAdd?: string[];
      playerIdsToRemove?: string[];
    }) => apiClient.post<SonosGroupMutationResult>('/api/sonos/groups/modify', params),
    onSuccess: (result) => {
      if (result.failures.length > 0) {
        const failed = result.failures.map((failure) => failure.playerName ?? failure.playerId);
        toast.error(`Could not update ${failed.join(', ')}`);
      }
      // Sonos needs a moment to update zone topology after grouping changes
      timerRef.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
      }, 1000);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to modify group';
      toast.error(typeof message === 'string' ? message : 'Failed to modify group');
    },
  });
}

export function useResetSonosGroup() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.post<SonosGroupMutationResult>(
        `/api/sonos/groups/${encodeURIComponent(params.groupId)}/reset`,
      ),
    onSuccess: (result) => {
      if (result.failures.length > 0) {
        const failed = result.failures.map((failure) => failure.playerName ?? failure.playerId);
        toast.error(
          result.succeededPlayerIds.length > 0
            ? `Separated some rooms, but not ${failed.join(', ')}`
            : `Could not separate ${failed.join(', ')}`,
        );
      } else {
        toast.success('Rooms separated');
      }
      void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
      timerRef.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
      }, 1000);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiRequestError ? err.body.message : 'Failed to separate group';
      toast.error(typeof message === 'string' ? message : 'Failed to separate group');
    },
  });
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export function useSonosDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/api/sonos/disconnect'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sonosKeys.status });
      void qc.invalidateQueries({ queryKey: sonosKeys.households });
      void qc.invalidateQueries({ queryKey: ['sonos-services'] });
    },
  });
}

// ─── Favorites ──────────────────────────────────────────────────────────────

export interface SonosFavorite {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  service?: { name: string; id: string; sn?: number };
}

export type SonosServiceDiscoverySource = 'firmware' | 'favorite' | 'playback' | 'cloud-favorite';

export interface SonosServiceAccount {
  serialNumber: number;
  nickname?: string;
  label?: string;
  sources: SonosServiceDiscoverySource[];
}

export interface SonosMusicService {
  id: string;
  name: string;
  serviceId?: number;
  serviceType?: number;
  auth?: string;
  capabilities?: number;
  sources: SonosServiceDiscoverySource[];
  accounts: SonosServiceAccount[];
}

export interface SonosMusicServicesResult {
  services: SonosMusicService[];
  completeness: 'complete' | 'observed';
  warnings: string[];
}

export function useSonosFavorites(householdId: string | undefined) {
  return useQuery<SonosFavorite[]>({
    queryKey: ['sonos-favorites', householdId],
    queryFn: () => apiClient.get(`/api/sonos/households/${householdId}/favorites`),
    enabled: !!householdId,
    staleTime: 60_000,
  });
}

export function useSonosServices(householdId: string | undefined, enabled = true) {
  const query = householdId ? `?householdId=${encodeURIComponent(householdId)}` : '';
  return useQuery<SonosMusicServicesResult>({
    queryKey: sonosKeys.services(householdId ?? ''),
    queryFn: () => apiClient.get<SonosMusicServicesResult>(`/api/sonos/services${query}`),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useLoadFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; favoriteId: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/favorites`, {
        favoriteId: params.favoriteId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sonos-playback'] });
      void qc.invalidateQueries({ queryKey: ['sonos-metadata'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to load favorite';
      toast.error(typeof message === 'string' ? message : 'Failed to load favorite');
    },
  });
}

// ─── Mode management ────────────────────────────────────────────────────────

export function useSonosMode() {
  return useQuery<{ mode: 'cloud' | 'local' }>({
    queryKey: sonosKeys.mode,
    queryFn: () => apiClient.get<{ mode: 'cloud' | 'local' }>('/api/sonos/mode'),
  });
}

export function useSetSonosMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: 'cloud' | 'local') => apiClient.put('/api/sonos/mode', { mode }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sonosKeys.mode });
      void qc.invalidateQueries({ queryKey: sonosKeys.status });
      void qc.invalidateQueries({ queryKey: ['sonos-services'] });
      toast.success('Sonos mode updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Local discovery ────────────────────────────────────────────────────────

export interface DiscoveredSpeaker {
  name: string;
  ip: string;
  uuid: string;
  model?: string;
  modelNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  hardwareVersion?: string;
  stereoPair?: { role: 'left' | 'right'; partnerUuid: string; partnerName?: string };
}

export function useSonosDiscover(enabled = false) {
  return useQuery<{ speakers: DiscoveredSpeaker[] }>({
    queryKey: sonosKeys.discover,
    queryFn: () => apiClient.get<{ speakers: DiscoveredSpeaker[] }>('/api/sonos/discover'),
    enabled,
    staleTime: 60_000,
  });
}

// ─── Queue (local-only) ─────────────────────────────────────────────────────

export interface QueueItem {
  trackNumber: number;
  title: string;
  artist: string;
  album: string;
  imageUrl: string;
  duration: number;
  uri: string;
}

export interface QueueResponse {
  items: QueueItem[];
  currentTrack: number;
  localOnly?: boolean;
}

export function useSonosQueue(groupId: string | undefined, enabled = true) {
  return useQuery<QueueResponse>({
    queryKey: ['sonos-queue', groupId],
    queryFn: () => apiClient.get<QueueResponse>(`/api/sonos/groups/${groupId}/queue`),
    enabled: enabled && !!groupId,
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1,
  });
}

export function useClearQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string }) =>
      apiClient.delete(`/api/sonos/groups/${params.groupId}/queue`),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      void qc.invalidateQueries({ queryKey: sonosKeys.playbackState(vars.groupId) });
      void qc.invalidateQueries({ queryKey: sonosKeys.metadata(vars.groupId) });
      void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to clear queue';
      toast.error(typeof message === 'string' ? message : 'Failed to clear queue');
    },
  });
}

export function usePlayFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; trackNumber: number }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/queue/play`, {
        trackNumber: params.trackNumber,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      void qc.invalidateQueries({ queryKey: sonosKeys.playbackState(vars.groupId) });
      void qc.invalidateQueries({ queryKey: sonosKeys.metadata(vars.groupId) });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to play track';
      toast.error(typeof message === 'string' ? message : 'Failed to play track');
    },
  });
}

export function useAddToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; uri: string; metadata?: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/queue/add`, {
        uri: params.uri,
        metadata: params.metadata,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      toast.success('Added to queue');
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to add to queue';
      toast.error(typeof message === 'string' ? message : 'Failed to add to queue');
    },
  });
}

export function usePlayNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; uri: string; metadata?: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/queue/next`, {
        uri: params.uri,
        metadata: params.metadata,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      toast.success('Playing next');
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to play next';
      toast.error(typeof message === 'string' ? message : 'Failed to play next');
    },
  });
}

// ─── Container Queue Types ──────────────────────────────────────────────────

export interface ContainerQueueResponse {
  tracksAdded: number;
  totalFound: number;
  truncated: boolean;
  message?: string;
}

export function useAddContainerToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; objectId: string }) =>
      apiClient.post<ContainerQueueResponse>(
        `/api/sonos/groups/${params.groupId}/queue/add-container`,
        { objectId: params.objectId },
      ),
    onSuccess: (data, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      if (data.tracksAdded === 0) {
        toast.info(data.message ?? 'No tracks found in this container');
      } else {
        toast.success(data.message ?? `Added ${data.tracksAdded} tracks to queue`);
      }
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiRequestError ? err.body.message : 'Failed to add container to queue';
      toast.error(typeof message === 'string' ? message : 'Failed to add container to queue');
    },
  });
}

export function useReplaceQueueAndPlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; objectId: string }) =>
      apiClient.post<ContainerQueueResponse>(`/api/sonos/groups/${params.groupId}/queue/replace`, {
        objectId: params.objectId,
      }),
    onSuccess: (data, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      void qc.invalidateQueries({ queryKey: sonosKeys.playbackState(vars.groupId) });
      void qc.invalidateQueries({ queryKey: sonosKeys.metadata(vars.groupId) });
      if (data.tracksAdded === 0) {
        toast.info(data.message ?? 'No tracks found in this container');
      } else {
        toast.success(data.message ?? `Now playing: ${data.tracksAdded} tracks`);
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to replace queue';
      toast.error(typeof message === 'string' ? message : 'Failed to replace queue');
    },
  });
}

// ─── Music Library (local-only) ─────────────────────────────────────────────

export interface LibraryItem {
  title: string;
  uri: string;
  objectId?: string;
  imageUrl: string;
  metadata?: string;
  type: 'container' | 'track';
  artist?: string;
  album?: string;
}

export interface LibraryBrowseResponse {
  items: LibraryItem[];
  total: number;
  returned: number;
  localOnly?: boolean;
}

export function useMusicLibrary(
  type: string | undefined,
  options?: { start?: number; total?: number },
  enabled = true,
) {
  const start = options?.start ?? 0;
  const total = options?.total ?? 100;
  return useQuery<LibraryBrowseResponse>({
    queryKey: ['sonos-library', type, start, total],
    queryFn: () =>
      apiClient.get<LibraryBrowseResponse>(
        `/api/sonos/library/${type}?start=${start}&total=${total}`,
      ),
    enabled: enabled && !!type,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useSonosPlaylists(enabled = true) {
  return useQuery<LibraryBrowseResponse>({
    queryKey: ['sonos-playlists'],
    queryFn: () => apiClient.get<LibraryBrowseResponse>('/api/sonos/playlists'),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useBrowseContainer(
  objectId: string | undefined,
  options?: { start?: number; total?: number },
  enabled = true,
) {
  const start = options?.start ?? 0;
  const total = options?.total ?? 100;
  return useQuery<LibraryBrowseResponse>({
    queryKey: ['sonos-browse', objectId, start, total],
    queryFn: () =>
      apiClient.get<LibraryBrowseResponse>(
        `/api/sonos/library/browse?objectId=${encodeURIComponent(objectId!)}&start=${start}&total=${total}`,
      ),
    enabled: enabled && !!objectId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useSearchLibrary(
  type: string | undefined,
  searchTerm: string | undefined,
  options?: { start?: number; total?: number },
  enabled = true,
) {
  const start = options?.start ?? 0;
  const total = options?.total ?? 100;
  return useQuery<LibraryBrowseResponse>({
    queryKey: ['sonos-search', type, searchTerm, start, total],
    queryFn: () =>
      apiClient.get<LibraryBrowseResponse>(
        `/api/sonos/library/${type}/search?q=${encodeURIComponent(searchTerm!)}&start=${start}&total=${total}`,
      ),
    enabled: enabled && !!type && !!searchTerm && searchTerm.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

// ─── Play Mode (local-only) ─────────────────────────────────────────────────

export interface PlayModeState {
  shuffle: boolean;
  repeat: boolean;
  repeatOne: boolean;
}

export function useSonosPlayMode(
  groupId: string | undefined,
  enabled = true,
  refetchInterval: number | false = 10_000,
) {
  return useQuery<PlayModeState>({
    queryKey: ['sonos-playmode', groupId],
    queryFn: () => apiClient.get<PlayModeState>(`/api/sonos/groups/${groupId}/playmode`),
    enabled: enabled && !!groupId,
    staleTime: 5_000,
    refetchInterval,
    retry: 1,
  });
}

export function useSetPlayMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; state: PlayModeState }) =>
      apiClient.put(`/api/sonos/groups/${params.groupId}/playmode`, params.state),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-playmode', vars.groupId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to set play mode';
      toast.error(typeof message === 'string' ? message : 'Failed to set play mode');
    },
  });
}

// ─── Radio Stations (local-only) ────────────────────────────────────────────

export interface RadioStation {
  title: string;
  uri: string;
  imageUrl: string;
}

export function useRadioStations(enabled = true) {
  return useQuery<{ items: RadioStation[]; total: number; localOnly?: boolean }>({
    queryKey: ['sonos-radio-stations'],
    queryFn: () =>
      apiClient.get<{ items: RadioStation[]; total: number; localOnly?: boolean }>(
        '/api/sonos/radio/stations',
      ),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Play URI (spotify:/radio:/any) ─────────────────────────────────────────

export function usePlayUri() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { groupId: string; uri: string; title?: string }) =>
      apiClient.post(`/api/sonos/groups/${params.groupId}/play-uri`, {
        uri: params.uri,
        title: params.title,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['sonos-queue', vars.groupId] });
      void qc.invalidateQueries({ queryKey: sonosKeys.playbackState(vars.groupId) });
      void qc.invalidateQueries({ queryKey: sonosKeys.metadata(vars.groupId) });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to play';
      toast.error(typeof message === 'string' ? message : 'Failed to play');
    },
  });
}

// ─── Service Labels (account label management) ──────────────────────────────

export function useServiceLabels() {
  return useQuery<{ labels: Record<string, string> }>({
    queryKey: ['sonos-service-labels'],
    queryFn: () => apiClient.get<{ labels: Record<string, string> }>('/api/sonos/service-labels'),
    staleTime: 30_000,
  });
}

export function useUpdateServiceLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labels: Record<string, string>) =>
      apiClient.put<{ labels: Record<string, string> }>('/api/sonos/service-labels', labels),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sonos-service-labels'] });
      void qc.invalidateQueries({ queryKey: ['sonos-services'] });
      toast.success('Account labels saved');
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.body.message : 'Failed to save labels';
      toast.error(typeof message === 'string' ? message : 'Failed to save labels');
    },
  });
}
