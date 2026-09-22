/**
 * Sonos Local Service — UPnP control via node-sonos.
 *
 * Discovers Sonos speakers on the LAN and provides playback, volume,
 * grouping, and favorites through local network calls (no cloud API).
 *
 * Output shapes match the existing Cloud API service so the REST
 * routes can delegate to either backend transparently.
 */

import { AsyncDeviceDiscovery, Services } from 'sonos';
import { getIntegrationConfig } from './integrationConfigService.js';
import type {
  SonosZoneGroup,
  SonosZoneMember,
  SonosFavoriteItem,
  SonosTrack,
  PlayState,
  Sonos,
} from 'sonos';

// Re-export cloud-compatible types used by the API routes
import type {
  SonosHousehold,
  SonosPlayer,
  SonosGroup,
  SonosGroupsResponse,
  SonosPlaybackState,
  SonosVolumeState,
  SonosMetadata,
  SonosFavorite,
} from './sonos-service.js';

// ─── Device Cache ───────────────────────────────────────────────────────────

import { getEnv } from '../config/env.js';
import { getAppLogger } from '../lib/logger.js';
import { AppError, ErrorCode } from '../lib/errors.js';
import { format } from 'node:util';

const SONOS_DEBUG = ['debug', 'trace'].includes(getEnv().LOG_LEVEL);

function sonosDebug(msg: string, ...args: unknown[]): void {
  if (SONOS_DEBUG) {
    getAppLogger().debug({ component: 'sonos-local' }, format(msg, ...args));
  }
}

function sonosWarn(msg: string, ...args: unknown[]): void {
  getAppLogger().warn({ component: 'sonos-local' }, format(msg, ...args));
}

function sonosError(msg: string, ...args: unknown[]): void {
  const error = args.at(-1);
  const messageArgs = error instanceof Error ? args.slice(0, -1) : args;
  getAppLogger().error(
    { component: 'sonos-local', ...(error instanceof Error ? { err: error } : {}) },
    format(msg, ...messageArgs),
  );
}

/** Stereo pair channel info for a speaker. */
export interface StereoPairInfo {
  role: 'left' | 'right';
  partnerUuid: string;
  partnerName?: string;
}

/** Structured result from detectServiceFromUri(). */
export interface DetectedService {
  service: string;
  sid?: number;
  sn?: number;
  accountLabel?: string;
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

export interface AvailableServiceDescriptor {
  serviceId: number;
  serviceType: number;
  name: string;
  auth?: string;
  capabilities?: number;
}

export interface FirmwareServiceAccount {
  serviceType: number;
  serialNumber: number;
  nickname?: string;
}

export interface ServiceObservation {
  source: SonosServiceDiscoverySource;
  serviceId?: number;
  accountSerial?: number;
  serviceName?: string;
}

export interface SonosGroupMutationFailure {
  playerId: string;
  playerName?: string;
  operation: 'add' | 'remove';
  message: string;
}

export interface SonosGroupMutationResult {
  succeededPlayerIds: string[];
  failures: SonosGroupMutationFailure[];
}

export class SonosGroupNotFoundError extends Error {
  constructor() {
    super('Sonos group not found');
    this.name = 'SonosGroupNotFoundError';
  }
}

export class SonosContentDirectoryUnavailableError extends AppError {
  constructor() {
    super(
      ErrorCode.SONOS_UPSTREAM_UNAVAILABLE,
      'Sonos music library is temporarily unavailable. Try again.',
      502,
    );
    this.name = 'SonosContentDirectoryUnavailableError';
  }
}

interface SonosReadCandidate<TDevice> {
  name: string;
  uuid: string;
  model?: string;
  modelNumber?: string;
  device: TDevice;
}

const SOUNDBAR_MODEL_NAMES = ['arc', 'beam', 'playbar', 'playbase', 'ray'];
const PORTABLE_MODEL_NAMES = ['move', 'roam'];

function hasDeviceKeyword(value: string, keywords: readonly string[]): boolean {
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/);
  return keywords.some((keyword) => tokens.includes(keyword));
}

function contentDirectoryDevicePriority(candidate: SonosReadCandidate<unknown>): number {
  const identity = `${candidate.model ?? ''} ${candidate.modelNumber ?? ''} ${candidate.name}`;
  if (hasDeviceKeyword(identity, SOUNDBAR_MODEL_NAMES)) return 0;
  if (hasDeviceKeyword(identity, PORTABLE_MODEL_NAMES)) return 2;
  return 1;
}

export function orderSonosContentDirectoryCandidates<TDevice>(
  candidates: readonly SonosReadCandidate<TDevice>[],
): SonosReadCandidate<TDevice>[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        contentDirectoryDevicePriority(left.candidate) -
          contentDirectoryDevicePriority(right.candidate) || left.index - right.index,
    )
    .map(({ candidate }) => candidate);
}

export async function readFromFirstResponsiveDevice<TDevice, TResult>(
  candidates: readonly SonosReadCandidate<TDevice>[],
  operation: string,
  read: (device: TDevice) => Promise<TResult>,
): Promise<TResult> {
  let lastError: unknown;
  let failedDevices = 0;

  for (const candidate of orderSonosContentDirectoryCandidates(candidates)) {
    try {
      const result = await read(candidate.device);
      if (failedDevices > 0) {
        sonosWarn(
          '%s recovered using %s (%s) after %d failed device(s)',
          operation,
          candidate.name,
          candidate.uuid,
          failedDevices,
        );
      } else {
        sonosDebug('%s succeeded on %s (%s)', operation, candidate.name, candidate.uuid);
      }
      return result;
    } catch (error) {
      lastError = error;
      failedDevices += 1;
      sonosWarn(
        '%s failed on %s (%s); trying another discovered device',
        operation,
        candidate.name,
        candidate.uuid,
      );
    }
  }

  if (lastError !== undefined) {
    sonosError(`${operation} failed on all ${candidates.length} discovered devices:`, lastError);
  } else {
    sonosWarn('%s could not run because no Sonos devices are available', operation);
  }

  throw new SonosContentDirectoryUnavailableError();
}

function isInvisibleZoneMember(member: SonosZoneMember): boolean {
  return member.Invisible === true || member.Invisible === '1';
}

interface CachedDevice {
  device: Sonos;
  ip: string;
  name: string;
  uuid: string;
  model?: string;
  modelNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  hardwareVersion?: string;
}

/** Map of UUID → CachedDevice for all discovered speakers. */
const deviceCache = new Map<string, CachedDevice>();

/** Timestamp of last successful discovery. */
let lastDiscoveryAt = 0;

/** Whether a discovery is currently in progress. */
let discoveryInProgress = false;

const DISCOVERY_INTERVAL_MS = 30_000; // re-discover every 30s
const DISCOVERY_TIMEOUT_MS = 5_000; // per-scan timeout

/**
 * Discover Sonos devices on the LAN.
 * Populates the device cache and returns the list of found devices.
 */
