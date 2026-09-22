/**
 * TanStack Query hooks for the UniFi Network Controller widget.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnifiConfig {
  configured: boolean;
  id?: string;
  widgetInstanceId?: string;
  baseUrl?: string;
  siteName?: string;
  pollIntervalSec?: number;
  hasCredentials?: boolean;
}

export interface UnifiDevice {
  name: string;
  mac: string;
  model: string;
  type: string;
  ip: string;
  version: string;
  uptime: number;
  cpu: number | null;
  mem: number | null;
  temp: number | null;
  clients: number;
  status: string;
}

export interface UnifiWan {
  ip: string;
  ipv6: string[];
  gateway: string;
  uptime: number;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  monthlyRx: number;
  monthlyTx: number;
  isp: string | null;
  ispDomain: string | null;
}

export interface UnifiWifiNetwork {
  name: string;
  enabled: boolean;
  clients: number;
  band: string;
}

export interface UnifiGateway {
  name: string;
  model: string;
  lanIp: string;
  version: string;
  osVersion: string | null;
  uptime: number;
  cpu: number | null;
  mem: number | null;
  temp: number | null;
  wiredClients: number;
  wirelessClients: number;
  totalClients: number;
  wifiNetworks: { name: string; bands: string; clients: number; subnet: string }[];
  vpn: { enabled: boolean; type: string } | null;
  vpnSubnets: { name: string; type: string; subnet: string; enabled: boolean }[];
  idps: { enabled: boolean; blocked: number } | null;
}

export interface UnifiStats {
  clients: { total: number; wired: number; wireless: number };
  gateway: UnifiGateway | null;
  devices: UnifiDevice[];
  wan: UnifiWan | null;
  wifi: UnifiWifiNetwork[];
  ips: { enabled: boolean; totalBlocked: number };
  health: {
    cpu: number | null;
    mem: number | null;
    temp: number | null;
    uptime: number | null;
    version: string | null;
  };
}

export interface UnifiTestResult {
  success: boolean;
  version?: string;
  message: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useUnifiConfig(widgetInstanceId: string | undefined) {
  return useQuery<UnifiConfig>({
    queryKey: ['unifi', 'config', widgetInstanceId],
    queryFn: () => apiClient.get<UnifiConfig>(`/api/unifi/config/${widgetInstanceId}`),
    enabled: !!widgetInstanceId,
  });
}

export function useUnifiStats(widgetInstanceId: string | undefined, pollInterval?: number) {
  return useQuery<UnifiStats>({
    queryKey: ['unifi', 'stats', widgetInstanceId],
    queryFn: () => apiClient.get<UnifiStats>(`/api/unifi/stats/${widgetInstanceId}`),
    enabled: !!widgetInstanceId,
    refetchInterval: (pollInterval ?? 60) * 1000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSaveUnifiConfig(widgetInstanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { baseUrl: string; username: string; password: string; siteName: string; pollIntervalSec: number }) =>
      apiClient.put(`/api/unifi/config/${widgetInstanceId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unifi', 'config', widgetInstanceId] });
      void qc.invalidateQueries({ queryKey: ['unifi', 'stats', widgetInstanceId] });
      toast.success('UniFi configuration saved');
    },
    onError: () => toast.error('Failed to save UniFi config'),
  });
}

export function useDeleteUnifiConfig(widgetInstanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/api/unifi/config/${widgetInstanceId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unifi', 'config', widgetInstanceId] });
      void qc.invalidateQueries({ queryKey: ['unifi', 'stats', widgetInstanceId] });
      toast.success('UniFi configuration removed');
    },
    onError: () => toast.error('Failed to delete UniFi config'),
  });
}

export function useTestUnifiConnection(widgetInstanceId: string) {
  return useMutation<UnifiTestResult, Error, { baseUrl: string; username: string; password: string }>({
    mutationFn: (data) =>
      apiClient.post<UnifiTestResult>(`/api/unifi/config/${widgetInstanceId}/test`, data),
  });
}
