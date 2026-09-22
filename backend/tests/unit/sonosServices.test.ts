import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/integrationConfigService.js', () => ({
  getIntegrationConfig: vi.fn().mockReturnValue(null),
  getIntegrationConfigs: vi.fn().mockReturnValue({}),
  setIntegrationConfig: vi.fn(),
  setIntegrationConfigs: vi.fn(),
  deleteIntegrationConfigs: vi.fn(),
}));

import {
  aggregateMusicServices,
  extractServiceObservation,
  parseAvailableServiceDescriptors,
  parseFirmwareServiceAccounts,
} from '../../src/services/sonos-local-service.js';

describe('Sonos music-service discovery', () => {
  const catalogXml = `
    <Services>
      <Service Id="12" Name="Spotify" Version="1.1" Uri="https://example.test"
        SecureUri="https://secure.example.test" Capabilities="513">
        <Policy Auth="OAuth" PollInterval="30" />
        <Presentation />
      </Service>
      <Service Id="284" Name="YouTube Music" Capabilities="257">
        <Policy Auth="DeviceLink" />
      </Service>
    </Services>
  `;

  it('parses only the safe catalog fields needed by the client', () => {
    expect(parseAvailableServiceDescriptors(catalogXml)).toEqual([
      {
        serviceId: 12,
        serviceType: 3079,
        name: 'Spotify',
        auth: 'OAuth',
        capabilities: 513,
      },
      {
        serviceId: 284,
        serviceType: 72711,
        name: 'YouTube Music',
        auth: 'DeviceLink',
        capabilities: 257,
      },
    ]);
  });

  it('extracts linked account identity while excluding secret fields and deleted accounts', () => {
    const xml = `
      <Accounts>
        <Account Type="3079" SerialNum="5" Deleted="0">
          <UN>private@example.test</UN>
          <Key>do-not-return</Key>
          <OADevID>also-private</OADevID>
          <NN>Family &amp; Friends</NN>
        </Account>
        <Account Type="72711" SerialNum="4" Deleted="1">
          <NN>Removed</NN>
        </Account>
      </Accounts>
    `;

    const parsed = parseFirmwareServiceAccounts(xml);

    expect(parsed).toEqual({
      inventoryAvailable: true,
      accounts: [{ serviceType: 3079, serialNumber: 5, nickname: 'Family & Friends' }],
    });
    expect(JSON.stringify(parsed)).not.toContain('private@example.test');
    expect(JSON.stringify(parsed)).not.toContain('do-not-return');
    expect(JSON.stringify(parsed)).not.toContain('also-private');
  });

  it('reports unavailable inventory for firmware support documents without Accounts', () => {
    expect(parseFirmwareServiceAccounts('<ZPSupportInfo />')).toEqual({
      accounts: [],
      inventoryAvailable: false,
    });
  });

  it('extracts service and account IDs from URI or escaped metadata parameters', () => {
    expect(
      extractServiceObservation(
        'x-sonos-spotify:spotify:track:abc?sid=12&amp;flags=8232&amp;sn=5',
        'favorite',
      ),
    ).toEqual({
      source: 'favorite',
      serviceId: 12,
      accountSerial: 5,
      serviceName: 'Spotify',
    });
  });

  it('deduplicates evidence, applies labels, and retains source provenance', () => {
    const catalog = parseAvailableServiceDescriptors(catalogXml);
    const result = aggregateMusicServices({
      catalog,
      firmwareAccounts: [
        {
          serviceType: 3079,
          serialNumber: 5,
          nickname: 'Household Spotify',
        },
      ],
      observations: [
        { source: 'favorite', serviceId: 12, accountSerial: 5 },
        { source: 'playback', serviceId: 12, accountSerial: 5 },
        { source: 'favorite', serviceId: 284, accountSerial: 4 },
      ],
      labels: {
        'sn:5': "Dad's Spotify",
        'sn:4': 'Family YouTube',
      },
      inventoryAvailable: true,
    });

    expect(result).toEqual({
      completeness: 'complete',
      warnings: [],
      services: [
        {
          id: 'sid:12',
          name: 'Spotify',
          serviceId: 12,
          serviceType: 3079,
          auth: 'OAuth',
          capabilities: 513,
          sources: ['favorite', 'firmware', 'playback'],
          accounts: [
            {
              serialNumber: 5,
              nickname: 'Household Spotify',
              label: "Dad's Spotify",
              sources: ['favorite', 'firmware', 'playback'],
            },
          ],
        },
        {
          id: 'sid:284',
          name: 'YouTube Music',
          serviceId: 284,
          serviceType: 72711,
          auth: 'DeviceLink',
          capabilities: 257,
          sources: ['favorite'],
          accounts: [
            {
              serialNumber: 4,
              label: 'Family YouTube',
              sources: ['favorite'],
            },
          ],
        },
      ],
    });
  });

  it('returns observed-only services instead of the full regional catalog', () => {
    const result = aggregateMusicServices({
      catalog: parseAvailableServiceDescriptors(catalogXml),
      firmwareAccounts: [],
      observations: [{ source: 'favorite', serviceId: 12, accountSerial: 5 }],
      inventoryAvailable: false,
      warnings: ['firmware_account_inventory_unavailable'],
    });

    expect(result.completeness).toBe('observed');
    expect(result.services.map((service) => service.name)).toEqual(['Spotify']);
    expect(result.warnings).toEqual(['firmware_account_inventory_unavailable']);
  });

  it('deduplicates firmware and URI evidence when the catalog is unavailable', () => {
    const result = aggregateMusicServices({
      catalog: [],
      firmwareAccounts: [{ serviceType: 3079, serialNumber: 5 }],
      observations: [
        {
          source: 'favorite',
          serviceId: 12,
          accountSerial: 5,
          serviceName: 'Spotify',
        },
      ],
      inventoryAvailable: true,
    });

    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({
      id: 'sid:12',
      name: 'Spotify',
      serviceId: 12,
      accounts: [{ serialNumber: 5, sources: ['favorite', 'firmware'] }],
    });
  });
});
