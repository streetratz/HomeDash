/**
 * Weather proxy service — uses BOM API for Australian locations,
 * falls back to Open-Meteo for international locations.
 * In-memory caching to avoid excessive requests.
 */

import { z } from 'zod';

export const WeatherRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  temperatureUnit: z.enum(['C', 'F']),
});

export type WeatherRequest = z.infer<typeof WeatherRequestSchema>;

interface CachedWeather {
  data: WeatherResult;
  fetchedAt: number;
}

export interface WeatherResult {
  temperature: number;
  temperatureUnit: 'C' | 'F';
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  isDay: boolean;
  timestamp: string;
  fetchedAt: string;
}

// Cache for 10 minutes keyed by lat/lon/unit, max 500 entries
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 500;
const cache = new Map<string, CachedWeather>();

function cacheKey(lat: number, lon: number, unit: string): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)},${unit}`;
}

/** WMO weather code to human condition string */
export function wmoCodeToCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return conditions[code] ?? 'Unknown';
}

// ─── Geohash encoding ─────────────────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat: number, lon: number, precision = 6): string {
  let latMin = -90,
    latMax = 90;
  let lonMin = -180,
    lonMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLon = true;

  while (hash.length < precision) {
    if (isLon) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonMin = mid;
      } else {
        ch = ch << 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    isLon = !isLon;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

// ─── BOM icon_descriptor → WMO code mapping ──────────────────────────────────

const BOM_ICON_TO_WMO: Record<string, number> = {
  sunny: 0,
  clear: 0,
  mostly_sunny: 1,
  partly_cloudy: 2,
  cloudy: 3,
  hazy: 3,
  fog: 45,
  frost: 45,
  light_rain: 61,
  rain: 63,
  heavy_rain: 65,
  drizzle: 51,
  shower: 80,
  showers: 80,
  light_shower: 80,
  light_showers: 80,
  heavy_showers: 82,
  wind: 2,
  windy: 2,
  storm: 95,
  storms: 95,
  thunderstorm: 95,
  snow: 73,
  heavy_snow: 75,
  light_snow: 71,
  sleet: 71,
  hail: 99,
  dust: 3,
  cyclone: 95,
  tropical_cyclone: 95,
};

// ─── BOM Australia check ──────────────────────────────────────────────────────

function isAustralianLocation(lat: number, lon: number): boolean {
  return lat >= -44.5 && lat <= -9.5 && lon >= 112.0 && lon <= 154.5;
}

// ─── BOM fetch ────────────────────────────────────────────────────────────────

interface BomObservation {
  temp: number | null;
  humidity: number | null;
  wind: { speed_kilometre: number | null } | null;
}

interface BomForecastDay {
  icon_descriptor: string | null;
  now?: { is_night: boolean };
}

async function fetchFromBom(req: WeatherRequest): Promise<WeatherResult> {
  const geohash = encodeGeohash(req.latitude, req.longitude);
  const headers = { 'User-Agent': 'HomeDash/1.0' };

  // Fetch observations and today's forecast in parallel
  const [obsRes, fcstRes] = await Promise.all([
    fetch(`https://api.weather.bom.gov.au/v1/locations/${geohash}/observations`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`https://api.weather.bom.gov.au/v1/locations/${geohash}/forecasts/daily`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!obsRes.ok) throw new Error(`BOM observations responded with ${obsRes.status}`);

  const obsJson = (await obsRes.json()) as { data: BomObservation };
  const obs = obsJson.data;

  // Get icon_descriptor from forecast for the condition
  let weatherCode = 2; // default: partly cloudy
  let isDay = true;
  if (fcstRes.ok) {
    const fcstJson = (await fcstRes.json()) as { data: BomForecastDay[] };
    const today = fcstJson.data?.[0];
    if (today?.icon_descriptor) {
      weatherCode = BOM_ICON_TO_WMO[today.icon_descriptor] ?? 2;
    }
    if (today?.now?.is_night) {
      isDay = false;
    }
  }

  let temperature = obs.temp ?? 0;
  if (req.temperatureUnit === 'F') {
    temperature = (temperature * 9) / 5 + 32;
  }

  const now = new Date().toISOString();
  return {
    temperature: Math.round(temperature * 10) / 10,
    temperatureUnit: req.temperatureUnit,
    weatherCode,
    humidity: obs.humidity ?? 0,
    windSpeed: obs.wind?.speed_kilometre ?? 0,
    precipitation: 0,
    isDay,
    timestamp: now,
    fetchedAt: now,
  };
}

// ─── Open-Meteo fallback (international) ──────────────────────────────────────

async function fetchFromOpenMeteo(req: WeatherRequest): Promise<WeatherResult> {
  const unit = req.temperatureUnit === 'F' ? 'fahrenheit' : 'celsius';
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', req.latitude.toString());
  url.searchParams.set('longitude', req.longitude.toString());
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation',
  );
  url.searchParams.set('temperature_unit', unit);
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('models', 'best_match');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo responded with ${res.status}`);
  }

  const json = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
      is_day: number;
      precipitation: number;
    };
  };

  const now = new Date().toISOString();
  return {
    temperature: json.current.temperature_2m,
    temperatureUnit: req.temperatureUnit,
    weatherCode: json.current.weather_code,
    humidity: json.current.relative_humidity_2m,
    windSpeed: json.current.wind_speed_10m,
    precipitation: json.current.precipitation ?? 0,
    isDay: json.current.is_day === 1,
    timestamp: json.current.time,
    fetchedAt: now,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function fetchWeather(req: WeatherRequest): Promise<WeatherResult> {
  const key = cacheKey(req.latitude, req.longitude, req.temperatureUnit);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  let result: WeatherResult;

  if (isAustralianLocation(req.latitude, req.longitude)) {
    try {
      result = await fetchFromBom(req);
    } catch {
      // Fallback to Open-Meteo if BOM fails
      result = await fetchFromOpenMeteo(req);
    }
  } else {
    result = await fetchFromOpenMeteo(req);
  }

  cache.set(key, { data: result, fetchedAt: Date.now() });

  // Evict oldest entry if cache exceeds limit
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  return result;
}

/** Clear cache (for testing) */
export function clearWeatherCache(): void {
  cache.clear();
}