export async function discoverDevices(): Promise<CachedDevice[]> {
  if (discoveryInProgress) {
    // Return current cache if a scan is already running
    return [...deviceCache.values()];
  }

  discoveryInProgress = true;
  try {
    const discovery = new AsyncDeviceDiscovery();
    sonosDebug('Starting device discovery (timeout=%dms)', DISCOVERY_TIMEOUT_MS);
    const devices = await discovery.discoverMultiple({ timeout: DISCOVERY_TIMEOUT_MS });
    sonosDebug('Discovery found %d raw devices', devices.length);

    // Enrich each device with name + UUID, then cache
    const enriched = await Promise.allSettled(
      devices.map(async (d) => {
        const desc = await d.deviceDescription();
        const info = await d.getZoneInfo();
        const entry: CachedDevice = {
          device: d,
          ip: d.host,
          name: desc.roomName || desc.friendlyName || d.host,
          uuid: desc.UDN?.replace('uuid:', '') || `RINCON_${info.MACAddress.replace(/:/g, '')}`,
          ...(desc.modelName && { model: String(desc.modelName) }),
          ...(desc.modelNumber && { modelNumber: String(desc.modelNumber) }),
          ...(info.SoftwareVersion && { softwareVersion: String(info.SoftwareVersion) }),
          ...(info.SerialNumber && { serialNumber: String(info.SerialNumber) }),
          ...(info.HardwareVersion && { hardwareVersion: String(info.HardwareVersion) }),
        };
        return entry;
      }),
    );

    for (const result of enriched) {
      if (result.status === 'fulfilled') {
        deviceCache.set(result.value.uuid, result.value);
      }
    }

    lastDiscoveryAt = Date.now();
    return [...deviceCache.values()];
  } finally {
    discoveryInProgress = false;
  }
}

/**
 * Ensure device cache is warm — runs discovery if stale.
 */
async function ensureDiscovered(): Promise<void> {
  if (deviceCache.size === 0 || Date.now() - lastDiscoveryAt > DISCOVERY_INTERVAL_MS) {
    await discoverDevices();
  }
}

/** Get a device by its UUID (or IP fallback). */
function getDevice(id: string): Sonos | undefined {
  const cached = deviceCache.get(id);
  if (cached) return cached.device;
  // Fallback: try by IP
  for (const entry of deviceCache.values()) {
    if (entry.ip === id) return entry.device;
  }
  return undefined;
}

/** Get the coordinator device for a group ID. */
async function getCoordinatorForGroup(groupId: string): Promise<Sonos> {
  await ensureDiscovered();

  // groupId might be the coordinator UUID directly
  const direct = getDevice(groupId);
  if (direct) return direct;

  // groupId format is often RINCON_xxx:nnn — try the UUID part
  const uuidPart = groupId.split(':').slice(0, -1).join(':');
  if (uuidPart) {
    const byUuid = getDevice(uuidPart);
    if (byUuid) return byUuid;
  }

  // Search through zone groups and resolve to our cached device
  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) throw new Error('No Sonos devices found on network');

  const groups = await anyDevice.device.getAllGroups();
  for (const g of groups) {
    if (g.ID === groupId || g.Name === groupId) {
      // Prefer our cached device over CoordinatorDevice()
      const coordUuid = g.ID?.split(':')[0] ?? '';
      const cached = coordUuid ? getDevice(coordUuid) : undefined;
      if (cached) return cached;
      return g.CoordinatorDevice();
    }
    // Also match by coordinator UUID
    const coordinator = g.ZoneGroupMember.find(
      (m) => m.UUID === groupId || g.ID.startsWith(groupId),
    );
    if (coordinator) {
      const cached = getDevice(coordinator.UUID);
      if (cached) return cached;
      return g.CoordinatorDevice();
    }
  }

  throw new Error(`Group not found: ${groupId}`);
}

/** Get all member devices for a group (for group-wide operations like volume) */
async function getMembersForGroup(groupId: string): Promise<Sonos[]> {
  await ensureDiscovered();

  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) throw new Error('No Sonos devices found on network');

  const groups = await anyDevice.device.getAllGroups();
  for (const g of groups) {
    const isMatch =
      g.ID === groupId ||
      g.Name === groupId ||
      g.ZoneGroupMember.some((m) => m.UUID === groupId || g.ID.startsWith(groupId));
    if (isMatch) {
      const devices: Sonos[] = [];
      for (const m of g.ZoneGroupMember) {
        const cached = getDevice(m.UUID);
        if (cached) devices.push(cached);
      }
      // Fallback to coordinator only if no members resolved
      if (devices.length === 0) {
        devices.push(await getCoordinatorForGroup(groupId));
      }
      return devices;
    }
  }

  // Fallback: single device
  const coord = await getCoordinatorForGroup(groupId);
  return [coord];
}

// ─── Household (virtual — local has no households) ──────────────────────────

const LOCAL_HOUSEHOLD_ID = 'local';

export async function getHouseholds(): Promise<SonosHousehold[]> {
  await ensureDiscovered();
  if (deviceCache.size === 0) return [];
  return [{ id: LOCAL_HOUSEHOLD_ID, name: 'Local Network' }];
}

// ─── Groups & Players ───────────────────────────────────────────────────────

function memberToPlayer(m: SonosZoneMember): SonosPlayer {
  return {
    id: m.UUID,
    name: m.ZoneName,
    capabilities: [],
    deviceIds: [m.UUID],
  };
}

function zoneGroupToGroup(g: SonosZoneGroup, invisibleUuids: Set<string>): SonosGroup {
  // Extract coordinator UUID from group ID (format: "UUID:nnn") — more reliable
  // than ZoneGroupMember[0] which may be an invisible stereo pair partner
  const coordinatorId = g.ID.split(':')[0] ?? g.ZoneGroupMember[0]?.UUID ?? '';
  const visibleMembers = g.ZoneGroupMember.filter((m) => !invisibleUuids.has(m.UUID));
  const playerIds = visibleMembers.map((m) => m.UUID);

  // Sonos may include invisible bonded members in its generated group name.
  // Rebuild only those affected names from visible room identities so a stereo
  // pair remains one room without erasing other manually grouped rooms.
  const visibleNames = [
    ...new Set(visibleMembers.map((member) => member.ZoneName).filter(Boolean)),
  ];
  const name =
    visibleMembers.length < g.ZoneGroupMember.length && visibleNames.length > 0
      ? visibleNames.join(' + ')
      : g.Name;

  return {
    id: g.ID,
    name,
    coordinatorId,
    playerIds,
    playbackState: 'PLAYBACK_STATE_IDLE',
  };
}

export function normalizeZoneTopology(zoneGroups: SonosZoneGroup[]): SonosGroupsResponse {
  const invisibleUuids = new Set<string>();
  for (const group of zoneGroups) {
    for (const member of group.ZoneGroupMember ?? []) {
      if (isInvisibleZoneMember(member)) invisibleUuids.add(member.UUID);
    }
  }

  const visibleGroups = zoneGroups.filter((group) =>
    (group.ZoneGroupMember ?? []).some((member) => !invisibleUuids.has(member.UUID)),
  );
  const groups = visibleGroups.map((group) => zoneGroupToGroup(group, invisibleUuids));
  const playerSet = new Map<string, SonosPlayer>();

  for (const group of visibleGroups) {
    for (const member of group.ZoneGroupMember ?? []) {
      if (!invisibleUuids.has(member.UUID) && !playerSet.has(member.UUID)) {
        playerSet.set(member.UUID, memberToPlayer(member));
      }
    }
  }

  return { groups, players: [...playerSet.values()] };
}

export async function getGroups(): Promise<SonosGroupsResponse> {
  await ensureDiscovered();

  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) return { groups: [], players: [] };

  const zoneGroups = await anyDevice.device.getAllGroups();

  const normalized = normalizeZoneTopology(zoneGroups);
  const { groups } = normalized;

  // Fetch actual playback state for each group's coordinator
  await Promise.all(
    groups.map(async (group) => {
      try {
        const device = getDevice(group.coordinatorId);
        if (device) {
          const state = await device.getCurrentState();
          group.playbackState = STATE_MAP[state] ?? 'PLAYBACK_STATE_IDLE';
        }
      } catch {
        // Leave as IDLE if we can't reach the coordinator
      }
    }),
  );

  return normalized;
}

// ─── Playback State ─────────────────────────────────────────────────────────

const STATE_MAP: Record<PlayState, string> = {
  playing: 'PLAYBACK_STATE_PLAYING',
  paused: 'PLAYBACK_STATE_PAUSED',
  stopped: 'PLAYBACK_STATE_IDLE',
  transitioning: 'PLAYBACK_STATE_BUFFERING',
  no_media: 'PLAYBACK_STATE_IDLE',
};

