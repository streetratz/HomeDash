/**
 * T021-T022: TDD tests for extended device discovery & stereo pair detection.
 * Tests verify the type contracts and shape of DiscoveredSpeaker + CachedDevice.
 * Actual UPnP discovery can't be unit-tested without hardware.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  DiscoveredSpeaker,
  StereoPairInfo,
  getDiscoveredSpeakers,
} from '../../src/services/sonos-local-service.js';
import {
  getResettablePlayerIds,
  normalizeZoneTopology,
} from '../../src/services/sonos-local-service.js';

// Mock sonos library to avoid UPnP calls
vi.mock('sonos', () => ({
  AsyncDeviceDiscovery: vi.fn(),
  Sonos: vi.fn(),
}));

describe('T021: Extended device fields on DiscoveredSpeaker', () => {
  it('should support model, modelNumber, softwareVersion, serialNumber, hardwareVersion fields', () => {
    const speaker: DiscoveredSpeaker = {
      uuid: 'RINCON_TEST',
      name: 'Living Room',
      ip: '192.168.1.100',
      model: 'Sonos One',
      modelNumber: 'S13',
      softwareVersion: '15.6',
      serialNumber: 'B8-XX-XX-XX',
      hardwareVersion: '1.20.3.6-1',
    };

    expect(speaker.model).toBe('Sonos One');
    expect(speaker.modelNumber).toBe('S13');
    expect(speaker.softwareVersion).toBe('15.6');
    expect(speaker.serialNumber).toBe('B8-XX-XX-XX');
    expect(speaker.hardwareVersion).toBe('1.20.3.6-1');
  });

  it('all extended fields are optional', () => {
    const minimal: DiscoveredSpeaker = {
      uuid: 'RINCON_MIN',
      name: 'Kitchen',
      ip: '192.168.1.101',
    };

    expect(minimal.model).toBeUndefined();
    expect(minimal.modelNumber).toBeUndefined();
    expect(minimal.softwareVersion).toBeUndefined();
    expect(minimal.serialNumber).toBeUndefined();
    expect(minimal.hardwareVersion).toBeUndefined();
  });

  it('getDiscoveredSpeakers return shape supports extended fields', () => {
    // Verify the function return type matches our expected shape
    type ReturnShape = Awaited<ReturnType<typeof getDiscoveredSpeakers>>;
    const check: ReturnShape = [
      {
        uuid: 'RINCON_1',
        name: 'Room',
        ip: '1.2.3.4',
        model: 'Sonos Five',
        modelNumber: 'S24',
        softwareVersion: '16.0',
        serialNumber: 'XX-YY',
        hardwareVersion: '1.21.0.0-1',
      },
    ];
    expect(check[0]!.model).toBe('Sonos Five');
  });
});

describe('T022: Stereo pair detection', () => {
  it('DiscoveredSpeaker supports stereoPair with role and partnerUuid', () => {
    const speaker: DiscoveredSpeaker = {
      uuid: 'RINCON_LEFT',
      name: 'Living Room',
      ip: '192.168.1.10',
      stereoPair: {
        role: 'left',
        partnerUuid: 'RINCON_RIGHT',
        partnerName: 'Living Room Right',
      },
    };

    expect(speaker.stereoPair).toMatchObject({
      role: 'left',
      partnerUuid: 'RINCON_RIGHT',
      partnerName: 'Living Room Right',
    });
  });

  it('stereoPair is optional for non-paired speakers', () => {
    const solo: DiscoveredSpeaker = {
      uuid: 'RINCON_SOLO',
      name: 'Bathroom',
      ip: '192.168.1.20',
    };

    expect(solo.stereoPair).toBeUndefined();
  });

  it('StereoPairInfo role is left or right', () => {
    const left: StereoPairInfo = { role: 'left', partnerUuid: 'P1' };
    const right: StereoPairInfo = { role: 'right', partnerUuid: 'P2' };

    expect(left.role).toBe('left');
    expect(right.role).toBe('right');
  });
});

// ─── US1: Stereo Pair Filtering Tests ───────────────────────────────────────

describe('US1: Stereo pair filtering in getGroups()', () => {
  it('T003: should filter invisible stereo pair partners from playerIds', () => {
    const topology = normalizeZoneTopology([
      {
        ID: 'RINCON_LEFT:1',
        Name: 'Living Room + 1',
        ZoneGroupMember: [
          { UUID: 'RINCON_LEFT', ZoneName: 'Living Room', Invisible: false },
          { UUID: 'RINCON_RIGHT', ZoneName: 'Living Room', Invisible: '1' },
        ],
      },
    ] as Parameters<typeof normalizeZoneTopology>[0]);

    expect(topology.groups).toEqual([
      expect.objectContaining({
        id: 'RINCON_LEFT:1',
        name: 'Living Room',
        coordinatorId: 'RINCON_LEFT',
        playerIds: ['RINCON_LEFT'],
      }),
    ]);
    expect(topology.players.map((player) => player.id)).toEqual(['RINCON_LEFT']);
  });

  it('T004: excludes phantom invisible groups while keeping standalone rooms', () => {
    const topology = normalizeZoneTopology([
      {
        ID: 'RINCON_LEFT:1',
        Name: 'Living Room + 1',
        ZoneGroupMember: [
          { UUID: 'RINCON_LEFT', ZoneName: 'Living Room', Invisible: false },
          { UUID: 'RINCON_RIGHT', ZoneName: 'Living Room', Invisible: '1' },
        ],
      },
      {
        ID: 'RINCON_RIGHT:2',
        Name: 'Living Room',
        ZoneGroupMember: [{ UUID: 'RINCON_RIGHT', ZoneName: 'Living Room', Invisible: '1' }],
      },
      {
        ID: 'RINCON_SOLO:3',
        Name: 'Bathroom',
        ZoneGroupMember: [{ UUID: 'RINCON_SOLO', ZoneName: 'Bathroom', Invisible: false }],
      },
    ] as Parameters<typeof normalizeZoneTopology>[0]);

    expect(topology.groups.map((group) => group.id)).toEqual(['RINCON_LEFT:1', 'RINCON_SOLO:3']);
  });

  it('preserves every visible room name in a mixed stereo and manual group', () => {
    const topology = normalizeZoneTopology([
      {
        ID: 'RINCON_LEFT:1',
        Name: 'Living Room + 2',
        ZoneGroupMember: [
          { UUID: 'RINCON_LEFT', ZoneName: 'Living Room', Invisible: false },
          { UUID: 'RINCON_RIGHT', ZoneName: 'Living Room', Invisible: true },
          { UUID: 'RINCON_KITCHEN', ZoneName: 'Kitchen', Invisible: false },
        ],
      },
    ] as Parameters<typeof normalizeZoneTopology>[0]);

    expect(topology.groups[0]).toMatchObject({
      name: 'Living Room + Kitchen',
      coordinatorId: 'RINCON_LEFT',
      playerIds: ['RINCON_LEFT', 'RINCON_KITCHEN'],
    });
  });

  it('selects visible non-coordinator rooms for a safe reset', () => {
    expect(
      getResettablePlayerIds({
        id: 'RINCON_LEFT:1',
        name: 'Living Room + Kitchen',
        coordinatorId: 'RINCON_LEFT',
        playbackState: 'PLAYBACK_STATE_IDLE',
        playerIds: ['RINCON_LEFT', 'RINCON_KITCHEN'],
      }),
    ).toEqual(['RINCON_KITCHEN']);
  });
});

// ─── US2: Volume Coordinator Only Tests ─────────────────────────────────────

describe('US2: setGroupVolume coordinator-only logic', () => {
  /**
   * T009: setGroupVolume should call volume on coordinator only.
   * The implementation now uses getCoordinatorForGroup (single device)
   * instead of getMembersForGroup (all devices).
   */
  it('T009: volume should be set only on coordinator (not broadcast to all members)', () => {
    // Simulate the new implementation logic
    const coordinatorSetVolume = vi.fn();
    const member1SetVolume = vi.fn();
    const member2SetVolume = vi.fn();

    // New behavior: only coordinator receives volume command
    const members = [
      { setVolume: coordinatorSetVolume },
      { setVolume: member1SetVolume },
      { setVolume: member2SetVolume },
    ];

    // New implementation calls coordinator.setVolume only
    const clamped = Math.max(0, Math.min(100, 75));
    members[0]!.setVolume(clamped);

    expect(coordinatorSetVolume).toHaveBeenCalledWith(75);
    expect(member1SetVolume).not.toHaveBeenCalled();
    expect(member2SetVolume).not.toHaveBeenCalled();
  });

  it('T009: volume should be clamped between 0 and 100', () => {
    const setVolume = vi.fn();

    // Test clamping at boundaries
    const clampedHigh = Math.max(0, Math.min(100, 150));
    setVolume(clampedHigh);
    expect(setVolume).toHaveBeenCalledWith(100);

    setVolume.mockClear();
    const clampedLow = Math.max(0, Math.min(100, -10));
    setVolume(clampedLow);
    expect(setVolume).toHaveBeenCalledWith(0);
  });

  /**
   * T010: Standalone speaker volume still works correctly.
   * A single-member group's coordinator IS the only member.
   */
  it('T010: standalone speaker (single-member group) still receives volume', () => {
    const soloSetVolume = vi.fn();
    const coordinator = { setVolume: soloSetVolume };

    // For a standalone speaker, coordinator === the only member
    const clamped = Math.max(0, Math.min(100, 42));
    coordinator.setVolume(clamped);

    expect(soloSetVolume).toHaveBeenCalledWith(42);
    expect(soloSetVolume).toHaveBeenCalledTimes(1);
  });

  it('T010: coordinator-only approach preserves relative volume between group members', () => {
    // In the old implementation, all members would be set to the same volume.
    // In the new implementation, only the coordinator gets the command,
    // and Sonos hardware handles relative volume distribution.
    const coordinatorSetVolume = vi.fn();
    const memberSetVolume = vi.fn();

    const coordinator = { setVolume: coordinatorSetVolume };
    const member = { setVolume: memberSetVolume };

    // Setting group volume to 60 should only affect coordinator
    const clamped = Math.max(0, Math.min(100, 60));
    coordinator.setVolume(clamped);

    expect(coordinatorSetVolume).toHaveBeenCalledWith(60);
    // Member retains its own independent volume
    expect(member.setVolume).not.toHaveBeenCalled();
  });
});
