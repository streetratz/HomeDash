import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

export interface PublicWidgetSnapshot<T> {
  widgetId: string;
  type: string;
  data: T;
  refreshedAt: string;
}

const PUBLIC_POLL_INTERVALS: Record<string, number> = {
  pihole: 30_000,
  unifi: 60_000,
  sonos_music: 5_000,
  stocks: 60_000,
  app_shortcuts: 60_000,
};

export function usePublicWidgetSnapshot<T>(
  widgetId: string,
  widgetType: string,
  enabled: boolean,
) {
  return useQuery<PublicWidgetSnapshot<T>>({
    queryKey: ['public-widget', widgetId],
    queryFn: () =>
      apiClient.get<PublicWidgetSnapshot<T>>(`/api/public/widgets/${widgetId}`),
    enabled: enabled && !!widgetId,
    staleTime: PUBLIC_POLL_INTERVALS[widgetType] ?? 60_000,
    refetchInterval: PUBLIC_POLL_INTERVALS[widgetType] ?? 60_000,
    retry: 1,
  });
}
