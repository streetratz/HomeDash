/**
 * Browse panel for the fullscreen Sonos controller.
 * Service selector: connected integrations | Library | discovered Sonos providers | Saved Stations.
 * Plays content on Sonos via node-sonos GenerateMetadata (spotify:, radio: URIs).
 */

import { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from 'react';
import {
  Loader2,
  Music,
  ListMusic,
  Search,
  Radio,
  Plus,
  Play,
  Disc3,
  User,
  Disc,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Tag,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import {
  usePlayUri,
  useAddToQueue,
  usePlayNext,
  useMusicLibrary,
  useBrowseContainer,
  useSearchLibrary,
  useAddContainerToQueue,
  useReplaceQueueAndPlay,
  useRadioStations,
  useSonosFavorites,
  useLoadFavorite,
  useSonosServices,
  useSonosMode,
} from '../../hooks/useSonos.js';
import type { LibraryItem, SonosMusicService } from '../../hooks/useSonos.js';
import { useSpotifySearch, useSpotifyLibrary, useSpotifyStatus } from '../../hooks/useSpotify.js';
import type { SpotifyLibraryType, SpotifyTrackResult } from '../../hooks/useSpotify.js';
import { PlayActionMenu } from './PlayActionMenu.js';
import type { QueueAction } from './PlayActionMenu.js';

// ─── Exported types & pure functions (T040 / T041) ──────────────────────────

export interface BrowseService {
  id: string;
  label: string;
  browsable: boolean;
  kind: 'spotify' | 'radio' | 'library' | 'favorites';
  serviceName?: string;
  accountSerial?: number;
}

export interface BuildBrowseServicesInput {
  spotifyConnected: boolean;
  discoveredServices?: SonosMusicService[] | undefined;
  localMode?: boolean;
}

function normaliseServiceName(value: string): string {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');

  return normalised === 'sonos' ? 'sonos_radio' : normalised;
}

export function sonosServiceNamesMatch(left: string, right: string): boolean {
  return normaliseServiceName(left) === normaliseServiceName(right);
}

/** Build usable browse surfaces from connected integrations and Sonos observations. */
export function buildBrowseServices(input: BuildBrowseServicesInput): BrowseService[] {
  const services: BrowseService[] = [];

  if (input.spotifyConnected) {
    services.push({
      id: 'spotify',
      label: 'Spotify',
      browsable: true,
      kind: 'spotify',
      serviceName: 'Spotify',
    });
  }

  if (input.localMode ?? true) {
    services.push({
      id: 'library',
      label: 'Library',
      browsable: true,
      kind: 'library',
    });
  }

  for (const discovered of input.discoveredServices ?? []) {
    if (
      input.spotifyConnected &&
      normaliseServiceName(discovered.name) === normaliseServiceName('Spotify')
    ) {
      continue;
    }

    if (discovered.accounts.length === 0) {
      services.push({
        id: `favorites:${discovered.id}`,
        label: discovered.name,
        browsable: true,
        kind: 'favorites',
        serviceName: discovered.name,
      });
      continue;
    }

    const hasNamedAccounts = discovered.accounts.some(
      (account) => account.label || account.nickname,
    );
    if (!hasNamedAccounts) {
      services.push({
        id: `favorites:${discovered.id}`,
        label: discovered.name,
        browsable: true,
        kind: 'favorites',
        serviceName: discovered.name,
      });
      continue;
    }

    for (const account of discovered.accounts) {
      services.push({
        id: `favorites:${discovered.id}:sn:${account.serialNumber}`,
        label: account.label ?? account.nickname ?? `${discovered.name} · Other`,
        browsable: true,
        kind: 'favorites',
        serviceName: discovered.name,
        accountSerial: account.serialNumber,
      });
    }
  }

  if (input.localMode ?? true) {
    services.push({
      id: 'radio',
      label: 'Saved Stations',
      browsable: true,
      kind: 'radio',
    });
  }

  return services;
}

export function splitMobileBrowseServices(services: BrowseService[]): {
  primary: BrowseService[];
  overflow: BrowseService[];
} {
  return {
    primary: services.slice(0, 3),
    overflow: services.slice(3),
  };
}

/** Select current account, then current provider, then the first usable surface. */
export function getDefaultService(
  services: BrowseService[],
  currentPlayingService?: string,
  currentAccountSerial?: number,
): string {
  if (currentPlayingService) {
    const normalised = normaliseServiceName(currentPlayingService);
    const accountMatch = services.find(
      (service) =>
        service.browsable &&
        service.accountSerial === currentAccountSerial &&
        service.serviceName &&
        normaliseServiceName(service.serviceName) === normalised,
    );
    if (accountMatch) return accountMatch.id;

    const match = services.find(
      (service) =>
        service.browsable &&
        service.serviceName &&
        normaliseServiceName(service.serviceName) === normalised,
    );
    if (match) return match.id;
  }

  return services.find((service) => service.browsable)?.id ?? 'library';
}

interface BrowsePanelProps {
  groupId: string | null;
  householdId?: string | undefined;
  currentService?: string | undefined;
  currentAccountSerial?: number | undefined;
  accent: { text: string; btnBg: string; dot: string; bg: string };
}

// ─── Shared loading / empty states ──────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-white/30" />
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="text-xs text-white/30 italic text-center py-8">{message}</p>;
}

function LoadError({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <TriangleAlert className="h-6 w-6 text-amber-300/70" />
      <p className="text-sm text-white/60">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/70 transition-[background-color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.1] active:scale-[0.97] disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
        Retry
      </button>
    </div>
  );
}

export function getLibraryObjectId(item: Pick<LibraryItem, 'uri' | 'objectId'>): string {
  if (item.objectId) return item.objectId;
  const hashIndex = item.uri.indexOf('#');
  const objectId = hashIndex >= 0 ? item.uri.slice(hashIndex + 1) : item.uri;
  if (objectId.startsWith('x-file-cifs://')) {
    return `S://${objectId.slice('x-file-cifs://'.length)}`;
  }
  return objectId;
}

// ─── Item card with play / queue hover actions ──────────────────────────────

function ItemCard({
  title,
  subtitle,
  imageUrl,
  onPlay,
  onQueue,
  accent,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  onPlay?: (() => void) | undefined;
  onQueue?: (() => void) | undefined;
  accent: BrowsePanelProps['accent'];
}) {
  return (
    <div className="group relative flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.04] can-hover:hover:bg-white/[0.08] transition-colors duration-150 ease-out text-center">
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/[0.06]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-6 w-6 text-white/10" />
          </div>
        )}
      </div>
      <span className="text-[10px] text-white/60 truncate w-full leading-tight">{title}</span>
      {subtitle && (
        <span className="text-[9px] text-white/30 truncate w-full leading-tight -mt-1">
          {subtitle}
        </span>
      )}

      {/* Quick actions */}
      {(onPlay || onQueue) && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {onPlay && (
            <button
              onClick={onPlay}
              className={`rounded-full p-2 text-white shadow-md transition-transform active:scale-[0.94] ${accent.btnBg}`}
              title="Play now"
              aria-label={`Play ${title}`}
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {onQueue && (
            <button
              onClick={onQueue}
              className="rounded-full bg-black/60 p-2 text-white shadow-md transition-transform active:scale-[0.94] can-hover:hover:bg-black/75"
              title="Add to queue"
              aria-label={`Add ${title} to queue`}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Search Tab (Spotify) ───────────────────────────────────────────────────

function SearchTab({ groupId, accent }: BrowsePanelProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const { data, isLoading, isError, isFetching, refetch } = useSpotifySearch(
    deferred,
    'track,album,playlist',
    12,
    deferred.length >= 2,
  );
  const playUri = usePlayUri();
  const addToQueue = useAddToQueue();

  const results = data;
  const hasResults =
    !!results &&
    (results.tracks.length > 0 || results.albums.length > 0 || results.playlists.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Spotify…"
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {isLoading && <Loading />}

      {!isLoading && isError && (
        <LoadError
          message="Could not search Spotify. Try again."
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && hasResults && results && (
        <div className="space-y-4">
          {/* Tracks */}
          {results.tracks.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                Tracks
              </h4>
              <div className="space-y-1">
                {results.tracks.map((t: SpotifyTrackResult) => (
                  <div
                    key={t.uri}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="w-8 h-8 rounded overflow-hidden bg-white/[0.06] flex-shrink-0">
                      {t.albumArtUrl ? (
                        <img src={t.albumArtUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="h-3 w-3 text-white/10" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/80 truncate">{t.name}</p>
                      <p className="text-[9px] text-white/40 truncate">
                        {t.artist} · {t.album}
                      </p>
                    </div>
                    {groupId && (
                      <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button
                          onClick={() => playUri.mutate({ groupId, uri: t.uri, title: t.name })}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform active:scale-[0.94] ${accent.btnBg}`}
                          title="Play now"
                          aria-label={`Play ${t.name}`}
                        >
                          <Play className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => addToQueue.mutate({ groupId, uri: t.uri })}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-[background-color,transform] can-hover:hover:bg-white/30 active:scale-[0.94]"
                          title="Add to queue"
                          aria-label={`Add ${t.name} to queue`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                Albums
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {results.albums.map((a) => (
                  <ItemCard
                    key={a.uri}
                    title={a.name}
                    subtitle={a.artist}
                    imageUrl={a.imageUrl}
                    onPlay={
                      groupId
                        ? () => playUri.mutate({ groupId, uri: a.uri, title: a.name })
                        : undefined
                    }
                    accent={accent}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {results.playlists.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                Playlists
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {results.playlists.map((p) => (
                  <ItemCard
                    key={p.uri}
                    title={p.name}
                    subtitle={p.owner}
                    imageUrl={p.imageUrl}
                    onPlay={
                      groupId
                        ? () => playUri.mutate({ groupId, uri: p.uri, title: p.name })
                        : undefined
                    }
                    accent={accent}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !isError && !results && query.length < 2 && (
        <Empty message="Type at least 2 characters to search Spotify" />
      )}
      {!isLoading && !isError && results && !hasResults && deferred.length >= 2 && (
        <Empty message={`No Spotify results for "${deferred}"`} />
      )}
    </div>
  );
}

// ─── Saved library tabs (Spotify) ───────────────────────────────────────────

function SpotifyLibraryTab({
  groupId,
  accent,
  type,
}: BrowsePanelProps & { type: SpotifyLibraryType }) {
  const library = useSpotifyLibrary(type);
  const playUri = usePlayUri();
  const addToQueue = useAddToQueue();

  if (library.isLoading) return <Loading />;
  if (library.isError) {
    return <Empty message={`Could not load saved ${type}. Reconnect Spotify if this continues.`} />;
  }

  const items = library.data?.pages.flatMap((page) => page.items) ?? [];
  if (!items.length) return <Empty message={`No saved ${type} found`} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            title={item.name}
            subtitle={
              item.itemCount !== undefined
                ? `${item.itemCount} tracks`
                : [item.subtitle, item.detail].filter(Boolean).join(' · ')
            }
            imageUrl={item.imageUrl}
            onPlay={
              groupId
                ? () => playUri.mutate({ groupId, uri: item.uri, title: item.name })
                : undefined
            }
            onQueue={
              groupId && type === 'tracks'
                ? () => addToQueue.mutate({ groupId, uri: item.uri })
                : undefined
            }
            accent={accent}
          />
        ))}
      </div>
      {library.hasNextPage && (
        <button
          onClick={() => void library.fetchNextPage()}
          disabled={library.isFetchingNextPage}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/60 transition-[background-color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.08] active:scale-[0.98]"
        >
          {library.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
          Load more
        </button>
      )}
    </div>
  );
}

// ─── Library Tab (Sonos local playlists) ────────────────────────────────────

// ─── Library Tab with sub-navigation (T053/T054) ────────────────────────────

type LibrarySubTab = 'share' | 'artists' | 'albums' | 'genres' | 'tracks' | 'playlists';

const LIBRARY_SUB_TABS: { id: LibrarySubTab; label: string; icon: typeof Music }[] = [
  { id: 'share', label: 'Folders', icon: FolderOpen },
  { id: 'artists', label: 'Artists', icon: User },
  { id: 'albums', label: 'Albums', icon: Disc },
  { id: 'genres', label: 'Genres', icon: Tag },
  { id: 'tracks', label: 'Tracks', icon: Music },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
];

// Maps sub-tab id to the API library type
function libraryTypeForSubTab(sub: LibrarySubTab): string {
  if (sub === 'playlists') return 'sonos_playlists';
  return sub;
}

// Breadcrumb path entry
interface BreadcrumbEntry {
  label: string;
  objectId: string;
}

// How many items to load per batch
const BATCH_SIZE = 50;

function LibraryTab({ groupId, accent }: BrowsePanelProps) {
  const [subTab, setSubTab] = useState<LibrarySubTab>('share');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [loadedCount, setLoadedCount] = useState(BATCH_SIZE);

  // Drill-down breadcrumb stack
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  // Reset state on sub-tab change
  const handleSubTabChange = useCallback((tab: LibrarySubTab) => {
    setSubTab(tab);
    setBreadcrumbs([]);
    setSearchQuery('');
    setLoadedCount(BATCH_SIZE);
  }, []);

  // Top-level browse (no drill-down active)
  const apiType = libraryTypeForSubTab(subTab);
  const topQuery = useMusicLibrary(!currentCrumb && !deferredSearch ? apiType : undefined, {
    start: 0,
    total: loadedCount,
  });

  // Drill-down browse (breadcrumb active)
  const drillQuery = useBrowseContainer(
    currentCrumb?.objectId,
    { start: 0, total: loadedCount },
    !!currentCrumb,
  );

  // Search (when user types in search box)
  const searchQueryResult = useSearchLibrary(
    deferredSearch ? apiType : undefined,
    deferredSearch || undefined,
    { start: 0, total: loadedCount },
    !!deferredSearch && deferredSearch.length >= 2,
  );

  // Choose which data to display
  const activeQuery = deferredSearch ? searchQueryResult : currentCrumb ? drillQuery : topQuery;
  const isLoading = activeQuery.isLoading;
  const activeData = activeQuery.data;
  const items = activeData?.items ?? [];
  const totalItems = activeData?.total ?? 0;
  const hasMore = items.length < totalItems;

  // Mutations
  const playUri = usePlayUri();
  const addToQueue = useAddToQueue();
  const playNext = usePlayNext();
  const addContainerToQueue = useAddContainerToQueue();
  const replaceQueue = useReplaceQueueAndPlay();

  const isContainerMutating = addContainerToQueue.isPending || replaceQueue.isPending;

  const handleAction = useCallback(
    (action: QueueAction, item: LibraryItem) => {
      if (!groupId) return;

      if (item.type === 'container') {
        const objectId = getLibraryObjectId(item);
        switch (action) {
          case 'add_to_end':
            addContainerToQueue.mutate({ groupId, objectId });
            break;
          case 'replace_queue':
          case 'play_now':
            replaceQueue.mutate({ groupId, objectId });
            break;
        }
        return;
      }

      // Track actions
      switch (action) {
        case 'play_now':
          playUri.mutate({ groupId, uri: item.uri, title: item.title });
          break;
        case 'play_next':
          playNext.mutate({
            groupId,
            uri: item.uri,
            ...(item.metadata ? { metadata: item.metadata } : {}),
          });
          break;
        case 'add_to_end':
          addToQueue.mutate({
            groupId,
            uri: item.uri,
            ...(item.metadata ? { metadata: item.metadata } : {}),
          });
          break;
        case 'replace_queue':
          playUri.mutate({ groupId, uri: item.uri, title: item.title });
          break;
      }
    },
    [groupId, playUri, addToQueue, playNext, addContainerToQueue, replaceQueue],
  );

  // Drill into a container using the normalized Sonos ObjectID.
  const drillInto = useCallback((item: LibraryItem) => {
    setBreadcrumbs((prev) => [...prev, { label: item.title, objectId: getLibraryObjectId(item) }]);
    setLoadedCount(BATCH_SIZE);
  }, []);

  // Navigate back
  const goBack = useCallback(() => {
    setBreadcrumbs((prev) => prev.slice(0, -1));
    setLoadedCount(BATCH_SIZE);
  }, []);

  const goToRoot = useCallback(() => {
    setBreadcrumbs([]);
    setLoadedCount(BATCH_SIZE);
  }, []);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (hasMore) setLoadedCount((c) => c + BATCH_SIZE);
  }, [hasMore]);

  // Scroll observer for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-2">
      {/* Sub-tab selector */}
      <div
        aria-label="Music library sections"
        className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        {LIBRARY_SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => handleSubTabChange(t.id)}
              className={`flex min-h-11 shrink-0 snap-start items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                subTab === t.id
                  ? `${accent.text} bg-white/[0.08]`
                  : 'text-white/40 can-hover:hover:bg-white/[0.04] can-hover:hover:text-white/60'
              }`}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setLoadedCount(BATCH_SIZE);
          }}
          placeholder={`Search ${LIBRARY_SUB_TABS.find((t) => t.id === subTab)?.label ?? 'library'}…`}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Breadcrumb navigation */}
      {breadcrumbs.length > 0 && !deferredSearch && (
        <div className="flex items-center gap-1 text-[10px]">
          <button
            onClick={goToRoot}
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            Library
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-2.5 w-2.5 text-white/20" />
              {i < breadcrumbs.length - 1 ? (
                <button
                  onClick={() => {
                    setBreadcrumbs((prev) => prev.slice(0, i + 1));
                    setLoadedCount(BATCH_SIZE);
                  }}
                  className="text-white/40 hover:text-white/60 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-white/70 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Back button when drilled-down */}
      {breadcrumbs.length > 0 && !deferredSearch && (
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      )}

      {/* Content */}
      <div>
        {isLoading ? (
          <Loading />
        ) : activeQuery.isError ? (
          <LoadError
            message={`Could not load ${LIBRARY_SUB_TABS.find((tab) => tab.id === subTab)?.label ?? 'the library'} from Sonos.`}
            retrying={activeQuery.isFetching}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : activeData?.localOnly ? (
          <div className="text-center py-8 space-y-2">
            <Music className="h-8 w-8 text-white/20 mx-auto" />
            <p className="text-xs text-white/40">Music library requires local mode</p>
          </div>
        ) : !items.length ? (
          <Empty
            message={
              deferredSearch
                ? `No results for "${deferredSearch}"`
                : `No ${LIBRARY_SUB_TABS.find((tab) => tab.id === subTab)?.label.toLowerCase() ?? 'library items'} found`
            }
          />
        ) : (
          <>
            {/* Track list view for tracks or leaf-node items */}
            {subTab === 'tracks' || items.every((it) => it.type === 'track') ? (
              <div className="space-y-0.5">
                {items.map((item, i) => (
                  <div
                    key={`${item.uri}-${i}`}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-[9px] text-white/20 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded overflow-hidden bg-white/[0.06] flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="h-3 w-3 text-white/10" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/80 truncate">{item.title}</p>
                      {(item.artist || item.album) && (
                        <p className="text-[9px] text-white/40 truncate">
                          {[item.artist, item.album].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {groupId && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayActionMenu
                          onAction={(action) => handleAction(action, item)}
                          accent={accent}
                          compact
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Compact tile grid for containers */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                {items.map((item, i) => (
                  <div
                    key={`${item.uri}-${i}`}
                    className="group relative flex flex-col items-center gap-1 p-1.5 rounded-lg bg-white/[0.03] can-hover:hover:bg-white/[0.07] transition-colors duration-150 ease-out cursor-pointer"
                    onClick={() => {
                      if (item.type === 'container') {
                        drillInto(item);
                      }
                    }}
                  >
                    <div className="w-full aspect-square rounded-md overflow-hidden bg-white/[0.05]">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.type === 'container' ? (
                            <FolderOpen className="h-5 w-5 text-white/10" />
                          ) : (
                            <Music className="h-5 w-5 text-white/10" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="w-full truncate text-center text-[11px] leading-tight text-white/60">
                      {item.title}
                    </span>
                    {item.artist && (
                      <span className="-mt-0.5 w-full truncate text-center text-[10px] leading-tight text-white/30">
                        {item.artist}
                      </span>
                    )}

                    {/* Hover actions for containers: queue actions + drill icon; for tracks: play menu */}
                    {item.type === 'container' && groupId && (
                      <div
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PlayActionMenu
                          onAction={(action) => handleAction(action, item)}
                          accent={accent}
                          compact
                          isLoading={isContainerMutating}
                          containerMode
                        />
                      </div>
                    )}
                    {item.type === 'container' && !groupId && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                      </div>
                    )}
                    {item.type === 'track' && groupId && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayActionMenu
                          onAction={(action) => handleAction(action, item)}
                          accent={accent}
                          compact
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel + load more */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                <span className="text-[10px] text-white/20 ml-2">
                  {items.length} of {totalItems}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RadioTab({ groupId, accent }: BrowsePanelProps) {
  const { data, isLoading, isError, isFetching, refetch } = useRadioStations();
  const playUri = usePlayUri();

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <LoadError
        message="Could not load favorite radio stations from Sonos."
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data?.items.length) {
    return (
      <Empty message="No favorite radio stations found. Save stations in the Sonos app to show them here." />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((station) => (
        <ItemCard
          key={station.uri}
          title={station.title}
          imageUrl={station.imageUrl}
          accent={accent}
          onPlay={
            groupId
              ? () => playUri.mutate({ groupId, uri: station.uri, title: station.title })
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ServiceFavoritesTab({
  groupId,
  householdId,
  service,
  accent,
}: BrowsePanelProps & { service: BrowseService }) {
  const {
    data: favorites,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useSonosFavorites(householdId);
  const loadFavorite = useLoadFavorite();

  const matchingFavorites = useMemo(
    () =>
      (favorites ?? []).filter((favorite) => {
        if (!favorite.service?.name || !service.serviceName) return false;
        if (!sonosServiceNamesMatch(favorite.service.name, service.serviceName)) {
          return false;
        }
        return service.accountSerial === undefined || favorite.service.sn === service.accountSerial;
      }),
    [favorites, service.accountSerial, service.serviceName],
  );

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <LoadError
        message={`Could not load ${service.label} favorites from Sonos.`}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!matchingFavorites.length) {
    return (
      <Empty
        message={`No ${service.label} favorites found. Add favorites in the Sonos app to browse them here.`}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {matchingFavorites.map((favorite) => (
        <ItemCard
          key={favorite.id}
          title={favorite.name}
          {...(service.serviceName && { subtitle: service.serviceName })}
          {...(favorite.imageUrl && { imageUrl: favorite.imageUrl })}
          accent={accent}
          onPlay={
            groupId ? () => loadFavorite.mutate({ groupId, favoriteId: favorite.id }) : undefined
          }
        />
      ))}
    </div>
  );
}

// ─── Service icon helper ────────────────────────────────────────────────────

function ServiceIcon({ kind, className }: { kind: BrowseService['kind']; className?: string }) {
  switch (kind) {
    case 'spotify':
      return <Music className={className} />;
    case 'radio':
      return <Radio className={className} />;
    case 'library':
      return <Disc3 className={className} />;
    case 'favorites':
      return <Tag className={className} />;
  }
}

// ─── Main BrowsePanel (T042, T044, T045) ────────────────────────────────────

export function BrowsePanel({
  groupId,
  householdId,
  currentService,
  currentAccountSerial,
  accent,
}: BrowsePanelProps) {
  const spotifyStatus = useSpotifyStatus();
  const spotifyConnected = spotifyStatus.data?.connected ?? false;
  const { data: modeData } = useSonosMode();
  const { data: discoveredServices } = useSonosServices(householdId);

  const services = useMemo(
    () =>
      buildBrowseServices({
        spotifyConnected,
        discoveredServices: discoveredServices?.services,
        localMode: modeData?.mode !== 'cloud',
      }),
    [discoveredServices?.services, modeData?.mode, spotifyConnected],
  );

  const browsable = useMemo(() => services.filter((s) => s.browsable), [services]);
  const mobileServices = useMemo(() => splitMobileBrowseServices(browsable), [browsable]);
  const mobilePrimaryIds = useMemo(
    () => new Set(mobileServices.primary.map((service) => service.id)),
    [mobileServices.primary],
  );

  const defaultService = useMemo(
    () => getDefaultService(services, currentService, currentAccountSerial),
    [services, currentAccountSerial, currentService],
  );

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const activeService =
    selectedService && services.some((service) => service.id === selectedService)
      ? selectedService
      : defaultService;
  const activeServiceConfig = services.find((service) => service.id === activeService);

  const [spotifySubTab, setSpotifySubTab] = useState<'search' | SpotifyLibraryType>('search');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Service selector — browsable services as buttons (T042) */}
      <div
        aria-label="Music services"
        className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        {browsable.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedService(s.id)}
            aria-pressed={s.id === activeService}
            className={`${mobilePrimaryIds.has(s.id) ? 'flex' : 'hidden sm:flex'} min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] sm:flex-none sm:justify-start sm:px-3 ${
              s.id === activeService
                ? `${accent.text} bg-white/[0.10] ring-1 ring-white/[0.15]`
                : 'bg-white/[0.05] text-white/50 can-hover:hover:bg-white/[0.08] can-hover:hover:text-white/70'
            }`}
          >
            <ServiceIcon kind={s.kind} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{s.label}</span>
          </button>
        ))}
        {mobileServices.overflow.length > 0 && (
          <label
            className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium sm:hidden ${
              mobileServices.overflow.some((service) => service.id === activeService)
                ? `${accent.text} bg-white/[0.10] ring-1 ring-white/[0.15]`
                : 'bg-white/[0.05] text-white/50'
            }`}
          >
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">More</span>
            <select
              aria-label="More Sonos services"
              value={
                mobileServices.overflow.some((service) => service.id === activeService)
                  ? activeService
                  : ''
              }
              onChange={(event) => setSelectedService(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="" disabled>
                More Sonos services
              </option>
              {mobileServices.overflow.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {discoveredServices?.completeness === 'observed' &&
        discoveredServices.services.length > 0 && (
          <p className="mb-3 hidden text-[10px] text-white/30 sm:block">
            Services are inferred from Sonos favorites and recent playback.
          </p>
        )}

      {/* Spotify sub-tabs when Spotify is selected */}
      {activeService === 'spotify' && spotifyConnected && (
        <div
          aria-label="Spotify sections"
          className="-mx-1 mb-3 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide"
        >
          {(
            [
              ['search', 'Search', Search],
              ['playlists', 'Playlists', ListMusic],
              ['albums', 'Albums', Disc3],
              ['artists', 'Artists', User],
              ['tracks', 'Tracks', Music],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSpotifySubTab(id)}
              className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                spotifySubTab === id
                  ? `${accent.text} bg-white/[0.08]`
                  : 'text-white/40 can-hover:hover:bg-white/[0.04] can-hover:hover:text-white/60'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content area (T044) */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        {!activeServiceConfig && (
          <Empty message="No browsable services found. Add a Sonos Favorite or connect Spotify." />
        )}
        {activeService === 'spotify' && spotifyConnected && spotifySubTab === 'search' && (
          <SearchTab groupId={groupId} accent={accent} />
        )}
        {activeService === 'spotify' && spotifyConnected && spotifySubTab !== 'search' && (
          <SpotifyLibraryTab groupId={groupId} accent={accent} type={spotifySubTab} />
        )}
        {activeService === 'library' && <LibraryTab groupId={groupId} accent={accent} />}
        {activeService === 'radio' && (
          <RadioTab
            groupId={groupId}
            householdId={householdId}
            currentService={currentService}
            currentAccountSerial={currentAccountSerial}
            accent={accent}
          />
        )}
        {activeServiceConfig?.kind === 'favorites' && (
          <ServiceFavoritesTab
            groupId={groupId}
            householdId={householdId}
            currentService={currentService}
            currentAccountSerial={currentAccountSerial}
            service={activeServiceConfig}
            accent={accent}
          />
        )}
      </div>
    </div>
  );
}