export async function getPlaybackState(groupId: string): Promise<SonosPlaybackState> {
  const device = await getCoordinatorForGroup(groupId);
  const state = await device.getCurrentState();
  return {
    playbackState: STATE_MAP[state] ?? 'PLAYBACK_STATE_IDLE',
    positionMillis: 0,
  };
}

// ─── Metadata ───────────────────────────────────────────────────────────────

function resolveArtUrl(track: SonosTrack, device: Sonos): string | undefined {
  const art = track.albumArtURL || track.albumArtURI;
  if (!art) return undefined;
  // Absolute URL — return as-is
  if (art.startsWith('http://') || art.startsWith('https://')) return art;
  // Relative — prepend device base URL
  return `http://${device.host}:${device.port || 1400}${art}`;
}

/** Resolve a raw albumArtURI (may be relative) to an absolute URL using any available device. */
function resolveRawArtUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) return undefined;
  return `http://${anyDevice.device.host}:${anyDevice.device.port || 1400}${raw}`;
}

// Sonos service number → friendly name
const SERVICE_ID_NAME_MAP: Record<number, string> = {
  // YouTube Music (varies by region)
  284: 'YouTube Music',
  305: 'YouTube Music',
  // Spotify
  9: 'Spotify',
  2311: 'Spotify',
  // Apple Music
  204: 'Apple Music',
  52: 'Apple Music',
  // Amazon Music
  201: 'Amazon Music',
  203: 'Amazon Music',
  // TuneIn
  254: 'TuneIn',
  303: 'TuneIn',
  // Deezer
  2: 'Deezer',
  // Tidal
  44551: 'Tidal',
  // SoundCloud
  160: 'SoundCloud',
};

const MAX_ACCOUNT_XML_BYTES = 256 * 1024;
const MAX_CATALOG_XML_CHARS = 1024 * 1024;
const ACCOUNT_REQUEST_TIMEOUT_MS = 3_000;
const SONOS_UPNP_PORT = 1400;

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity: string, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&#(\d+);/g, (entity: string, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function parseXmlAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([A-Za-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name = match[1];
    const rawValue = match[2] ?? match[3];
    if (name && rawValue !== undefined) {
      attributes[name] = decodeXmlText(rawValue);
    }
  }
  return attributes;
}

function parseBoundedInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,10}$/.test(value)) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function serviceSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parseAvailableServiceDescriptors(xml: string): AvailableServiceDescriptor[] {
  const services: AvailableServiceDescriptor[] = [];
  for (const match of xml.matchAll(/<Service\b([^>]*)>([\s\S]*?)<\/Service>/gi)) {
    const attributes = parseXmlAttributes(match[1] ?? '');
    const serviceId = parseBoundedInteger(attributes['Id']);
    const name = attributes['Name']?.trim();
    if (serviceId === undefined || !name) continue;

    const policyMatch = (match[2] ?? '').match(/<Policy\b([^>]*)\/?>/i);
    const policy = parseXmlAttributes(policyMatch?.[1] ?? '');
    const capabilities = parseBoundedInteger(attributes['Capabilities']);

    services.push({
      serviceId,
      serviceType: serviceId * 256 + 7,
      name,
      ...(policy['Auth'] && { auth: policy['Auth'] }),
      ...(capabilities !== undefined && { capabilities }),
    });
  }
  return services;
}

export function parseFirmwareServiceAccounts(xml: string): {
  accounts: FirmwareServiceAccount[];
  inventoryAvailable: boolean;
} {
  const accounts: FirmwareServiceAccount[] = [];
  const inventoryAvailable = /<Accounts\b/i.test(xml);

  for (const match of xml.matchAll(/<Account\b([^>]*)>([\s\S]*?)<\/Account>/gi)) {
    const attributes = parseXmlAttributes(match[1] ?? '');
    if (attributes['Deleted'] === '1') continue;

    const serviceType = parseBoundedInteger(attributes['Type']);
    const serialNumber = parseBoundedInteger(attributes['SerialNum']);
    if (serviceType === undefined || serialNumber === undefined) continue;

    const nicknameMatch = (match[2] ?? '').match(/<NN>([\s\S]*?)<\/NN>/i);
    const nickname = nicknameMatch?.[1] ? decodeXmlText(nicknameMatch[1]).trim() : '';

    accounts.push({
      serviceType,
      serialNumber,
      ...(nickname && { nickname }),
    });
  }

  return { accounts, inventoryAvailable };
}

export function extractServiceObservation(
  value: string,
  source: SonosServiceDiscoverySource,
): ServiceObservation | undefined {
  const serviceIdMatch = value.match(/(?:[?&]|&amp;)sid=(\d{1,10})/i);
  const accountMatch = value.match(/(?:[?&]|&amp;)sn=(\d{1,10})/i);
  const serviceId = parseBoundedInteger(serviceIdMatch?.[1]);
  const accountSerial = parseBoundedInteger(accountMatch?.[1]);
  const detected = detectServiceFromUri(value);

  if (serviceId === undefined && accountSerial === undefined && !detected?.service) {
    return undefined;
  }

  return {
    source,
    ...(serviceId !== undefined && { serviceId }),
    ...(accountSerial !== undefined && { accountSerial }),
    ...(detected?.service && { serviceName: detected.service }),
  };
}

