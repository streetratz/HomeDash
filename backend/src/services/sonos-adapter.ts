/**
 * Sonos Adapter — delegates to Cloud API or Local UPnP based on config.
 *
 * Stores the mode ('cloud' | 'local') in integration_configs under 'sonos_mode'.
 * Cloud mode requires OAuth tokens; local mode discovers devices via SSDP.
 * The API routes call adapter functions instead of cloud/local directly.
 */

import { getIntegrationConfigs, setIntegrationConfigs } from './integrationConfigService.js';
import * as cloud from './sonos-service.js';
import * as local from './sonos-local-service.js';
import { artProxyPath } from './artCacheService.js';
import { Errors } from '../lib/errors.js';
import type {
  SonosMusicServicesResult,
  SonosServiceDiscoverySource,
} from './sonos-local-service.js';
import type {
  SonosHousehold,
  SonosGroupsResponse,
  SonosPlaybackState,
  SonosVolumeState,
  SonosMetadata,
  SonosFavorite,
} from './sonos-service.js';

// ─── Mode management ─────────────────────────────────────────────────────────

export type SonosMode = 'cloud' | 'local';

export function getSonosMode(): SonosMode {
  const cfg = getIntegrationConfigs('sonos_mode');
  return cfg['mode'] === 'cloud' ? 'cloud' : 'local';
}

export function setSonosMode(mode: SonosMode): void {
  setIntegrationConfigs('sonos_mode', { mode });
}

function isLocal(): boolean {
  return getSonosMode() === 'local';
}

// ─── Households ──────────────────────────────────────────────────────────────

export async function getHouseholds(userId: string): Promise<SonosHousehold[]> {
  if (isLocal()) return local.getHouseholds();
  return cloud.getHouseholds(userId);
}

// ─── Groups + Players ────────────────────────────────────────────────────────

export async function getGroups(userId: string, householdId: string): Promise<SonosGroupsResponse> {
  if (isLocal()) return local.getGroups();
  return cloud.getGroups(userId, householdId);
}

// ─── Playback state + metadata ───────────────────────────────────────────────

export async function getPlaybackState(
  userId: string,
  groupId: string,
): Promise<SonosPlaybackState> {
  if (isLocal()) return local.getPlaybackState(groupId);
  return cloud.getPlaybackState(userId, groupId);
}

export async function getPlaybackMetadata(userId: string, groupId: string): Promise<SonosMetadata> {
  const meta = isLocal()
    ? await local.getPlaybackMetadata(groupId)
    : await cloud.getPlaybackMetadata(userId, groupId);

  // Rewrite imageUrl to route through our art proxy
  const imgUrl = meta.currentItem?.track?.imageUrl;
  if (imgUrl && meta.currentItem?.track) {
    meta.currentItem.track.imageUrl = artProxyPath(imgUrl);
  }

  return meta;
}

// ─── Playback commands ───────────────────────────────────────────────────────

export async function play(userId: string, groupId: string): Promise<void> {
  if (isLocal()) return local.play(groupId);
  await cloud.sonosCommand(userId, `/groups/${encodeURIComponent(groupId)}/playback/play`);
}

export async function pause(userId: string, groupId: string): Promise<void> {
  if (isLocal()) return local.pause(groupId);
  await cloud.sonosCommand(userId, `/groups/${encodeURIComponent(groupId)}/playback/pause`);
}

export async function next(userId: string, groupId: string): Promise<void> {
  if (isLocal()) return local.next(groupId);
  await cloud.sonosCommand(
    userId,
    `/groups/${encodeURIComponent(groupId)}/playback/skipToNextTrack`,
  );
}

export async function previous(userId: string, groupId: string): Promise<void> {
  if (isLocal()) return local.previous(groupId);
  await cloud.sonosCommand(
    userId,
    `/groups/${encodeURIComponent(groupId)}/playback/skipToPreviousTrack`,
  );
}

// ─── Volume ──────────────────────────────────────────────────────────────────

export async function getGroupVolume(userId: string, groupId: string): Promise<SonosVolumeState> {
  if (isLocal()) return local.getGroupVolume(groupId);
  return cloud.getGroupVolume(userId, groupId);
}

export async function setGroupVolume(
  userId: string,
  groupId: string,
  volume: number,
): Promise<void> {
  if (isLocal()) return local.setGroupVolume(groupId, volume);
  await cloud.sonosCommand(userId, `/groups/${encodeURIComponent(groupId)}/groupVolume`, {
    volume,
  });
}

export async function setGroupMute(userId: string, groupId: string, muted: boolean): Promise<void> {
  if (isLocal()) return local.setGroupMute(groupId, muted);
  await cloud.sonosCommand(userId, `/groups/${encodeURIComponent(groupId)}/groupVolume/mute`, {
    muted,
  });
}

