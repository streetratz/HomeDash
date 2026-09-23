import { fetchStats, fetchSystemHealth } from './pihole-service.js';
import { fetchUnifiStats } from './unifi-service.js';
import {
  getGroups,
  getGroupVolume,
  getPlaybackMetadata,
  getPlaybackState,
  getSonosMode,
} from './sonos-adapter.js';
import { getFxRate, getMarketStatus, getQuotes } from './stock-service.js';
import { listShortcuts } from './appShortcutService.js';
import type { ResolvedPublicWidget } from './publicVisibility.js';
import type { PublicWidgetSnapshot, SnapshotCachePolicy } from './publicWidgetSnapshotCache.js';
import { selectPreferredSonosGroup } from './sonosGroupSelection.js';

const FAILURE_BACKOFF_MS = 15_000;

export function publicSnapshotCachePolicy(widget: ResolvedPublicWidget): SnapshotCachePolicy {
  const pollIntervalMs =
    typeof widget.config['pollIntervalSec'] === 'number'
      ? widget.config['pollIntervalSec'] * 1000
      : 0;
  switch (widget.type) {
    case 'pihole':
      return {
        freshMs: Math.max(pollIntervalMs, 10_000),
        staleMs: 120_000,
        failureBackoffMs: FAILURE_BACKOFF_MS,
      };
    case 'unifi':
      return {
        freshMs: Math.max(pollIntervalMs, 30_000),
        staleMs: 300_000,
        failureBackoffMs: FAILURE_BACKOFF_MS,
      };
    case 'sonos_music':
      return { freshMs: 5_000, staleMs: 30_000, failureBackoffMs: FAILURE_BACKOFF_MS };
    case 'stocks':
      return { freshMs: 60_000, staleMs: 900_000, failureBackoffMs: FAILURE_BACKOFF_MS };
    case 'app_shortcuts':
      return { freshMs: 60_000, staleMs: 300_000, failureBackoffMs: FAILURE_BACKOFF_MS };
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function loadSonos(widget: ResolvedPublicWidget): Promise<unknown> {
  const mode = getSonosMode();
  const userId = widget.publicSourceUserId ?? '';
  if (mode === 'cloud' && !userId) throw new Error('Sonos source principal unavailable');

  const householdId =
    stringValue(widget.config['householdId']) ?? (mode === 'local' ? 'local' : null);
  if (!householdId) throw new Error('Sonos household unavailable');

  const groupsData = await getGroups(userId, householdId);
  const configuredGroupId = stringValue(widget.config['defaultGroupId']);
  const activeGroup =
    selectPreferredSonosGroup(groupsData.groups, configuredGroupId ?? undefined) ?? null;

  const [playback, metadata, volume] = activeGroup
    ? await Promise.all([
        getPlaybackState(userId, activeGroup.id),
        getPlaybackMetadata(userId, activeGroup.id),
        getGroupVolume(userId, activeGroup.id),
      ])
    : [null, null, null];

  const track = metadata?.currentItem?.track;
  return {
    groups: groupsData.groups.map((group) => ({
      id: group.id,
      name: group.name,
      coordinatorId: group.coordinatorId,
      playbackState: group.playbackState ?? '',
      playerIds: group.playerIds,
    })),
    players: groupsData.players.map((player) => ({
      id: player.id,
      name: player.name,
      ...(player.capabilities ? { capabilities: player.capabilities } : {}),
    })),
    activeGroupId: activeGroup?.id ?? null,
    playback,
    metadata: metadata
      ? {
          currentItem: track
            ? {
                track: {
                  name: track.name,
                  artist: track.artist,
                  album: track.album,
                  imageUrl: track.imageUrl,
                  durationMillis: track.durationMillis,
                  type: track.type,
                  ...(track.service?.name ? { service: { name: track.service.name } } : {}),
                },
              }
            : undefined,
        }
      : null,
    volume,
  };
}

async function loadStocks(widget: ResolvedPublicWidget): Promise<unknown> {
  const groups = Array.isArray(widget.config['groups'])
    ? (widget.config['groups'] as Array<Record<string, unknown>>)
    : [];
  const displayCurrency = stringValue(widget.config['displayCurrency']) ?? 'AUD';
  const symbols = [
    ...new Set(
      groups.flatMap((group) =>
        Array.isArray(group['tickers'])
          ? (group['tickers'] as Array<Record<string, unknown>>)
              .map((ticker) => stringValue(ticker['symbol']))
              .filter((symbol): symbol is string => symbol !== null)
          : [],
      ),
    ),
  ];
  const currencies = [
    ...new Set(
      groups
        .map((group) => stringValue(group['currency']))
        .filter((currency): currency is string => currency !== null),
    ),
  ];
  const quotes = symbols.length > 0 ? await getQuotes(symbols) : [];
  const fxRates: Record<string, number> = {};
  await Promise.all(
    currencies
      .filter((currency) => currency !== displayCurrency)
      .map(async (currency) => {
        fxRates[`${currency}${displayCurrency}`] = await getFxRate(currency, displayCurrency);
      }),
  );
  return {
    quotes,
    fxRates,
    displayCurrency,
    markets: symbols.length > 0 ? await getMarketStatus(symbols) : {},
  };
}

export async function loadPublicWidgetSnapshot(
  widget: ResolvedPublicWidget,
): Promise<PublicWidgetSnapshot> {
  let data: unknown;
  switch (widget.type) {
    case 'pihole': {
      const [stats, system] = await Promise.all([
        fetchStats(widget.id),
        fetchSystemHealth(widget.id),
      ]);
      data = { stats, system };
      break;
    }
    case 'unifi':
      data = await fetchUnifiStats(widget.id);
      break;
    case 'sonos_music':
      data = await loadSonos(widget);
      break;
    case 'stocks':
      data = await loadStocks(widget);
      break;
    case 'app_shortcuts':
      data = {
        shortcuts: listShortcuts(widget.id).map((shortcut) => ({
          id: shortcut.id,
          groupId: shortcut.groupId,
          name: shortcut.name,
          url: shortcut.url,
          iconKey: shortcut.iconKey,
          iconUrl: shortcut.iconUrl,
          orderIndex: shortcut.orderIndex,
        })),
      };
      break;
  }

  return {
    widgetId: widget.id,
    type: widget.type,
    data,
    refreshedAt: new Date().toISOString(),
  };
}