export function aggregateMusicServices(input: {
  catalog: AvailableServiceDescriptor[];
  firmwareAccounts: FirmwareServiceAccount[];
  observations: ServiceObservation[];
  labels?: Record<string, string>;
  inventoryAvailable: boolean;
  warnings?: string[];
}): SonosMusicServicesResult {
  const catalogById = new Map(input.catalog.map((service) => [service.serviceId, service]));
  const catalogByType = new Map(input.catalog.map((service) => [service.serviceType, service]));
  const services = new Map<
    string,
    {
      descriptor?: AvailableServiceDescriptor;
      name: string;
      sources: Set<SonosServiceDiscoverySource>;
      accounts: Map<
        number,
        {
          nickname?: string;
          sources: Set<SonosServiceDiscoverySource>;
        }
      >;
    }
  >();

  const ensureService = (
    descriptor: AvailableServiceDescriptor | undefined,
    name: string | undefined,
  ) => {
    const resolvedName = descriptor?.name ?? name?.trim();
    if (!resolvedName) return undefined;
    const key = descriptor ? `sid:${descriptor.serviceId}` : `name:${serviceSlug(resolvedName)}`;
    let service = services.get(key);
    if (!service) {
      service = {
        ...(descriptor && { descriptor }),
        name: resolvedName,
        sources: new Set(),
        accounts: new Map(),
      };
      services.set(key, service);
    } else if (service.name.startsWith('Service ') && !resolvedName.startsWith('Service ')) {
      service.name = resolvedName;
      if (descriptor) service.descriptor = descriptor;
    }
    return service;
  };

  for (const account of input.firmwareAccounts) {
    const catalogDescriptor = catalogByType.get(account.serviceType);
    const inferredServiceId =
      (account.serviceType - 7) % 256 === 0 ? (account.serviceType - 7) / 256 : undefined;
    const inferredName =
      inferredServiceId !== undefined ? SERVICE_ID_NAME_MAP[inferredServiceId] : undefined;
    const descriptor =
      catalogDescriptor ??
      (inferredServiceId !== undefined
        ? {
            serviceId: inferredServiceId,
            serviceType: account.serviceType,
            name: inferredName ?? `Service ${account.serviceType}`,
          }
        : undefined);
    const service = ensureService(descriptor, `Service ${account.serviceType}`);
    if (!service) continue;
    service.sources.add('firmware');
    service.accounts.set(account.serialNumber, {
      ...(account.nickname && { nickname: account.nickname }),
      sources: new Set(['firmware']),
    });
  }

  for (const observation of input.observations) {
    const fallbackName =
      observation.serviceName ??
      (observation.serviceId !== undefined
        ? SERVICE_ID_NAME_MAP[observation.serviceId]
        : undefined);
    const descriptor =
      observation.serviceId !== undefined
        ? (catalogById.get(observation.serviceId) ?? {
            serviceId: observation.serviceId,
            serviceType: observation.serviceId * 256 + 7,
            name: fallbackName ?? `Service ${observation.serviceId * 256 + 7}`,
          })
        : undefined;
    const service = ensureService(descriptor, fallbackName);
    if (!service) continue;

    service.sources.add(observation.source);
    if (observation.accountSerial !== undefined) {
      const account = service.accounts.get(observation.accountSerial) ?? {
        sources: new Set<SonosServiceDiscoverySource>(),
      };
      account.sources.add(observation.source);
      service.accounts.set(observation.accountSerial, account);
    }
  }

  const labels = input.labels ?? {};
  const result = [...services.entries()]
    .map(([id, service]): SonosMusicService => {
      const descriptor = service.descriptor;
      return {
        id,
        name: service.name,
        ...(descriptor && {
          serviceId: descriptor.serviceId,
          serviceType: descriptor.serviceType,
        }),
        ...(descriptor?.auth && { auth: descriptor.auth }),
        ...(descriptor?.capabilities !== undefined && {
          capabilities: descriptor.capabilities,
        }),
        sources: [...service.sources].sort(),
        accounts: [...service.accounts.entries()]
          .map(
            ([serialNumber, account]): SonosServiceAccount => ({
              serialNumber,
              ...(account.nickname && { nickname: account.nickname }),
              ...(labels[`sn:${serialNumber}`] && { label: labels[`sn:${serialNumber}`] }),
              sources: [...account.sources].sort(),
            }),
          )
          .sort((a, b) => a.serialNumber - b.serialNumber),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    services: result,
    completeness: input.inventoryAvailable ? 'complete' : 'observed',
    warnings: [...new Set(input.warnings ?? [])],
  };
}

/** Read account labels from integration_configs (provider='sonos', key='account_labels'). */
export function getAccountLabels(): Record<string, string> {
  const raw = getIntegrationConfig('sonos', 'account_labels');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Detect streaming service from a Sonos content URI. Returns structured result. */
export function detectServiceFromUri(uri: string): DetectedService | undefined {
  // Extract sid= and sn= from URI params
  const sidMatch = uri.match(/[?&]sid=(\d+)/);
  const snMatch = uri.match(/[?&]sn=(\d+)/);
  const sid = sidMatch ? Number(sidMatch[1]) : undefined;
  const sn = snMatch ? Number(snMatch[1]) : undefined;

  let service: string | undefined;

  // Name-based detection (highest priority)
  if (uri.includes('spotify')) service = 'Spotify';
  else if (uri.includes('youtube')) service = 'YouTube Music';
  else if (uri.includes('apple')) service = 'Apple Music';
  else if (uri.includes('amazon')) service = 'Amazon Music';
  else if (uri.includes('tunein') || uri.includes('radio')) service = 'TuneIn';
  else if (uri.includes('deezer')) service = 'Deezer';
  else if (uri.includes('tidal')) service = 'Tidal';
  else if (uri.includes('soundcloud')) service = 'SoundCloud';

  // Fallback: detect from the Sonos service ID. Account serials are not service IDs.
  if (!service) {
    if (sid !== undefined) service = SERVICE_ID_NAME_MAP[sid];
  }

  if (!service) return undefined;

  // Resolve account label from stored config
  let accountLabel: string | undefined;
  if (sn !== undefined) {
    const labels = getAccountLabels();
    accountLabel = labels[`sn:${sn}`];
  }

  return {
    service,
    ...(sid !== undefined && { sid }),
    ...(sn !== undefined && { sn }),
    ...(accountLabel && { accountLabel }),
  };
}

export async function getPlaybackMetadata(groupId: string): Promise<SonosMetadata> {
  const device = await getCoordinatorForGroup(groupId);
  const track = await device.currentTrack();

  if (!track || !track.title) {
    return { currentItem: {} };
  }

  const imageUrl = resolveArtUrl(track, device);

  const detected = detectServiceFromUri(track.uri ?? '');

  const trackInfo: NonNullable<SonosMetadata['currentItem']>['track'] = {
    name: track.title,
    type: 'track',
  };
  if (imageUrl) trackInfo.imageUrl = imageUrl;
  if (track.artist) trackInfo.artist = { name: track.artist };
  if (track.album) trackInfo.album = { name: track.album };
  if (track.duration) trackInfo.durationMillis = track.duration * 1000;
  if (detected) {
    trackInfo.service = {
      name: detected.service,
      ...(detected.sn !== undefined && { sn: detected.sn }),
      ...(detected.accountLabel && { accountLabel: detected.accountLabel }),
    };
  }

  return { currentItem: { track: trackInfo } };
}

// ─── Playback Controls ──────────────────────────────────────────────────────

export async function play(groupId: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.play();
}

export async function pause(groupId: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.pause();
}

export async function next(groupId: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.next();
}

export async function previous(groupId: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.previous();
}

// ─── Volume ─────────────────────────────────────────────────────────────────

export async function getGroupVolume(groupId: string): Promise<SonosVolumeState> {
  const device = await getCoordinatorForGroup(groupId);
  const volume = await device.getVolume();
  const muted = await device.getMuted();
  return { volume, muted, fixed: false };
}

export async function setGroupVolume(groupId: string, volume: number): Promise<void> {
  const coordinator = await getCoordinatorForGroup(groupId);
  const clamped = Math.max(0, Math.min(100, volume));
  await coordinator.setVolume(clamped);
}

export async function setGroupMute(groupId: string, muted: boolean): Promise<void> {
  const members = await getMembersForGroup(groupId);
  await Promise.all(members.map((d) => d.setMuted(muted)));
}

export async function getPlayerVolume(playerId: string): Promise<SonosVolumeState> {
  await ensureDiscovered();
  const device = getDevice(playerId);
  if (!device) throw new Error(`Player not found: ${playerId}`);
  const volume = await device.getVolume();
  const muted = await device.getMuted();
  return { volume, muted, fixed: false };
}

export async function setPlayerVolume(playerId: string, volume: number): Promise<void> {
  await ensureDiscovered();
  const device = getDevice(playerId);
  if (!device) throw new Error(`Player not found: ${playerId}`);
  await device.setVolume(Math.max(0, Math.min(100, volume)));
}

export async function setPlayerMute(playerId: string, muted: boolean): Promise<void> {
  await ensureDiscovered();
  const device = getDevice(playerId);
  if (!device) throw new Error(`Player not found: ${playerId}`);
  await device.setMuted(muted);
}

// ─── Grouping ───────────────────────────────────────────────────────────────

export async function modifyGroup(
  groupId: string,
  playerIdsToAdd: string[],
  playerIdsToRemove: string[],
): Promise<SonosGroupMutationResult> {
  await ensureDiscovered();

  // Get coordinator name for the target group
  const coordinator = await getCoordinatorForGroup(groupId);
  const coordName = await coordinator.getName();
  const coordinatorId = groupId.split(':')[0] ?? groupId;

  const result: SonosGroupMutationResult = { succeededPlayerIds: [], failures: [] };

  // Add players: each joins the coordinator's group
  for (const pid of playerIdsToAdd) {
    const device = getDevice(pid);
    if (device) {
      try {
        await device.joinGroup(coordName);
        result.succeededPlayerIds.push(pid);
      } catch (err) {
        sonosError(`joinGroup('${coordName}') failed for ${pid}:`, err);
        result.failures.push({
          playerId: pid,
          ...(deviceCache.get(pid)?.name ? { playerName: deviceCache.get(pid)!.name } : {}),
          operation: 'add',
          message: 'Failed to join group',
        });
      }
    } else {
      sonosError(`modifyGroup: device not found for pid=${pid}`);
      result.failures.push({
        playerId: pid,
        operation: 'add',
        message: 'Player not found',
      });
    }
  }

  // Remove players: each leaves to become standalone
  for (const pid of playerIdsToRemove) {
    if (pid === coordinatorId) {
      result.failures.push({
        playerId: pid,
        ...(deviceCache.get(pid)?.name ? { playerName: deviceCache.get(pid)!.name } : {}),
        operation: 'remove',
        message: 'The coordinator cannot leave its own group',
      });
      continue;
    }
    const device = getDevice(pid);
    if (device) {
      try {
        await device.leaveGroup();
        result.succeededPlayerIds.push(pid);
      } catch (err) {
        sonosError(`leaveGroup() failed for ${pid}:`, err);
        result.failures.push({
          playerId: pid,
          ...(deviceCache.get(pid)?.name ? { playerName: deviceCache.get(pid)!.name } : {}),
          operation: 'remove',
          message: 'Failed to leave group',
        });
      }
    } else {
      sonosError(`modifyGroup: device not found for pid=${pid}`);
      result.failures.push({
        playerId: pid,
        operation: 'remove',
        message: 'Player not found',
      });
    }
  }

  return result;
}

export function getResettablePlayerIds(group: SonosGroup): string[] {
  return group.playerIds.filter((playerId) => playerId !== group.coordinatorId);
}

export async function resetGroup(groupId: string): Promise<SonosGroupMutationResult> {
  const topology = await getGroups();
  const group = topology.groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new SonosGroupNotFoundError();

  return modifyGroup(group.id, [], getResettablePlayerIds(group));
}

// ─── Favorites ──────────────────────────────────────────────────────────────

export async function getFavorites(): Promise<SonosFavorite[]> {
  await ensureDiscovered();

  const result = await readFromFirstResponsiveDevice(
    [...deviceCache.values()],
    'getFavorites()',
    (device) => device.getFavorites(),
  );

  if (!result || !result.items) {
    return [];
  }

  return (result.items || []).map((item: SonosFavoriteItem, i: number) => {
    const resolvedArt = resolveRawArtUrl(item.albumArtURI);
    const detected = detectServiceFromUri(item.uri ?? '');
    const svcName = detected?.service ?? 'Sonos';
    return {
      id: String(i),
      name: item.title,
      imageUrl: resolvedArt ?? '',
      service: {
        name: svcName,
        id: svcName.toLowerCase().replace(/\s+/g, '_'),
        ...(detected?.sn != null && { sn: detected.sn }),
      },
    };
  });
}

interface RawMusicServicesDiscovery {
  catalog: AvailableServiceDescriptor[];
  firmwareAccounts: FirmwareServiceAccount[];
  observations: ServiceObservation[];
  inventoryAvailable: boolean;
  warnings: string[];
}

let musicServicesCache:
  | {
      expiresAt: number;
      discovery: RawMusicServicesDiscovery;
    }
  | undefined;

async function readBoundedResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Sonos account response exceeded the size limit');
  }

  if (!response.body) {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      throw new Error('Sonos account response exceeded the size limit');
    }
    return body;
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error('Sonos account response exceeded the size limit');
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

async function discoverRawMusicServices(): Promise<RawMusicServicesDiscovery> {
  await ensureDiscovered();
  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) {
    return {
      catalog: [],
      firmwareAccounts: [],
      observations: [],
      inventoryAvailable: false,
      warnings: ['no_sonos_devices'],
    };
  }

  const warnings: string[] = [];
  let catalog: AvailableServiceDescriptor[] = [];
  let firmwareAccounts: FirmwareServiceAccount[] = [];
  let inventoryAvailable = false;
  const observations: ServiceObservation[] = [];

  try {
    const service = new Services.MusicServices(anyDevice.device.host, SONOS_UPNP_PORT);
    const result = await service.ListAvailableServices();
    const descriptorXml = result.AvailableServiceDescriptorList ?? '';
    if (descriptorXml.length > MAX_CATALOG_XML_CHARS) {
      throw new Error('Sonos service catalog exceeded the size limit');
    }
    catalog = parseAvailableServiceDescriptors(descriptorXml);
  } catch {
    warnings.push('catalog_unavailable');
  }

  try {
    const response = await fetch(
      `http://${anyDevice.device.host}:${SONOS_UPNP_PORT}/status/accounts`,
      {
        redirect: 'error',
        signal: AbortSignal.timeout(ACCOUNT_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Sonos account endpoint returned HTTP ${response.status}`);
    }
    const accountXml = await readBoundedResponseText(response, MAX_ACCOUNT_XML_BYTES);
    const parsed = parseFirmwareServiceAccounts(accountXml);
    firmwareAccounts = parsed.accounts;
    inventoryAvailable = parsed.inventoryAvailable;
    if (!inventoryAvailable) warnings.push('firmware_account_inventory_unavailable');
  } catch {
    warnings.push('firmware_account_inventory_unavailable');
  }

  try {
    const favorites = await anyDevice.device.getFavorites();
    for (const item of favorites?.items ?? []) {
      const observation = extractServiceObservation(
        `${item.uri ?? ''} ${item.metadata ?? ''}`,
        'favorite',
      );
      if (observation) observations.push(observation);
    }
  } catch {
    warnings.push('favorites_unavailable');
  }

  const devices = [...deviceCache.values()].slice(0, 32);
  const tracks = await Promise.allSettled(devices.map(({ device }) => device.currentTrack()));
  let playbackSucceeded = false;
  for (const trackResult of tracks) {
    if (trackResult.status !== 'fulfilled') continue;
    playbackSucceeded = true;
    const observation = extractServiceObservation(trackResult.value?.uri ?? '', 'playback');
    if (observation) observations.push(observation);
  }
  if (devices.length > 0 && !playbackSucceeded) warnings.push('playback_unavailable');

  return {
    catalog,
    firmwareAccounts,
    observations,
    inventoryAvailable,
    warnings,
  };
}

export async function getMusicServices(): Promise<SonosMusicServicesResult> {
  const now = Date.now();
  if (!musicServicesCache || musicServicesCache.expiresAt <= now) {
    musicServicesCache = {
      expiresAt: now + 60_000,
      discovery: await discoverRawMusicServices(),
    };
  }

  return aggregateMusicServices({
    ...musicServicesCache.discovery,
    labels: getAccountLabels(),
  });
}

export async function loadFavorite(groupId: string, favoriteIndex: number): Promise<void> {
  await ensureDiscovered();

  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) throw new Error('No Sonos devices found');

  const result = await anyDevice.device.getFavorites();
  const item = result.items[favoriteIndex];
  if (!item) throw new Error(`Favorite not found at index ${favoriteIndex}`);

  const device = await getCoordinatorForGroup(groupId);
  const opts: { uri: string; metadata?: string } = { uri: item.uri };
  if (item.metadata) opts.metadata = item.metadata;
  await device.setAVTransportURI(opts);
  await device.play();
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export interface QueueItem {
  trackNumber: number;
  title: string;
  artist: string;
  album: string;
  imageUrl: string;
  duration: number; // seconds
  uri: string;
}

export async function getQueue(
  groupId: string,
): Promise<{ items: QueueItem[]; currentTrack: number }> {
  const device = await getCoordinatorForGroup(groupId);
  const result = await device.getQueue();
  const current = await device.currentTrack();

  // Determine current queue index from position info
  // node-sonos currentTrack().position is time position, not queue index
  // We match by title+artist to find current item
  let currentIndex = -1;
  const items: QueueItem[] = (result.items || []).map((t: SonosTrack, i: number) => {
    if (
      currentIndex === -1 &&
      current &&
      t.title === current.title &&
      t.artist === current.artist
    ) {
      currentIndex = i;
    }
    const art = t.albumArtURI || t.albumArtURL;
    let imageUrl = '';
    if (art) {
      imageUrl = art.startsWith('http')
        ? art
        : `http://${device.host}:${device.port || 1400}${art}`;
    }
    return {
      trackNumber: i + 1,
      title: t.title || 'Unknown',
      artist: t.artist || '',
      album: t.album || '',
      imageUrl,
      duration: t.duration || 0,
      uri: t.uri ?? '',
    };
  });

  return { items, currentTrack: currentIndex + 1 }; // 1-based
}

export async function clearQueue(groupId: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.flush();
}

export async function playFromQueue(groupId: string, trackNumber: number): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.selectTrack(trackNumber);
  await device.play();
}

export async function addToQueue(groupId: string, uri: string, metadata?: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  if (metadata) {
    await device.queue({ uri, metadata });
  } else {
    await device.queue(uri);
  }
}

// ─── Play Next (insert after currently playing) ────────────────────────────

export async function playNext(groupId: string, uri: string, metadata?: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);

  // Get current track position so we insert right after it
  const svc = (
    device as unknown as {
      avTransportService: () => {
        GetPositionInfo: () => Promise<{ Track?: string | number } | null>;
        AddURIToQueue: (args: Record<string, unknown>) => Promise<unknown>;
      };
    }
  ).avTransportService();

  const info = await svc.GetPositionInfo();
  const currentTrack = info?.Track ? Number(info.Track) : 1;

  await svc.AddURIToQueue({
    InstanceID: 0,
    EnqueuedURI: uri,
    EnqueuedURIMetaData: metadata ?? '',
    DesiredFirstTrackNumberEnqueued: currentTrack + 1,
    EnqueueAsNext: 1,
  });
}