export async function getPlayerVolume(userId: string, playerId: string): Promise<SonosVolumeState> {
  if (isLocal()) return local.getPlayerVolume(playerId);
  return cloud.getPlayerVolume(userId, playerId);
}

export async function setPlayerVolume(
  userId: string,
  playerId: string,
  volume: number,
): Promise<void> {
  if (isLocal()) return local.setPlayerVolume(playerId, volume);
  await cloud.sonosCommand(userId, `/players/${encodeURIComponent(playerId)}/playerVolume`, {
    volume,
  });
}

export async function setPlayerMute(
  userId: string,
  playerId: string,
  muted: boolean,
): Promise<void> {
  if (isLocal()) return local.setPlayerMute(playerId, muted);
  await cloud.sonosCommand(userId, `/players/${encodeURIComponent(playerId)}/playerVolume/mute`, {
    muted,
  });
}

// ─── Group management ────────────────────────────────────────────────────────

export async function modifyGroup(
  userId: string,
  groupId: string,
  playerIdsToAdd: string[],
  playerIdsToRemove: string[],
): Promise<local.SonosGroupMutationResult | void> {
  if (isLocal()) return local.modifyGroup(groupId, playerIdsToAdd, playerIdsToRemove);
  await cloud.sonosCommand(
    userId,
    `/groups/${encodeURIComponent(groupId)}/groups/modifyGroupMembers`,
    { playerIdsToAdd, playerIdsToRemove },
  );
}

export async function resetGroup(
  _userId: string,
  groupId: string,
): Promise<local.SonosGroupMutationResult> {
  if (!isLocal()) {
    throw Errors.badRequest('Separating Sonos groups is available in local mode only');
  }
  try {
    return await local.resetGroup(groupId);
  } catch (error) {
    if (error instanceof local.SonosGroupNotFoundError) {
      throw Errors.notFound('Sonos group not found');
    }
    throw error;
  }
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function getFavorites(userId: string, householdId: string): Promise<SonosFavorite[]> {
  const favs = isLocal()
    ? await local.getFavorites()
    : await cloud.getFavorites(userId, householdId);

  // Proxy art URLs through our cache to avoid CORS / mixed-content issues
  for (const fav of favs) {
    if (fav.imageUrl) fav.imageUrl = artProxyPath(fav.imageUrl);
  }
  return favs;
}

export async function getMusicServices(
  userId: string,
  householdId?: string,
): Promise<SonosMusicServicesResult> {
  if (isLocal()) {
    return local.getMusicServices();
  }

  if (!householdId) {
    return {
      services: [],
      completeness: 'observed',
      warnings: ['household_required_for_cloud_discovery'],
    };
  }

  const favorites = await cloud.getFavorites(userId, householdId);
  const source: SonosServiceDiscoverySource = 'cloud-favorite';
  return local.aggregateMusicServices({
    catalog: [],
    firmwareAccounts: [],
    observations: favorites
      .map((favorite) => favorite.service?.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((serviceName) => ({ source, serviceName })),
    inventoryAvailable: false,
    warnings: ['cloud_service_inventory_is_favorites_only'],
  });
}

export async function loadFavorite(
  userId: string,
  groupId: string,
  favoriteId: string,
  playOnCompletion: boolean,
): Promise<void> {
  if (isLocal()) {
    await local.loadFavorite(groupId, parseInt(favoriteId, 10));
    return;
  }
  await cloud.loadFavorite(userId, groupId, favoriteId, playOnCompletion);
}

// ─── Queue (local-only) ──────────────────────────────────────────────────────

export type {
  QueueItem,
  LibraryItem,
  LibraryBrowseResult,
  LibraryType,
  PlayModeState,
  DetectedService,
  DiscoveredSpeaker,
  StereoPairInfo,
  SonosMusicService,
  SonosMusicServicesResult,
  SonosServiceAccount,
  SonosServiceDiscoverySource,
  ContainerQueueRequest,
  ContainerQueueResponse,
  ResolvedTrack,
} from './sonos-local-service.js';

export async function getQueue(
  _userId: string,
  groupId: string,
): Promise<{ items: local.QueueItem[]; currentTrack: number; localOnly?: boolean }> {
  if (isLocal()) return local.getQueue(groupId);
  return { items: [], currentTrack: 0, localOnly: true };
}

export async function clearQueue(_userId: string, groupId: string): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Queue clearing is available in local mode only');
  }
  await local.clearQueue(groupId);
}

export async function playFromQueue(
  _userId: string,
  groupId: string,
  trackNumber: number,
): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Queue playback is available in local mode only');
  }
  await local.playFromQueue(groupId, trackNumber);
}

