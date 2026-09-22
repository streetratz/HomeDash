/**
 * WeatherWidget — displays current weather with animated backgrounds.
 * Layer order: gradient bg → particles → glass → text content.
 */

import type { WidgetDisplayProps } from './registry.js';
import type { WeatherConfig } from '../../state/dashboards.js';
import { useWeather } from '../../hooks/useWeather.js';
import { Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from 'lucide-react';
import './weather-animations.css';

/** Cloud SVG path used for floating cloud animations */
const CLOUD_PATH = "M52.8 18.4A12 12 0 0 0 30 12a12 12 0 0 0-11.7 9.2A9 9 0 0 0 9 30a9 9 0 0 0 9 9h33a8 8 0 0 0 8-8 8 8 0 0 0-6.2-7.6Z";

/** Classify WMO code into a visual theme */
function weatherTheme(code: number, isNight: boolean): string {
  if (code === 0) return isNight ? 'night' : 'clear';
  if (code === 1 || code === 2) return isNight ? 'night' : 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 55) return 'drizzle';
  if (code <= 65) return 'rain';
  if (code <= 75) return 'snow';
  if (code <= 82) return 'rain';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

function wmoCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Mod. rain showers',
    82: 'Heavy rain showers',
    95: 'Thunderstorm',
    96: 'T-storm + hail',
    99: 'T-storm + heavy hail',
  };
  return conditions[code] ?? 'Unknown';
}

/** Generate rain drop style (deterministic from index) */
function dropStyle(i: number, count: number) {
  const s = Math.sin(i * 127.1 + 311.7);
  const r = s - Math.floor(s);
  return {
    left: `${(i / count) * 100 + r * 5}%`,
    height: `${10 + r * 14}px`,
    animationDuration: `${0.5 + r * 0.5}s`,
    animationDelay: `${((i * 7) % count) / count * 0.8}s`,
    opacity: 0.3 + r * 0.5,
  };
}

function RainDrops({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="weather-drop" style={dropStyle(i, count)} />
      ))}
    </>
  );
}

/** Generate snowflake style (deterministic from index) */
function flakeStyle(i: number, count: number) {
  const s = Math.sin(i * 43.758 + 137.2);
  const r = s - Math.floor(s);
  return {
    left: `${(i / count) * 100 + r * 5}%`,
    width: `${2 + r * 3}px`,
    height: `${2 + r * 3}px`,
    animationDuration: `${3 + r * 4}s`,
    animationDelay: `${((i * 11) % count) / count * 4}s`,
  };
}

function SnowFlakes({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="weather-flake" style={flakeStyle(i, count)} />
      ))}
    </>
  );
}

/** Floating SVG cloud icons for cloudy/partly-cloudy conditions */
function FloatingClouds({ count }: { count: number }) {
  const classes = ['weather-cloud-svg--1', 'weather-cloud-svg--2', 'weather-cloud-svg--3'];
  return (
    <>
      {classes.slice(0, count).map((cls) => (
        <div key={cls} className={`weather-cloud-svg ${cls}`}>
          <svg viewBox="0 0 64 40"><path d={CLOUD_PATH} /></svg>
        </div>
      ))}
    </>
  );
}

/** Fog layers */
function FogLayers() {
  return (
    <>
      <div className="weather-fog-layer weather-fog-layer--1" />
      <div className="weather-fog-layer weather-fog-layer--2" />
      <div className="weather-fog-layer weather-fog-layer--3" />
    </>
  );
}

/** Night stars + moon */
function NightSky() {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className={`weather-star weather-star--${i + 1}`} />
      ))}
      <div className="weather-moon" />
    </>
  );
}

/** Get weather icon component based on theme */
function WeatherIcon({ theme }: { theme: string }) {
  const cls = "h-5 w-5 drop-shadow-sm";
  switch (theme) {
    case 'clear':
      return <Sun className={`${cls} text-yellow-300`} />;
    case 'night':
      return <Moon className={`${cls} text-blue-200`} />;
    case 'partly-cloudy':
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

export function WeatherWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<WeatherConfig>;
  const { data, isLoading, error } = useWeather(
    config.latitude,
    config.longitude,
    config.temperatureUnit ?? 'C',
  );

  if (!config.latitude || !config.longitude) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm" data-testid="weather-widget-empty">
        No location configured
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm animate-pulse" data-testid="weather-widget-loading">
        Loading weather…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm" data-testid="weather-widget-error">
        Weather unavailable
      </div>
    );
  }

  const isNight = data.isDay === false;
  const theme = weatherTheme(data.weatherCode, isNight);
  const isRain = theme === 'rain' || theme === 'drizzle' || theme === 'storm';
  const isSnow = theme === 'snow';

  return (
    <div className={`weather-bg weather-bg--${theme} relative flex h-full flex-col overflow-hidden rounded-lg`} data-testid="weather-widget">
      {/* Layer 1: Animated particles */}
      <div className="weather-particles" aria-hidden="true">
        {isRain && <RainDrops count={theme === 'drizzle' ? 12 : theme === 'storm' ? 40 : 25} />}
        {isSnow && <SnowFlakes count={20} />}
        {(theme === 'cloudy' || theme === 'partly-cloudy') && (
          <FloatingClouds count={theme === 'partly-cloudy' ? 2 : 3} />
        )}
        {theme === 'fog' && <FogLayers />}
        {theme === 'night' && <NightSky />}
      </div>

      {/* Layer 2: Subtle glass */}
      <div className="weather-glass" aria-hidden="true" />

      {/* Lightning overlay (above glass for flash effect) */}
      {theme === 'storm' && <div className="weather-lightning" aria-hidden="true" />}

      {/* Layer 3: Content */}
      <div className="relative z-10 flex flex-col h-full p-4">
        {/* Spacer to push content down */}
        <div className="flex-1" />

        {/* Bottom area */}
        <div className="flex flex-col gap-1.5">
          {/* Condition + icon (left) and Temperature (right) */}
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <WeatherIcon theme={theme} />
                <p className="text-sm text-white/85" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  {wmoCondition(data.weatherCode)}
                </p>
              </div>
              {config.locationName && (
                <p className="text-[11px] text-white/60 font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  {config.locationName}
                </p>
              )}
            </div>
            <p className="text-5xl sm:text-6xl font-light text-white leading-none" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              {Math.round(data.temperature)}°
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 pt-2 border-t border-white/10">
            <span className="text-xs text-white/70 flex items-center gap-1">
              <span className="opacity-80">💧</span> {data.humidity}%
            </span>
            {data.precipitation != null && data.precipitation > 0 && (
              <span className="text-xs text-white/70 flex items-center gap-1">
                <span className="opacity-80">🌧</span> {data.precipitation}mm
              </span>
            )}
            <span className="text-xs text-white/70 flex items-center gap-1">
              <span className="opacity-80">💨</span> {data.windSpeed} km/h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