// ─── Container Queue Types ──────────────────────────────────────────────────

/** Request body for adding a container's tracks to the queue. */
export interface ContainerQueueRequest {
  uri: string;
  objectId: string;
}

/** Response body for container queue operations. */
export interface ContainerQueueResponse {
  tracksAdded: number;
  totalFound: number;
  truncated: boolean;
  message?: string;
}

/** Internal type used during container track resolution. */
export interface ResolvedTrack {
  uri: string;
  metadata?: string;
  title: string;
}

/** Maximum tracks per container queue operation (V-04). */
const MAX_CONTAINER_TRACKS = 1_000;

// ─── Music Library & Playlists ──────────────────────────────────────────────

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

export interface LibraryBrowseResult {
  items: LibraryItem[];
  total: number;
  returned: number;
}

const VALID_LIBRARY_TYPES = [
  'artists',
  'albumArtists',
  'albums',
  'genres',
  'tracks',
  'playlists',
  'sonos_playlists',
  'share',
] as const;

export type LibraryType = (typeof VALID_LIBRARY_TYPES)[number];

export function isValidLibraryType(t: string): t is LibraryType {
  return (VALID_LIBRARY_TYPES as readonly string[]).includes(t);
}

export function normalizeSonosObjectId(value: string): string {
  const hashIndex = value.indexOf('#');
  const objectId = hashIndex >= 0 ? value.slice(hashIndex + 1) : value;
  if (objectId.startsWith('x-file-cifs://')) {
    return `S://${objectId.slice('x-file-cifs://'.length)}`;
  }
  return objectId;
}