export async function addToQueue(
  _userId: string,
  groupId: string,
  uri: string,
  metadata?: string,
): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Adding to the Sonos queue is available in local mode only');
  }
  await local.addToQueue(groupId, uri, metadata);
}

export async function playNext(
  _userId: string,
  groupId: string,
  uri: string,
  metadata?: string,
): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Playing next is available in local mode only');
  }
  await local.playNext(groupId, uri, metadata);
}

export async function addContainerToQueue(
  _userId: string,
  groupId: string,
  objectId: string,
): Promise<local.ContainerQueueResponse> {
  if (!isLocal()) {
    throw Errors.badRequest('Container queue mutations are available in local mode only');
  }
  return local.addContainerToQueue(groupId, objectId);
}

export async function replaceQueueAndPlay(
  _userId: string,
  groupId: string,
  objectId: string,
): Promise<local.ContainerQueueResponse> {
  if (!isLocal()) {
    throw Errors.badRequest('Container queue mutations are available in local mode only');
  }
  return local.replaceQueueAndPlay(groupId, objectId);
}

// ─── Music Library (local-only) ──────────────────────────────────────────────

export async function browseLibrary(
  _userId: string,
  type: string,
  options?: { start?: number; total?: number },
): Promise<local.LibraryBrowseResult & { localOnly?: boolean }> {
  if (isLocal()) return local.browseLibrary(type, options);
  return { items: [], total: 0, returned: 0, localOnly: true };
}

export async function browseContainer(
  _userId: string,
  objectId: string,
  options?: { start?: number; total?: number },
): Promise<local.LibraryBrowseResult & { localOnly?: boolean }> {
  if (isLocal()) return local.browseContainer(objectId, options);
  return { items: [], total: 0, returned: 0, localOnly: true };
}

export async function searchLibrary(
  _userId: string,
  type: string,
  searchTerm: string,
  options?: { start?: number; total?: number },
): Promise<local.LibraryBrowseResult & { localOnly?: boolean }> {
  if (isLocal()) return local.searchLibrary(type, searchTerm, options);
  return { items: [], total: 0, returned: 0, localOnly: true };
}

export async function getSonosPlaylists(
  _userId: string,
): Promise<local.LibraryBrowseResult & { localOnly?: boolean }> {
  if (isLocal()) return local.getSonosPlaylists();
  return { items: [], total: 0, returned: 0, localOnly: true };
}

// ─── Radio Stations (local-only) ────────────────────────────────────────────

export async function getRadioStations(
  _userId: string,
): Promise<{ items: local.RadioStation[]; total: number; localOnly?: boolean }> {
  if (isLocal()) return local.getFavoritesRadioStations();
  return { items: [], total: 0, localOnly: true };
}

// ─── Play URI (local-only) ──────────────────────────────────────────────────

export async function playUri(
  _userId: string,
  groupId: string,
  uri: string,
  title?: string,
): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Playing a URI is available in local mode only');
  }
  await local.playUri(groupId, uri, title);
}

// ─── Play Mode (local-only) ─────────────────────────────────────────────────

export async function getPlayMode(
  _userId: string,
  groupId: string,
): Promise<local.PlayModeState | null> {
  if (isLocal()) return local.getPlayMode(groupId);
  return null;
}

export async function setPlayMode(
  _userId: string,
  groupId: string,
  state: local.PlayModeState,
): Promise<void> {
  if (!isLocal()) {
    throw Errors.badRequest('Changing Sonos play mode is available in local mode only');
  }
  await local.setPlayMode(groupId, state);
}

// ─── Local-only: Discovery info ──────────────────────────────────────────────

export { getDiscoveredSpeakers, runDiagnostics } from './sonos-local-service.js';

// ─── Status helper ───────────────────────────────────────────────────────────

export interface SonosAdapterStatus {
  mode: SonosMode;
  connected: boolean;
  displayName?: string;
  householdId?: string;
  speakerCount?: number;
}

export async function getAdapterStatus(userId: string): Promise<SonosAdapterStatus> {
  const mode = getSonosMode();

  if (mode === 'local') {
    const speakers = await local.getDiscoveredSpeakers();
    return {
      mode: 'local',
      connected: speakers.length > 0,
      displayName: 'Local Network',
      householdId: 'local',
      speakerCount: speakers.length,
    };
  }

  // Cloud mode
  const account = cloud.getSonosAccount(userId);
  if (!account) {
    return { mode: 'cloud', connected: false };
  }

  const status: SonosAdapterStatus = {
    mode: 'cloud',
    connected: true,
    householdId: account.providerAccountId,
  };
  if (account.displayName) status.displayName = account.displayName;
  return status;
}
