/**
 * UniFi Network Controller service — proxies UniFi OS API calls.
 * Stores connection config with encrypted username/password.
 * Uses UniFi OS session-based auth: POST /api/auth/login → cookie.
 */

import crypto from 'node:crypto';
import { Agent, fetch as undiFetch } from 'undici';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { unifiInstances, widgetConnections } from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { Errors } from '../lib/errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnifiConfigPublic {
  id: string;
  widgetInstanceId: string;
  baseUrl: string;
  siteName: string;
  pollIntervalSec: number;
  hasCredentials: boolean;
}

export interface UnifiStats {
  clients: { total: number; wired: number; wireless: number };
  gateway: UnifiGateway | null;
  devices: UnifiDevice[];
  wan: UnifiWan | null;
  wifi: UnifiWifiNetwork[];
  ips: UnifiIps;
  health: UnifiHealth;
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

export interface UnifiIps {
  enabled: boolean;
  totalBlocked: number;
}

export interface UnifiHealth {
  cpu: number | null;
  mem: number | null;
  temp: number | null;
  uptime: number | null;
  version: string | null;
}

export interface UnifiConnectionTestResult {
  success: boolean;
  version?: string;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10000;

// Allow self-signed certs (UniFi uses self-signed by default)
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

// Session cache: instanceId → { cookie, baseUrl, expiresAt }
const sessionCache = new Map<
  string,
  { cookie: string; baseUrl: string; siteName: string; expiresAt: number }
>();
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// Dedup concurrent login attempts per instanceId
const loginInflight = new Map<
  string,
  Promise<{ cookie: string; baseUrl: string; siteName: string }>
>();

async function uniFetch(baseUrl: string, path: string, cookie: string) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await undiFetch(url, {
      headers: { Cookie: cookie },
      signal: controller.signal,
      dispatcher,
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function uniFetchPost(baseUrl: string, path: string, cookie: string, body: unknown) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await undiFetch(url, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher,
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await undiFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
      dispatcher,
    });
    if (!resp.ok) {
      throw new Error(`Auth failed: ${resp.status} ${resp.statusText}`);
    }
    // Extract session cookies
    const setCookies = resp.headers.getSetCookie?.() ?? [];
    const cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
    if (!cookies) {
      // Fallback: some versions use TOKEN header
      const token = resp.headers.get('x-csrf-token') || '';
      return token ? `TOKEN=${token}` : '';
    }
    return cookies;
  } finally {
    clearTimeout(timer);
  }
}

async function getSession(
  instanceId: string,
): Promise<{ cookie: string; baseUrl: string; siteName: string }> {
  const cached = sessionCache.get(instanceId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  // Dedup concurrent logins
  const inflight = loginInflight.get(instanceId);
  if (inflight) return inflight;

  const promise = (async () => {
    const db = getDb();
    const row = db.select().from(unifiInstances).where(eq(unifiInstances.id, instanceId)).get();
    if (!row) throw Errors.notFound('UniFi instance not found');

    const username = decryptToken(row.usernameEncrypted);
    const password = decryptToken(row.passwordEncrypted);
    const cookie = await login(row.baseUrl, username, password);
    const session = { cookie, baseUrl: row.baseUrl, siteName: row.siteName };
    sessionCache.set(instanceId, { ...session, expiresAt: Date.now() + SESSION_TTL_MS });
    return session;
  })();

  loginInflight.set(instanceId, promise);
  try {
    return await promise;
  } finally {
    loginInflight.delete(instanceId);
  }
}

function invalidateSession(instanceId: string) {
  sessionCache.delete(instanceId);
}

// ─── Config CRUD ────────────────────────────────────────────────────────────

export function getUnifiConfig(widgetInstanceId: string): UnifiConfigPublic | null {
  const db = getDb();
  // Find via widget_connections join
  const conn = db
    .select()
    .from(widgetConnections)
    .where(eq(widgetConnections.widgetInstanceId, widgetInstanceId))
    .all()
    .find((c) => c.connectionType === 'unifi');

  if (!conn) return null;

  const row = db
    .select()
    .from(unifiInstances)
    .where(eq(unifiInstances.id, conn.connectionId))
    .get();
  if (!row) return null;

  return {
    id: row.id,
    widgetInstanceId,
    baseUrl: row.baseUrl,
    siteName: row.siteName,
    pollIntervalSec: row.pollIntervalSec,
    hasCredentials: true,
  };
}

export function saveUnifiConfig(
  widgetInstanceId: string,
  baseUrl: string,
  username: string,
  password: string,
  siteName: string,
  pollIntervalSec: number,
): UnifiConfigPublic {
  const db = getDb();
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  const now = new Date().toISOString();

  // Check for existing connection
  const existingConn = db
    .select()
    .from(widgetConnections)
    .where(eq(widgetConnections.widgetInstanceId, widgetInstanceId))
    .all()
    .find((c) => c.connectionType === 'unifi');

  let instanceId: string;

  if (existingConn) {
    instanceId = existingConn.connectionId;
    // Update existing
    db.update(unifiInstances)
      .set({
        baseUrl: normalizedUrl,
        usernameEncrypted: encryptToken(username),
        passwordEncrypted: encryptToken(password),
        siteName,
        pollIntervalSec,
        updatedAt: now,
      })
      .where(eq(unifiInstances.id, instanceId))
      .run();
    // Invalidate cached session
    invalidateSession(instanceId);
  } else {
    instanceId = crypto.randomUUID();
    db.insert(unifiInstances)
      .values({
        id: instanceId,
        baseUrl: normalizedUrl,
        usernameEncrypted: encryptToken(username),
        passwordEncrypted: encryptToken(password),
        siteName,
        pollIntervalSec,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(widgetConnections)
      .values({
        widgetInstanceId,
        connectionType: 'unifi',
        connectionId: instanceId,
      })
      .run();
  }

  return {
    id: instanceId,
    widgetInstanceId,
    baseUrl: normalizedUrl,
    siteName,
    pollIntervalSec,
    hasCredentials: true,
  };
}

export function deleteUnifiConfig(widgetInstanceId: string): void {
  const db = getDb();
  const conn = db
    .select()
    .from(widgetConnections)
    .where(eq(widgetConnections.widgetInstanceId, widgetInstanceId))
    .all()
    .find((c) => c.connectionType === 'unifi');

  if (conn) {
    invalidateSession(conn.connectionId);
    db.delete(unifiInstances).where(eq(unifiInstances.id, conn.connectionId)).run();
    // widget_connections cleaned via cascade or manual
    db.delete(widgetConnections)
      .where(eq(widgetConnections.widgetInstanceId, widgetInstanceId))
      .run();
  }
}

// ─── Connection Test ────────────────────────────────────────────────────────

export async function testUnifiConnection(
  baseUrl: string,
  username: string,
  password: string,
): Promise<UnifiConnectionTestResult> {
  try {
    const normalizedUrl = baseUrl.replace(/\/+$/, '');
    const cookie = await login(normalizedUrl, username, password);
    if (!cookie) {
      return { success: false, message: 'Login succeeded but no session cookie received' };
    }
    // Try fetching site health to verify
    const resp = await uniFetch(normalizedUrl, '/proxy/network/api/s/default/stat/health', cookie);
    if (!resp.ok) {
      return { success: false, message: `Connected but health check failed: ${resp.status}` };
    }
    const data = (await resp.json()) as {
      meta?: { rc?: string };
      data?: Array<{ gw_version?: string }>;
    };
    const gwSub = data.data?.find(
      (s: Record<string, unknown>) => s['subsystem'] === 'www' || s['gw_version'],
    );
    const version = gwSub?.gw_version ?? 'unknown';
    return { success: true, version, message: `Connected successfully (v${version})` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: msg };
  }
}

// ─── Stats Fetching ─────────────────────────────────────────────────────────

export async function fetchUnifiStats(widgetInstanceId: string): Promise<UnifiStats> {
  const config = getUnifiConfig(widgetInstanceId);
  if (!config) throw Errors.notFound('UniFi not configured for this widget');

  const session = await getSession(config.id);
  const { cookie, baseUrl, siteName } = session;
  const siteBase = `/proxy/network/api/s/${siteName}`;

  try {
    // Fetch all data in parallel
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [clientsResp, devicesResp, healthResp, wlanResp, monthlyResp, networkResp] =
      await Promise.all([
        uniFetch(baseUrl, `${siteBase}/stat/sta`, cookie),
        uniFetch(baseUrl, `${siteBase}/stat/device`, cookie),
        uniFetch(baseUrl, `${siteBase}/stat/health`, cookie),
        uniFetch(baseUrl, `${siteBase}/rest/wlanconf`, cookie),
        uniFetchPost(baseUrl, `${siteBase}/stat/report/monthly.wan`, cookie, {
          attrs: ['rx_bytes', 'tx_bytes', 'wan-rx_bytes', 'wan-tx_bytes'],
          start: startOfMonth.getTime(),
          end: Date.now(),
        }),
        uniFetch(baseUrl, `${siteBase}/rest/networkconf`, cookie),
      ]);

    // Check for 401 — invalidate session and retry once
    if (clientsResp.status === 401 || devicesResp.status === 401) {
      invalidateSession(config.id);
      return fetchUnifiStats(widgetInstanceId);
    }

    const clientsData = clientsResp.ok
      ? (((await clientsResp.json()) as { data?: unknown[] }).data ?? [])
      : [];
    const devicesData = devicesResp.ok
      ? (((await devicesResp.json()) as { data?: unknown[] }).data ?? [])
      : [];
    const healthData = healthResp.ok
      ? (((await healthResp.json()) as { data?: unknown[] }).data ?? [])
      : [];
    const wlanData = wlanResp.ok
      ? (((await wlanResp.json()) as { data?: unknown[] }).data ?? [])
      : [];
    const monthlyData = monthlyResp.ok
      ? (((await monthlyResp.json()) as { data?: unknown[] }).data ?? [])
      : [];
    const networkData = networkResp.ok
      ? (((await networkResp.json()) as { data?: unknown[] }).data ?? [])
      : [];

    // Parse clients
    const clients = parseClients(clientsData as Record<string, unknown>[]);

    // Parse devices
    const devices = parseDevices(devicesData as Record<string, unknown>[]);

    // Parse gateway device info
    const gateway = parseGateway(
      devicesData as Record<string, unknown>[],
      clients,
      wlanData as Record<string, unknown>[],
      clientsData as Record<string, unknown>[],
      networkData as Record<string, unknown>[],
      healthData as Record<string, unknown>[],
    );

    // Parse WAN from health + monthly report + gateway uptime
    const gwDevice = (devicesData as Record<string, unknown>[]).find(
      (d) => d['type'] === 'ugw' || d['type'] === 'udm' || d['type'] === 'ucg',
    );
    const wan = parseWan(
      healthData as Record<string, unknown>[],
      monthlyData as Record<string, unknown>[],
      gwDevice,
    );

    // Parse WiFi networks
    const wifi = parseWifi(
      wlanData as Record<string, unknown>[],
      clientsData as Record<string, unknown>[],
    );

    // Parse IPS from health
    const ips = parseIps(healthData as Record<string, unknown>[]);

    // Parse overall health
    const health = parseHealth(
      healthData as Record<string, unknown>[],
      devicesData as Record<string, unknown>[],
    );

    return { clients, gateway, devices, wan, wifi, ips, health };
  } catch (err) {
    // On network error, invalidate and rethrow
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('fetch'))) {
      invalidateSession(config.id);
    }
    throw err;
  }
}

/**
 * fetchRawData — returns raw API responses for debugging field names.
 */
export async function fetchRawData(widgetInstanceId: string): Promise<Record<string, unknown>> {
  const config = getUnifiConfig(widgetInstanceId);
  if (!config) throw Errors.notFound('UniFi not configured');

  const session = await getSession(config.id);
  const { cookie, baseUrl, siteName } = session;
  const siteBase = `/proxy/network/api/s/${siteName}`;

  const [healthResp, devicesResp, monthlyResp, wlanResp, networkResp] = await Promise.all([
    uniFetch(baseUrl, `${siteBase}/stat/health`, cookie),
    uniFetch(baseUrl, `${siteBase}/stat/device`, cookie),
    uniFetch(baseUrl, `${siteBase}/stat/report/monthly.wan`, cookie),
    uniFetch(baseUrl, `${siteBase}/rest/wlanconf`, cookie),
    uniFetch(baseUrl, `${siteBase}/rest/networkconf`, cookie),
  ]);

  const health = healthResp.ok ? await healthResp.json() : { error: healthResp.status };
  const devices = devicesResp.ok ? await devicesResp.json() : { error: devicesResp.status };
  const monthly = monthlyResp.ok ? await monthlyResp.json() : { error: monthlyResp.status };
  const wlan = wlanResp.ok ? await wlanResp.json() : { error: wlanResp.status };
  const network = networkResp.ok ? await networkResp.json() : { error: networkResp.status };

  return {
    health,
    devices,
    monthly,
    wlan,
    network,
  };
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseClients(data: Record<string, unknown>[]): UnifiStats['clients'] {
  const total = data.length;
  const wireless = data.filter((c) => c['is_wired'] === false || c['essid']).length;
  const wired = total - wireless;
  return { total, wired, wireless };
}

function parseDevices(data: Record<string, unknown>[]): UnifiDevice[] {
  return data.map((d) => {
    const sysStats = (d['system-stats'] ?? d['sys_stats'] ?? {}) as Record<string, unknown>;
    return {
      name: (d['name'] as string) || (d['mac'] as string) || 'Unknown',
      mac: (d['mac'] as string) || '',
      model: (d['model'] as string) || '',
      type: (d['type'] as string) || 'unknown',
      ip: (d['ip'] as string) || '',
      version: (d['version'] as string) || '',
      uptime: (d['uptime'] as number) || 0,
      cpu: sysStats['cpu'] != null ? Number(sysStats['cpu']) : null,
      mem: sysStats['mem'] != null ? Number(sysStats['mem']) : null,
      temp:
        sysStats['temps'] != null
          ? Number(
              (sysStats['temps'] as Record<string, unknown>)?.['Board (CPU)'] ?? sysStats['temps'],
            )
          : null,
      clients: (d['num_sta'] as number) || 0,
      status: d['state'] === 1 ? 'online' : d['state'] === 0 ? 'offline' : 'adopting',
    };
  });
}

function parseGateway(
  devicesData: Record<string, unknown>[],
  clients: { total: number; wired: number; wireless: number },
  wlanData: Record<string, unknown>[],
  clientsData: Record<string, unknown>[],
  networkData: Record<string, unknown>[],
  healthData: Record<string, unknown>[],
): UnifiGateway | null {
  const gw = devicesData.find(
    (d) => d['type'] === 'ugw' || d['type'] === 'udm' || d['type'] === 'ucg',
  );
  if (!gw) return null;
  const sysStats = (gw['system-stats'] ?? gw['sys_stats'] ?? {}) as Record<string, unknown>;

  // LAN IP: from config_network, network_table, or fallback to the LAN interface
  const configNetwork = gw['config_network'] as Record<string, unknown> | undefined;
  const networkTable = gw['network_table'] as Record<string, unknown>[] | undefined;
  let lanIp = '';
  if (configNetwork?.['ip']) {
    lanIp = configNetwork['ip'] as string;
  } else if (networkTable) {
    const lanNet = networkTable.find((n) => n['name'] === 'LAN' || n['purpose'] === 'corporate');
    if (lanNet) lanIp = (lanNet['ip_subnet'] as string)?.split('/')[0] ?? '';
  }
  if (!lanIp) {
    // Last resort: check if there's a `lan_ip` field
    lanIp = (gw['lan_ip'] as string) || (gw['connect_request_ip'] as string) || '';
  }

  // WiFi networks from wlan config — cross-reference networkconf for subnets
  const wifiNetworks = wlanData
    .filter((w) => w['enabled'] !== false)
    .map((w) => {
      const ssid = (w['name'] as string) || '';
      const wlanClients = clientsData.filter((c) => c['essid'] === ssid).length;
      // Determine bands
      const wlanBands = (w['wlan_bands'] as string[]) || [];
      const band =
        wlanBands.length > 0
          ? wlanBands
              .map((b) => b.replace('ng', '2g').replace('na', '5g').replace('6e', '6g'))
              .join('/')
          : (w['wlan_band'] as string) || 'both';
      // Find associated network subnet via networkconf_id or matching network
      const netId = (w['networkconf_id'] as string) || '';
      const assocNet = netId ? networkData.find((n) => n['_id'] === netId) : null;
      const subnet = (assocNet?.['ip_subnet'] as string) || '';
      return { name: ssid, bands: band, clients: wlanClients, subnet };
    });

  // VPN: check networkconf for actual VPN networks (purpose=vpn or explicit vpn_type)
  const vpnNets = networkData.filter(
    (n) => n['purpose'] === 'vpn' || (n['vpn_type'] != null && n['vpn_type'] !== ''),
  );
  let vpn: UnifiGateway['vpn'] = null;
  const vpnSubnets: { name: string; type: string; subnet: string; enabled: boolean }[] = [];
  for (const vn of vpnNets) {
    const rawType = (vn['vpn_type'] as string) || '';
    let vpnType = 'VPN';
    if (rawType.includes('wireguard')) vpnType = 'WireGuard';
    else if (rawType.includes('openvpn')) vpnType = 'OpenVPN';
    else if (rawType.includes('ipsec') || rawType.includes('l2tp')) vpnType = 'IPsec/L2TP';
    else if (rawType) vpnType = rawType;
    const subnet = (vn['ip_subnet'] as string) || (vn['server_address_space'] as string) || '';
    vpnSubnets.push({
      name: (vn['name'] as string) || vpnType,
      type: vpnType,
      subnet,
      enabled: vn['enabled'] !== false,
    });
    if (!vpn) {
      vpn = { enabled: vn['enabled'] !== false, type: vpnType };
    }
  }
  // Fallback: check gateway device for WireGuard/OpenVPN features
  if (!vpn) {
    const features = gw['feature_cap'] as Record<string, unknown> | undefined;
    if (features?.['wireguard']) {
      vpn = { enabled: true, type: 'WireGuard' };
    }
  }

  // IDPS from health data
  const ipsSub = healthData.find((s) => s['subsystem'] === 'ips' || s['subsystem'] === 'ids');
  let idps: UnifiGateway['idps'] = null;
  if (ipsSub) {
    idps = {
      enabled: true,
      blocked: (ipsSub['blocked_count'] as number) || (ipsSub['total_blocked'] as number) || 0,
    };
  }

  return {
    name: (gw['name'] as string) || (gw['model'] as string) || 'Gateway',
    model: (gw['model'] as string) || '',
    lanIp,
    version: (gw['version'] as string) || '',
    osVersion: (gw['displayable_version'] as string) || (gw['os_version'] as string) || null,
    uptime: (gw['uptime'] as number) || 0,
    cpu: sysStats['cpu'] != null ? Number(sysStats['cpu']) : null,
    mem: sysStats['mem'] != null ? Number(sysStats['mem']) : null,
    temp:
      sysStats['temps'] != null
        ? Number((sysStats['temps'] as Record<string, unknown>)?.['Board (CPU)'] ?? 0)
        : null,
    wiredClients: clients.wired,
    wirelessClients: clients.wireless,
    totalClients: clients.total,
    wifiNetworks,
    vpn,
    vpnSubnets,
    idps,
  };
}

function guessIspDomain(ispName: string | null): string | null {
  if (!ispName) return null;
  const lower = ispName.toLowerCase().trim();
  // Known ISP mappings
  const mappings: Record<string, string> = {
    'aussie broadband': 'aussiebroadband.com.au',
    telstra: 'telstra.com.au',
    optus: 'optus.com.au',
    tpg: 'tpg.com.au',
    iinet: 'iinet.net.au',
    superloop: 'superloop.com',
    vodafone: 'vodafone.com.au',
    comcast: 'xfinity.com',
    'at&t': 'att.com',
    verizon: 'verizon.com',
    spectrum: 'spectrum.com',
    bt: 'bt.com',
    'virgin media': 'virginmedia.com',
    'sky broadband': 'sky.com',
  };
  if (mappings[lower]) return mappings[lower];
  // Fallback: slugify and try .com
  const slug = lower.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : null;
}

function parseWan(
  healthData: Record<string, unknown>[],
  monthlyData: Record<string, unknown>[],
  gwDevice: Record<string, unknown> | undefined,
): UnifiWan | null {
  const wanSub = healthData.find((s) => s['subsystem'] === 'wan');
  if (!wanSub) return null;

  // Monthly usage: sum all daily entries for current month
  let monthlyRx = 0;
  let monthlyTx = 0;
  for (const entry of monthlyData) {
    monthlyRx += (entry['wan-rx_bytes'] as number) || (entry['rx_bytes'] as number) || 0;
    monthlyTx += (entry['wan-tx_bytes'] as number) || (entry['tx_bytes'] as number) || 0;
  }

  // WAN uptime: prefer health subsystem, fallback to gateway device uptime
  let uptime = (wanSub['uptime'] as number) || 0;
  if (!uptime && gwDevice) {
    uptime = (gwDevice['uptime'] as number) || 0;
  }

  // IPv6: check multiple possible field names
  // IPv6 — may be a string or an array of addresses; return all
  const rawIpv6 =
    wanSub['ipv6_wan_ip'] ||
    wanSub['wan_ipv6'] ||
    wanSub['ipv6'] ||
    (gwDevice?.['wan1'] as Record<string, unknown> | undefined)?.['ipv6'] ||
    null;
  let ipv6List: string[] = [];
  if (Array.isArray(rawIpv6)) {
    ipv6List = rawIpv6.filter(
      (v): v is string => typeof v === 'string' && v.length > 0 && !v.startsWith('fe80'),
    );
  } else if (typeof rawIpv6 === 'string' && rawIpv6.length > 0 && !rawIpv6.startsWith('fe80')) {
    ipv6List = [rawIpv6];
  }

  const ispName = (wanSub['isp_name'] as string) || null;
  return {
    ip: (wanSub['wan_ip'] as string) || '',
    ipv6: ipv6List,
    gateway: (wanSub['gateways'] as string[])?.join(', ') || '',
    uptime,
    rxBytes: (wanSub['rx_bytes'] as number) || 0,
    txBytes: (wanSub['tx_bytes'] as number) || 0,
    rxRate: (wanSub['rx_bytes-r'] as number) || 0,
    txRate: (wanSub['tx_bytes-r'] as number) || 0,
    monthlyRx,
    monthlyTx,
    isp: ispName,
    ispDomain: guessIspDomain(ispName),
  };
}

function parseWifi(
  wlanData: Record<string, unknown>[],
  clientsData: Record<string, unknown>[],
): UnifiWifiNetwork[] {
  return wlanData
    .filter((w) => w['enabled'] !== false)
    .map((w) => {
      const ssid = (w['name'] as string) || '';
      const clients = clientsData.filter((c) => c['essid'] === ssid).length;
      return {
        name: ssid,
        enabled: w['enabled'] !== false,
        clients,
        band: (w['wlan_band'] as string) || 'both',
      };
    });
}

function parseIps(healthData: Record<string, unknown>[]): UnifiIps {
  const ipsSub = healthData.find((s) => s['subsystem'] === 'ips' || s['subsystem'] === 'ids');
  if (!ipsSub) return { enabled: false, totalBlocked: 0 };
  return {
    enabled: true,
    totalBlocked: (ipsSub['blocked_count'] as number) || (ipsSub['total_blocked'] as number) || 0,
  };
}

function parseHealth(
  healthData: Record<string, unknown>[],
  devicesData: Record<string, unknown>[],
): UnifiHealth {
  // Find gateway device for CPU/mem/temp
  const gw = devicesData.find(
    (d) => d['type'] === 'ugw' || d['type'] === 'udm' || d['type'] === 'ucg',
  );
  const sysStats = gw
    ? ((gw['system-stats'] ?? gw['sys_stats'] ?? {}) as Record<string, unknown>)
    : {};
  const wwwSub = healthData.find((s) => s['subsystem'] === 'www');

  return {
    cpu: sysStats['cpu'] != null ? Number(sysStats['cpu']) : null,
    mem: sysStats['mem'] != null ? Number(sysStats['mem']) : null,
    temp:
      sysStats['temps'] != null
        ? Number((sysStats['temps'] as Record<string, unknown>)?.['Board (CPU)'] ?? 0)
        : null,
    uptime: (gw?.['uptime'] as number) || null,
    version: (gw?.['version'] as string) || (wwwSub?.['gw_version'] as string) || null,
  };
}