export async function browseLibrary(
  type: string,
  options?: { start?: number; total?: number },
): Promise<LibraryBrowseResult> {
  await ensureDiscovered();

  // For 'share' type, use browseContainer('S:') directly to preserve
  // raw ObjectIDs needed for sub-folder drill-down. getMusicLibrary's
  // dropIDNamespace mangles S:// paths, breaking folder navigation.
  if (type === 'share') {
    return browseContainer('S:', options);
  }

  const result = await readFromFirstResponsiveDevice(
    [...deviceCache.values()],
    `browseLibrary('${type}')`,
    (device) =>
      device.getMusicLibrary(type, {
        start: options?.start ?? 0,
        total: options?.total ?? 100,
      }),
  );

  if (!result || !result.items) {
    return { items: [], total: 0, returned: 0 };
  }

  const items: LibraryItem[] = (result.items || []).map((item: SonosFavoriteItem) => {
    const isTrack = type === 'tracks';
    return mapLibraryItem(item, isTrack);
  });

  return {
    items,
    total: result.total ?? items.length,
    returned: result.returned ?? items.length,
  };
}

/**
 * Browse into a container by its ObjectID (extracted from the item's URI fragment).
 * The URI format is: x-rincon-playlist:RINCON_xxx#<ObjectID>
 * e.g. ObjectID = "A:ARTIST/AC%2FDC" → browse AC/DC's albums
 * e.g. ObjectID = "S://media.home.arpa/music" -> browse folder contents
 *
 * Items whose URI contains a file-cifs reference (actual audio file) are tracks;
 * items whose URI still uses x-rincon-playlist with an ObjectID are containers.
 */
export async function browseContainer(
  objectId: string,
  options?: { start?: number; total?: number },
): Promise<LibraryBrowseResult> {
  await ensureDiscovered();
  const normalizedId = normalizeSonosObjectId(objectId);
  const result = await readFromFirstResponsiveDevice(
    [...deviceCache.values()],
    `browseContainer('${normalizedId}')`,
    async (device) => {
      const dev = device as unknown as {
        contentDirectoryService: () => {
          GetResult: (opts: Record<string, unknown>) => Promise<{
            items?: SonosFavoriteItem[];
            total?: number;
            returned?: number;
          } | null>;
        };
      };

      return dev.contentDirectoryService().GetResult({
        BrowseFlag: 'BrowseDirectChildren',
        Filter: '*',
        StartingIndex: String(options?.start ?? 0),
        RequestedCount: String(options?.total ?? 100),
        SortCriteria: '',
        ObjectID: normalizedId,
      });
    },
  );

  if (!result || !result.items) {
    return { items: [], total: 0, returned: 0 };
  }

  const items: LibraryItem[] = (result.items || []).map((item: SonosFavoriteItem) => {
    // Determine if item is a track (playable audio) vs container (drillable folder).
    // When browsing share ObjectIDs (S: prefix), items are folders unless they
    // have an audio file extension — CIFS folder URIs also start with x-file-cifs:.
    const uri = item.uri ?? '';
    const isBrowsingShares = normalizedId === 'S:' || normalizedId.startsWith('S://');
    const hasAudioExtension = /\.(mp3|flac|m4a|wav|wma|ogg|aac|aiff|alac)$/i.test(uri);

    const isContainer =
      uri.startsWith('x-rincon-playlist:') ||
      uri.startsWith('S:') ||
      (isBrowsingShares && !hasAudioExtension) ||
      (!uri.startsWith('x-file-cifs:') && !uri.startsWith('http') && !uri.includes('.'));
    return mapLibraryItem(item, !isContainer);
  });

  return {
    items,
    total: result.total ?? items.length,
    returned: result.returned ?? items.length,
  };
}

// ─── Container Track Resolution ─────────────────────────────────────────────

/**
 * Recursively resolve all leaf tracks within a container.
 * Browses the container's children, drills into sub-containers,
 * and collects all track URIs up to MAX_CONTAINER_TRACKS.
 */
