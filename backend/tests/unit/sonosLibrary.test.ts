import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/integrationConfigService.js', () => ({
  getIntegrationConfig: vi.fn().mockReturnValue(null),
  getIntegrationConfigs: vi.fn().mockReturnValue({}),
  setIntegrationConfig: vi.fn(),
  setIntegrationConfigs: vi.fn(),
  deleteIntegrationConfigs: vi.fn(),
}));

vi.mock('sonos', () => ({
  AsyncDeviceDiscovery: vi.fn(),
  Sonos: vi.fn(),
  Services: {},
}));

import {
  SonosContentDirectoryUnavailableError,
  normalizeSonosObjectId,
  orderSonosContentDirectoryCandidates,
  readFromFirstResponsiveDevice,
} from '../../src/services/sonos-local-service.js';

interface ReadResult {
  items?: Array<{ title: string }>;
  total?: string;
}

interface ReadDevice {
  read: () => Promise<ReadResult>;
}

describe('Sonos ContentDirectory reads', () => {
  it('falls back to the next discovered device after a UPnP failure', async () => {
    const firstRead = vi.fn<[], Promise<ReadResult>>().mockRejectedValue(new Error('upnp 500'));
    const secondRead = vi
      .fn<[], Promise<ReadResult>>()
      .mockResolvedValue({ items: [{ title: 'Music' }] });

    const result = await readFromFirstResponsiveDevice<ReadDevice, ReadResult>(
      [
        { name: 'Stale speaker', uuid: 'RINCON_STALE', device: { read: firstRead } },
        { name: 'Living room', uuid: 'RINCON_LIVING', device: { read: secondRead } },
      ],
      'browse share',
      (device) => device.read(),
    );

    expect(result).toEqual({ items: [{ title: 'Music' }] });
    expect(firstRead).toHaveBeenCalledTimes(1);
    expect(secondRead).toHaveBeenCalledTimes(1);
  });

  it('treats a successful empty response as valid without trying another device', async () => {
    const firstRead = vi.fn<[], Promise<ReadResult>>().mockResolvedValue({ total: '0' });
    const secondRead = vi.fn<[], Promise<ReadResult>>();

    const result = await readFromFirstResponsiveDevice<ReadDevice, ReadResult>(
      [
        { name: 'Living room', uuid: 'RINCON_LIVING', device: { read: firstRead } },
        { name: 'Kitchen', uuid: 'RINCON_KITCHEN', device: { read: secondRead } },
      ],
      'browse share',
      (device) => device.read(),
    );

    expect(result).toEqual({ total: '0' });
    expect(secondRead).not.toHaveBeenCalled();
  });

  it('throws a classified error after every discovered device fails', async () => {
    const livingRoomRead = vi
      .fn<[], Promise<ReadResult>>()
      .mockRejectedValue(new Error('upnp 500'));
    const kitchenRead = vi.fn<[], Promise<ReadResult>>().mockRejectedValue(new Error('timeout'));

    await expect(
      readFromFirstResponsiveDevice<ReadDevice, ReadResult>(
        [
          {
            name: 'Living room',
            uuid: 'RINCON_LIVING',
            device: { read: livingRoomRead },
          },
          {
            name: 'Kitchen',
            uuid: 'RINCON_KITCHEN',
            device: { read: kitchenRead },
          },
        ],
        'browse share',
        (device) => device.read(),
      ),
    ).rejects.toBeInstanceOf(SonosContentDirectoryUnavailableError);
  });

  it('prefers soundbars, then fixed speakers, and tries portable speakers last', () => {
    const ordered = orderSonosContentDirectoryCandidates([
      { name: 'Patio', uuid: 'RINCON_MOVE', model: 'Move 2', device: {} },
      { name: 'Office', uuid: 'RINCON_ONE', model: 'Sonos One', device: {} },
      { name: 'Living Room', uuid: 'RINCON_ARC', model: 'Arc Ultra', device: {} },
      { name: 'Guest Room', uuid: 'RINCON_ROAM', model: 'Roam', device: {} },
      { name: 'Den', uuid: 'RINCON_BEAM', model: 'Beam', device: {} },
    ]);

    expect(ordered.map((candidate) => candidate.uuid)).toEqual([
      'RINCON_ARC',
      'RINCON_BEAM',
      'RINCON_ONE',
      'RINCON_MOVE',
      'RINCON_ROAM',
    ]);
  });

  it('uses room names as a soundbar fallback without matching partial words', () => {
    const ordered = orderSonosContentDirectoryCandidates([
      { name: 'Arcade', uuid: 'RINCON_ARCADE', device: {} },
      { name: 'Living Room Beam', uuid: 'RINCON_BEAM', device: {} },
      { name: 'Office', uuid: 'RINCON_OFFICE', device: {} },
    ]);

    expect(ordered.map((candidate) => candidate.uuid)).toEqual([
      'RINCON_BEAM',
      'RINCON_ARCADE',
      'RINCON_OFFICE',
    ]);
  });

  it.each([
    ['x-rincon-playlist:RINCON_TEST#A:ALBUM/Family', 'A:ALBUM/Family'],
    ['x-file-cifs://media.home.arpa/music/Family', 'S://media.home.arpa/music/Family'],
    ['S://media.home.arpa/music/Family', 'S://media.home.arpa/music/Family'],
    ['S:', 'S:'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSonosObjectId(input)).toBe(expected);
  });
});
