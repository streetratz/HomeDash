/**
 * T041 (US8): useWeather — TanStack Query hook for weather data.
 */

import { useQuery } from '@tanstack/react-query';
import type { WeatherResponse } from '../state/dashboards.js';

/**
 * Fetches weather data via the public GET /api/weather endpoint.
 * Polls at the given interval.
 */
export function useWeather(
  latitude: number | undefined,
  longitude: number | undefined,
  temperatureUnit: 'C' | 'F' = 'C',
  pollIntervalMinutes = 15,
  enabled = true,
) {
  return useQuery<WeatherResponse>({
    queryKey: ['weather', latitude, longitude, temperatureUnit],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        unit: temperatureUnit,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
      return (await res.json()) as WeatherResponse;
    },
    refetchInterval: pollIntervalMinutes * 60 * 1000,
    enabled: enabled && latitude != null && longitude != null,
    staleTime: 5 * 60 * 1000,
  });
}