export async function resolveContainerTracks(objectId: string): Promise<ResolvedTrack[]> {
  const tracks: ResolvedTrack[] = [];
  sonosDebug(`resolveContainerTracks: starting resolution for objectId="${objectId}"`);

  async function recurse(oid: string, depth: number): Promise<void> {
    if (tracks.length >= MAX_CONTAINER_TRACKS) return;
    if (depth > 10) {
      sonosWarn(`resolveContainerTracks: max depth (10) reached at objectId="${oid}"`);
      return;
    }

    let start = 0;
    const batchSize = 100;

    while (true) {
      if (tracks.length >= MAX_CONTAINER_TRACKS) return;

      const result = await browseContainer(oid, { start, total: batchSize });
      if (!result.items.length) break;

      for (const item of result.items) {
        if (tracks.length >= MAX_CONTAINER_TRACKS) return;

        if (item.type === 'track') {
          const resolved: ResolvedTrack = { uri: item.uri, title: item.title };
          if (item.metadata) resolved.metadata = item.metadata;
          tracks.push(resolved);
        } else {
          await recurse(item.objectId ?? normalizeSonosObjectId(item.uri), depth + 1);
        }
      }

      // If we got fewer items than requested, we've reached the end
      if (result.items.length < batchSize || result.items.length >= result.total) break;
      start += result.items.length;
    }
  }

  await recurse(objectId, 0);
  sonosDebug(`resolveContainerTracks: resolved ${tracks.length} tracks for objectId="${objectId}"`);
  return tracks;
}

/**
 * Add all tracks from a container to the end of a group's queue.
 * Resolves tracks recursively, then enqueues each one sequentially.
 */
export async function addContainerToQueue(
  groupId: string,
  objectId: string,
): Promise<ContainerQueueResponse> {
  sonosDebug(`addContainerToQueue: groupId="${groupId}", objectId="${objectId}"`);

  const tracks = await resolveContainerTracks(objectId);
  const totalFound = tracks.length;
  const truncated = totalFound >= MAX_CONTAINER_TRACKS;

  if (totalFound === 0) {
    sonosWarn(`addContainerToQueue: no tracks found for objectId="${objectId}"`);
    return {
      tracksAdded: 0,
      totalFound: 0,
      truncated: false,
      message: 'No tracks found in this container',
    };
  }

  const device = await getCoordinatorForGroup(groupId);
  let tracksAdded = 0;

  for (const track of tracks) {
    try {
      if (track.metadata) {
        await device.queue({ uri: track.uri, metadata: track.metadata });
      } else {
        await device.queue(track.uri);
      }
      tracksAdded++;
    } catch (err) {
      sonosError(`addContainerToQueue: failed to enqueue track "${track.title}":`, err);
    }
  }

  const message = `Added ${tracksAdded} track${tracksAdded !== 1 ? 's' : ''} to queue`;
  sonosDebug(`addContainerToQueue: ${message}`);
  return { tracksAdded, totalFound, truncated, message };
}

/**
 * Replace the queue with all tracks from a container and start playback.
 * Clears queue → resolves tracks → enqueues → selects track 1 → plays.
 */
export async function replaceQueueAndPlay(
  groupId: string,
  objectId: string,
): Promise<ContainerQueueResponse> {
  sonosDebug(`replaceQueueAndPlay: groupId="${groupId}", objectId="${objectId}"`);

  const device = await getCoordinatorForGroup(groupId);

  // Step 1: Clear queue
  try {
    await device.flush();
  } catch (err) {
    sonosError('replaceQueueAndPlay: failed to clear queue:', err);
    throw new Error('Failed to clear queue');
  }

  // Step 2: Resolve and enqueue tracks
  const tracks = await resolveContainerTracks(objectId);
  const totalFound = tracks.length;
  const truncated = totalFound >= MAX_CONTAINER_TRACKS;

  if (totalFound === 0) {
    sonosWarn(`replaceQueueAndPlay: no tracks found for objectId="${objectId}"`);
    return {
      tracksAdded: 0,
      totalFound: 0,
      truncated: false,
      message: 'No tracks found in this container',
    };
  }

  let tracksAdded = 0;
  for (const track of tracks) {
    try {
      if (track.metadata) {
        await device.queue({ uri: track.uri, metadata: track.metadata });
      } else {
        await device.queue(track.uri);
      }
      tracksAdded++;
    } catch (err) {
      sonosError(`replaceQueueAndPlay: failed to enqueue track "${track.title}":`, err);
    }
  }

  if (tracksAdded === 0) {
    return { tracksAdded: 0, totalFound, truncated, message: 'Failed to add any tracks to queue' };
  }

  // Step 3: Start playback from track 1
  try {
    await device.selectTrack(1);
    await device.play();
  } catch (err) {
    sonosError('replaceQueueAndPlay: tracks added but playback failed to start:', err);
    return {
      tracksAdded,
      totalFound,
      truncated,
      message: `Tracks added but playback failed to start`,
    };
  }

  const message = `Now playing: ${tracksAdded} track${tracksAdded !== 1 ? 's' : ''}`;
  sonosDebug(`replaceQueueAndPlay: ${message}`);
  return { tracksAdded, totalFound, truncated, message };
}

/**
 * Search across the music library using the ':' separator (prefix search).
 * e.g. searchLibrary('artists', 'Metal') → finds artists matching "Metal*"
 */
export async function searchLibrary(
  type: string,
  searchTerm: string,
  options?: { start?: number; total?: number },
): Promise<LibraryBrowseResult> {
  await ensureDiscovered();
  const result = await readFromFirstResponsiveDevice(
    [...deviceCache.values()],
    `searchLibrary('${type}')`,
    async (device) => {
      const dev = device as unknown as {
        searchMusicLibrary: (
          type: string,
          term: string | null,
          opts: Record<string, unknown>,
          separator: string,
        ) => Promise<{ items?: SonosFavoriteItem[]; total?: number; returned?: number } | null>;
      };

      return dev.searchMusicLibrary(
        type,
        searchTerm,
        {
          start: options?.start ?? 0,
          total: options?.total ?? 100,
        },
        ':',
      );
    },
  );

  if (!result || !result.items) {
    return { items: [], total: 0, returned: 0 };
  }

  const isTrackType = type === 'tracks';
  const items: LibraryItem[] = (result.items || []).map((item: SonosFavoriteItem) => {
    return mapLibraryItem(item, isTrackType);
  });

  return {
    items,
    total: result.total ?? items.length,
    returned: result.returned ?? items.length,
  };
}

/** Map a raw Sonos item to our LibraryItem shape */
function mapLibraryItem(item: SonosFavoriteItem, isTrack: boolean): LibraryItem {
  const entry: LibraryItem = {
    title: item.title,
    uri: item.uri,
    imageUrl: item.albumArtURI ?? '',
    type: isTrack ? ('track' as const) : ('container' as const),
  };
  if (!isTrack) entry.objectId = normalizeSonosObjectId(item.uri);
  if (item.metadata) entry.metadata = item.metadata;
  // Access dynamic fields via index signature
  const artist = item['artist'] ?? item['creator'];
  if (artist) entry.artist = artist;
  const album = item['album'];
  if (album) entry.album = album;
  return entry;
}

export async function getSonosPlaylists(): Promise<LibraryBrowseResult> {
  return browseLibrary('sonos_playlists');
}

// ─── Radio Stations ─────────────────────────────────────────────────────────

export interface RadioStation {
  title: string;
  uri: string;
  imageUrl: string;
}

export async function getFavoritesRadioStations(): Promise<{
  items: RadioStation[];
  total: number;
}> {
  await ensureDiscovered();
  const result = await readFromFirstResponsiveDevice(
    [...deviceCache.values()],
    'getFavoritesRadioStations()',
    async (device) => {
      const dev = device as unknown as {
        getFavoritesRadioStations: (opts: {
          start: number;
          total: number;
        }) => Promise<{ items?: SonosFavoriteItem[]; total?: number } | null>;
      };
      return dev.getFavoritesRadioStations({ start: 0, total: 100 });
    },
  );
  if (!result || !result.items) return { items: [], total: 0 };

  const items: RadioStation[] = (result.items || []).map((item: SonosFavoriteItem) => ({
    title: item.title,
    uri: item.uri,
    imageUrl: item.albumArtURI ?? '',
  }));

  return { items, total: result.total ?? items.length };
}

