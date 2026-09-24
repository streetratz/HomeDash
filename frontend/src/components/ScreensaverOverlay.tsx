/**
 * ScreensaverOverlay — fullscreen ambient photo display with clock + weather.
 *
 * - Full viewport overlay with rotating photos and configurable transition effects
 * - Weather (bottom-left) and clock/date (bottom-right)
 * - Now-playing info (top-right) when Spotify or Sonos is active
 * - Today's calendar events (right side, vertically centered)
 * - Supports 12h / 24h clock format
 * - Transition effects: fade, slide, kenburns, crossfade
 * - Dismissed only by click or touch (not mouse move / keyboard)
 * - Respects prefers-reduced-motion
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { CloudSun, Music, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from 'lucide-react';
import { usePhotoRotation } from '../hooks/usePhotoFrame.js';
import { useWeather } from '../hooks/useWeather.js';
import { useSpotifyStatus, useNowPlaying } from '../hooks/useSpotify.js';
import {
  useSonosStatus,
  useSonosHouseholds,
  useSonosGroups,
  useSonosPlaybackState,
  useSonosMetadata,
} from '../hooks/useSonos.js';
import { useCalendarSources, useCalendarEvents, type CalendarEvent, type CalendarSource } from '../state/calendarHooks.js';
import { selectPreferredSonosGroup } from './sonos/selectPreferredSonosGroup.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type TransitionEffect = 'fade' | 'slide' | 'kenburns' | 'crossfade';

interface ScreensaverProps {
  sourceId: string | null;
  intervalSeconds?: number;
  clockFormat?: '12h' | '24h';
  transition?: TransitionEffect;
  onDismiss: () => void;
  weatherConfig?: {
    latitude?: number | undefined;
    longitude?: number | undefined;
    locationName?: string | undefined;
    temperatureUnit?: 'C' | 'F' | undefined;
  } | undefined;
}

// ── Weather icon from WMO code (matching WeatherWidget Lucide icons) ────────

function weatherTheme(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 55) return 'drizzle';
  if (code <= 65) return 'rain';
  if (code <= 75) return 'snow';
  if (code <= 82) return 'rain';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

function ScreensaverWeatherIcon({ code }: { code: number }) {
  const theme = weatherTheme(code);
  const cls = "h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 drop-shadow-lg";
  switch (theme) {
    case 'clear':
      return <Sun className={`${cls} text-yellow-300`} />;
    case 'cloudy':
      return <Cloud className={`${cls} text-white/80`} />;
    case 'fog':
      return <CloudFog className={`${cls} text-white/70`} />;
    case 'drizzle':
      return <CloudDrizzle className={`${cls} text-blue-200`} />;
    case 'rain':
      return <CloudRain className={`${cls} text-blue-300`} />;
    case 'snow':
      return <CloudSnow className={`${cls} text-white/90`} />;
    case 'storm':
      return <CloudLightning className={`${cls} text-yellow-200`} />;
    default:
      return <Cloud className={`${cls} text-white/80`} />;
  }
}

// ── Transition CSS class mapping ────────────────────────────────────────────

function getTransitionClasses(effect: TransitionEffect): string {
  switch (effect) {
    case 'fade':
      return 'ss-transition-fade';
    case 'slide':
      return 'ss-transition-slide';
    case 'kenburns':
      return 'ss-transition-fade ss-kenburns';
    case 'crossfade':
      return 'ss-transition-crossfade';
    default:
      return 'ss-transition-fade';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get today's date range (local midnight to midnight) as ISO strings */
function todayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86_400_000);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Format event time as short string (e.g. "9:30 AM" or "14:00") */
function formatEventTime(iso: string, hour12: boolean): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12 });
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScreensaverOverlay({
  sourceId,
  intervalSeconds = 30,
  clockFormat = '12h',
  transition = 'kenburns',
  onDismiss,
  weatherConfig,
}: ScreensaverProps) {
  const [now, setNow] = useState(new Date());


  const { currentUrl, nextUrl } = usePhotoRotation({
    sourceId: sourceId ?? undefined,
    intervalSeconds,
    shuffle: true,
    paused: false,
  });

  // Track previous URL for crossfade effect
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  useEffect(() => {
    if (currentUrl && currentUrl !== prevUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: track prev value for crossfade
      setPrevUrl(currentUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl]);

  // Weather data (only if configured)
  const { data: weather } = useWeather(
    weatherConfig?.latitude,
    weatherConfig?.longitude,
    weatherConfig?.temperatureUnit ?? 'C',
    15,
    !!weatherConfig?.latitude,
  );

  // Now-playing: prefer Spotify, fall back to Sonos
  const { data: spotifyStatus } = useSpotifyStatus();
  const spotifyConnected = spotifyStatus?.connected ?? false;
  const { data: nowPlaying } = useNowPlaying(spotifyConnected);
  const spotifyPlaying = nowPlaying?.isPlaying && !!nowPlaying?.trackName;

  // Sonos: only poll if Spotify isn't already providing now-playing
  // Use slower intervals than the widget (screensaver is passive display only)
  const { data: sonosStatus } = useSonosStatus();
  const sonosConnected = sonosStatus?.connected ?? false;
  const needSonos = sonosConnected && !spotifyPlaying;
  const { data: householdsData } = useSonosHouseholds(needSonos);
  const firstHouseholdId = householdsData?.households?.[0]?.id;
  const { data: groupsData } = useSonosGroups(firstHouseholdId, needSonos, 30_000);
  const activeSonosGroup = selectPreferredSonosGroup(groupsData?.groups ?? []);
  const { data: sonosPlayback } = useSonosPlaybackState(
    activeSonosGroup?.id,
    needSonos && !!activeSonosGroup,
    15_000,
  );
  const { data: sonosMetadata } = useSonosMetadata(
    activeSonosGroup?.id,
    needSonos && !!activeSonosGroup,
    15_000,
  );
  const sonosTrack = sonosMetadata?.currentItem?.track;
  const sonosPlaybackState = sonosPlayback?.playbackState ?? activeSonosGroup?.playbackState;
  const sonosHasActiveTrack =
    sonosPlaybackState === 'PLAYBACK_STATE_PLAYING' ||
    sonosPlaybackState === 'PLAYBACK_STATE_PAUSED';

  // Unified now-playing: Spotify wins when actively playing, else Sonos
  const npTrack = spotifyPlaying ? nowPlaying?.trackName : (sonosHasActiveTrack ? sonosTrack?.name : undefined);
  const npArtist = spotifyPlaying ? nowPlaying?.artistName : (sonosHasActiveTrack ? sonosTrack?.artist?.name : undefined);
  const npArt = spotifyPlaying ? nowPlaying?.albumArtUrl : (sonosHasActiveTrack ? sonosTrack?.imageUrl : undefined);
  const npAlbum = spotifyPlaying ? nowPlaying?.albumName : (sonosHasActiveTrack ? sonosTrack?.album?.name : undefined);
  const hasTrack = !!npTrack;

  // Calendar events for today
  const { data: calSources } = useCalendarSources();
  const enabledSourceIds = useMemo(
    () => (calSources ?? []).filter((s: CalendarSource) => s.enabled).map((s: CalendarSource) => s.id),
    [calSources],
  );
  const { from: todayFrom, to: todayTo } = useMemo(() => todayRange(), []);
  const { data: calEvents } = useCalendarEvents(enabledSourceIds, todayFrom, todayTo);
  const todayEvents = useMemo(() => {
    if (!calEvents) return [];
    const nowMs = now.getTime();
    // Show all non-private today's events sorted by start time (upcoming first, then past)
    return [...calEvents]
      .filter((e: CalendarEvent) => !e.isPrivate)
      .sort((a: CalendarEvent, b: CalendarEvent) => {
        // Upcoming/ongoing events first, then past events
        const aEnded = new Date(a.endAt).getTime() <= nowMs ? 1 : 0;
        const bEnded = new Date(b.endAt).getTime() <= nowMs ? 1 : 0;
        if (aEnded !== bEnded) return aEnded - bEnded;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      })
      .slice(0, 5);
  }, [calEvents, now]);

  // Source color lookup
  const sourceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of calSources ?? []) map.set(s.id, s.color);
    return map;
  }, [calSources]);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dismiss only on click or touch
  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'click'] as const;
    const timeout = setTimeout(() => {
      for (const event of events) {
        window.addEventListener(event, handleDismiss, { once: true });
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      for (const event of events) {
        window.removeEventListener(event, handleDismiss);
      }
    };
  }, [handleDismiss]);

  // Format time/date
  const hour12 = clockFormat === '12h';
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12 });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const transitionClass = getTransitionClasses(transition);

  return (
    <div className="fixed inset-0 z-[100] bg-black cursor-pointer" role="button" tabIndex={0} onClick={handleDismiss}>
      {/* Crossfade: show previous image underneath */}
      {transition === 'crossfade' && prevUrl && prevUrl !== currentUrl && (
        <img
          key={`prev-${prevUrl}`}
          src={prevUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Photo layer with configurable transition effect */}
      {currentUrl ? (
        <img
          key={currentUrl}
          src={currentUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${transitionClass}`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      )}

      {/* Preload next */}
      {nextUrl && nextUrl !== currentUrl && (
        <img src={nextUrl} alt="" className="hidden" loading="eager" />
      )}

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

      {/* Now-playing (top-right, flush to edge) */}
      {hasTrack && (
        <div className="absolute right-0 top-6 z-10 pointer-events-none">
          <div className="ss-aurora-bg flex items-center gap-3 rounded-l-xl pl-3 pr-4 py-3 shadow-lg max-w-[300px]">
            {npArt ? (
              <img
                src={npArt}
                alt={npAlbum ?? ''}
                className="h-14 w-14 rounded-lg shadow-md object-cover shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Music className="h-6 w-6 text-white/30" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate drop-shadow">
                {npTrack}
              </p>
              <p className="text-xs text-white/70 truncate drop-shadow">
                {npArtist}
              </p>
              <div className="flex items-end gap-[3px] mt-1.5 h-3">
                <span className="w-[3px] bg-green-400 rounded-full animate-eq-1" />
                <span className="w-[3px] bg-green-400 rounded-full animate-eq-2" />
                <span className="w-[3px] bg-green-400 rounded-full animate-eq-3" />
                <span className="w-[3px] bg-green-400 rounded-full animate-eq-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content overlays */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8 md:p-12 pointer-events-none">
        <div className="flex items-end justify-between gap-4">
          {/* Weather (bottom-left) */}
          {weather && (
            <div className="flex flex-col items-start gap-0.5 sm:gap-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <ScreensaverWeatherIcon code={weather.weatherCode} />
                <span className="text-3xl sm:text-5xl md:text-7xl font-light text-white drop-shadow-lg">
                  {Math.round(weather.temperature)}°
                </span>
              </div>
              {weatherConfig?.locationName && (
                <span className="flex items-center gap-1.5 text-xs sm:text-sm text-white/70 drop-shadow">
                  <CloudSun className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {weatherConfig.locationName}
                </span>
              )}
            </div>
          )}

          {/* Clock + Date + Events (bottom-right) */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1 ml-auto">
            <span className="text-4xl sm:text-6xl md:text-8xl font-light tracking-tight text-white drop-shadow-lg">
              {timeStr}
            </span>
            <span className="text-sm sm:text-lg md:text-2xl font-light text-white/80 drop-shadow">
              {dateStr}
            </span>
            {/* Today's events below the date */}
            {todayEvents.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {todayEvents.map((evt: CalendarEvent) => {
                  const isPast = new Date(evt.endAt).getTime() <= now.getTime();
                  return (
                    <div key={evt.id} className={`flex items-center gap-2 justify-end ${isPast ? 'opacity-40' : ''}`}>
                      <span className="text-xs sm:text-sm text-white/60 drop-shadow whitespace-nowrap">
                        {evt.isAllDay ? 'All day' : formatEventTime(evt.startAt, clockFormat === '12h')}
                      </span>
                      <span className="text-xs sm:text-sm text-white drop-shadow truncate max-w-[200px]">
                        {evt.title}
                      </span>
                      <div
                        className="w-[3px] h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: sourceColorMap.get(evt.sourceId) ?? '#6366f1' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