// ─── Play URI (Spotify/Radio/Any) ───────────────────────────────────────────

/**
 * Play a URI on a group. Handles spotify:, radio:, and other URIs
 * via node-sonos GenerateMetadata helper (auto-converts to Sonos format).
 */
export async function playUri(groupId: string, uri: string, _title?: string): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  const coordinatorUuid = groupId.split(':')[0];

  await device.flush();
  await device.queue(uri);
  // Point transport at the queue so play() works after flush
  await device.setAVTransportURI({ uri: `x-rincon-queue:${coordinatorUuid}#0` });
  await device.play();
}

// ─── Play Mode ──────────────────────────────────────────────────────────────

export interface PlayModeState {
  shuffle: boolean;
  repeat: boolean;
  repeatOne: boolean;
}

const PLAY_MODE_MAP: Record<string, PlayModeState> = {
  NORMAL: { shuffle: false, repeat: false, repeatOne: false },
  REPEAT_ALL: { shuffle: false, repeat: true, repeatOne: false },
  REPEAT_ONE: { shuffle: false, repeat: false, repeatOne: true },
  SHUFFLE_NOREPEAT: { shuffle: true, repeat: false, repeatOne: false },
  SHUFFLE: { shuffle: true, repeat: true, repeatOne: false },
  SHUFFLE_REPEAT_ONE: { shuffle: true, repeat: false, repeatOne: true },
};

function playModeFromState(state: PlayModeState): string {
  if (state.shuffle && state.repeatOne) return 'SHUFFLE_REPEAT_ONE';
  if (state.shuffle && state.repeat) return 'SHUFFLE';
  if (state.shuffle) return 'SHUFFLE_NOREPEAT';
  if (state.repeatOne) return 'REPEAT_ONE';
  if (state.repeat) return 'REPEAT_ALL';
  return 'NORMAL';
}

export async function getPlayMode(groupId: string): Promise<PlayModeState> {
  const device = await getCoordinatorForGroup(groupId);
  const mode = await device.getPlayMode();
  return PLAY_MODE_MAP[mode] ?? PLAY_MODE_MAP['NORMAL']!;
}

export async function setPlayMode(groupId: string, state: PlayModeState): Promise<void> {
  const device = await getCoordinatorForGroup(groupId);
  await device.setPlayMode(playModeFromState(state));
}

// ─── Discovery Info (for settings UI) ───────────────────────────────────────

export interface DiscoveredSpeaker {
  uuid: string;
  name: string;
  ip: string;
  model?: string;
  modelNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  hardwareVersion?: string;
  stereoPair?: StereoPairInfo;
}

/**
 * Diagnostic function — tests library connectivity and returns raw results.
 * Used to debug Docker/NAS environments where library returns empty.
 */
export async function runDiagnostics(): Promise<Record<string, unknown>> {
  const diag: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // 1. Discovery info
  await ensureDiscovered();
  const devices = [...deviceCache.values()].map((d) => ({
    name: d.name,
    ip: d.ip,
    uuid: d.uuid,
    model: d.model,
  }));
  diag['discoveredDevices'] = devices;
  diag['deviceCount'] = devices.length;

  const anyDevice = deviceCache.values().next().value;
  if (!anyDevice) {
    diag['error'] = 'No devices discovered';
    return diag;
  }
  diag['testDevice'] = { name: anyDevice.name, ip: anyDevice.ip, uuid: anyDevice.uuid };

  // 2. Test getMusicLibrary('artists') — the simplest library call
  try {
    const artistResult = await anyDevice.device.getMusicLibrary('artists', { start: 0, total: 5 });
    diag['getMusicLibrary_artists'] = {
      total: artistResult?.total ?? null,
      returned: artistResult?.returned ?? null,
      itemCount: artistResult?.items?.length ?? 0,
      firstItem: artistResult?.items?.[0]?.title ?? null,
      raw: artistResult ? { total: artistResult.total, returned: artistResult.returned } : null,
    };
  } catch (err) {
    diag['getMusicLibrary_artists'] = { error: String(err) };
  }

  // 3. Test contentDirectoryService for share folders (ObjectID: "S:")
  try {
    const dev = anyDevice.device as unknown as {
      contentDirectoryService: () => {
        GetResult: (opts: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const shareResult = await dev.contentDirectoryService().GetResult({
      ObjectID: 'S:',
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '5',
      SortCriteria: '',
    });
    diag['browseContainer_shares'] = shareResult;
  } catch (err) {
    diag['browseContainer_shares'] = { error: String(err) };
  }

  // 4. Test contentDirectoryService for artists (ObjectID: "A:ARTIST")
  try {
    const dev = anyDevice.device as unknown as {
      contentDirectoryService: () => {
        GetResult: (opts: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const artistContainer = await dev.contentDirectoryService().GetResult({
      ObjectID: 'A:ARTIST',
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: '0',
      RequestedCount: '5',
      SortCriteria: '',
    });
    diag['browseContainer_artists'] = artistContainer;
  } catch (err) {
    diag['browseContainer_artists'] = { error: String(err) };
  }

  // 5. Test getFavorites
  try {
    const favResult = await anyDevice.device.getFavorites();
    diag['getFavorites'] = {
      total: favResult?.total ?? null,
      itemCount: favResult?.items?.length ?? 0,
      firstItem: favResult?.items?.[0]?.title ?? null,
    };
  } catch (err) {
    diag['getFavorites'] = { error: String(err) };
  }

  return diag;
}

export async function getDiscoveredSpeakers(): Promise<DiscoveredSpeaker[]> {
  const devices = await discoverDevices();

  // Detect stereo pairs from zone topology
  const stereoPairs = new Map<string, StereoPairInfo>();
  try {
    const anyDevice = deviceCache.values().next().value;
    if (anyDevice) {
      const groups = await anyDevice.device.getAllGroups();
      for (const g of groups) {
        const members = g.ZoneGroupMember ?? [];
        // A stereo pair shows as 2 members in the same group where one is invisible
        if (members.length === 2) {
          const visible = members.filter((member) => !isInvisibleZoneMember(member));
          const invisible = members.filter(isInvisibleZoneMember);
          if (visible.length === 1 && invisible.length === 1) {
            // Coordinator (visible) is left channel, invisible member is right
            const leftUuid = visible[0]!.UUID;
            const rightUuid = invisible[0]!.UUID;
            const leftName = deviceCache.get(leftUuid)?.name;
            const rightName = deviceCache.get(rightUuid)?.name;
            stereoPairs.set(leftUuid, {
              role: 'left',
              partnerUuid: rightUuid,
              ...(rightName && { partnerName: rightName }),
            });
            stereoPairs.set(rightUuid, {
              role: 'right',
              partnerUuid: leftUuid,
              ...(leftName && { partnerName: leftName }),
            });
          }
        }
      }
    }
  } catch {
    // Stereo pair detection is best-effort — don't fail discovery
  }

  return devices.map((d) => {
    const pair = stereoPairs.get(d.uuid);
    return {
      uuid: d.uuid,
      name: d.name,
      ip: d.ip,
      ...(d.model && { model: d.model }),
      ...(d.modelNumber && { modelNumber: d.modelNumber }),
      ...(d.softwareVersion && { softwareVersion: d.softwareVersion }),
      ...(d.serialNumber && { serialNumber: d.serialNumber }),
      ...(d.hardwareVersion && { hardwareVersion: d.hardwareVersion }),
      ...(pair && { stereoPair: pair }),
    };
  });
}
