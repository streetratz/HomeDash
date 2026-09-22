/**
 * T011-T013: Unit tests for detectServiceFromUri() — service detection,
 * sn= extraction, and accountLabel resolution.
 *
 * These tests are written FIRST (TDD) and should FAIL until implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock integrationConfigService before importing the module under test
vi.mock('../../src/services/integrationConfigService.js', () => ({
  getIntegrationConfig: vi.fn().mockReturnValue(null),
  getIntegrationConfigs: vi.fn().mockReturnValue({}),
  setIntegrationConfig: vi.fn(),
  setIntegrationConfigs: vi.fn(),
  deleteIntegrationConfigs: vi.fn(),
}));

import { getIntegrationConfig } from '../../src/services/integrationConfigService.js';

// We'll import the function under test — currently returns string | undefined,
// after T014 it will return DetectedService | undefined
import { detectServiceFromUri } from '../../src/services/sonos-local-service.js';

// ─── T011: Service detection for known URIs ─────────────────────────────────

describe('detectServiceFromUri', () => {
  describe('T011: structured DetectedService return', () => {
    it('detects Spotify from URI containing "spotify"', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=7');
      expect(result).toMatchObject({ service: 'Spotify' });
    });

    it('detects YouTube Music from URI containing "youtube"', () => {
      const result = detectServiceFromUri('x-sonos-http:youtube:abc?sid=284');
      expect(result).toMatchObject({ service: 'YouTube Music' });
    });

    it('detects Apple Music from URI containing "apple"', () => {
      const result = detectServiceFromUri('x-sonos-http:apple:abc?sid=204');
      expect(result).toMatchObject({ service: 'Apple Music' });
    });

    it('detects Amazon Music from URI containing "amazon"', () => {
      const result = detectServiceFromUri('x-sonos-http:amazon:abc?sid=201');
      expect(result).toMatchObject({ service: 'Amazon Music' });
    });

    it('detects TuneIn from URI containing "tunein"', () => {
      const result = detectServiceFromUri('x-rincon-mp3radio://tunein.com/station');
      expect(result).toMatchObject({ service: 'TuneIn' });
    });

    it('detects TuneIn from URI containing "radio"', () => {
      const result = detectServiceFromUri('x-rincon-mp3radio://radio.example.com');
      expect(result).toMatchObject({ service: 'TuneIn' });
    });

    it('detects Deezer from URI containing "deezer"', () => {
      const result = detectServiceFromUri('x-sonos-http:deezer:track:123');
      expect(result).toMatchObject({ service: 'Deezer' });
    });

    it('detects Tidal from URI containing "tidal"', () => {
      const result = detectServiceFromUri('x-sonos-http:tidal:track:456');
      expect(result).toMatchObject({ service: 'Tidal' });
    });

    it('detects SoundCloud from URI containing "soundcloud"', () => {
      const result = detectServiceFromUri('x-sonos-http:soundcloud:track:789');
      expect(result).toMatchObject({ service: 'SoundCloud' });
    });

    it('detects service from the service map via sid= parameter', () => {
      const result = detectServiceFromUri('x-sonos-http:unknown?sid=44551');
      expect(result).toMatchObject({ service: 'Tidal' });
    });

    it('does not mistake an account serial for a service ID', () => {
      const result = detectServiceFromUri('x-sonos-http:unknown?sn=160');
      expect(result).toBeUndefined();
    });

    it('returns undefined for unrecognized URI', () => {
      const result = detectServiceFromUri('x-rincon-queue:RINCON_XXX');
      expect(result).toBeUndefined();
    });
  });

  // ─── T012: sn= extraction from Spotify URIs ────────────────────────────────

  describe('T012: sn= extraction from Spotify URIs', () => {
    it('extracts sn from Spotify URI with sn=7', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=7');
      expect(result).toMatchObject({ service: 'Spotify', sn: 7 });
    });

    it('extracts sn from Spotify URI with sn=12', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:xyz?sid=2311&sn=12');
      expect(result).toMatchObject({ service: 'Spotify', sn: 12 });
    });

    it('extracts sid from Spotify URI', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=7');
      expect(result).toMatchObject({ sid: 9 });
    });

    it('handles URI with sn= but no sid=', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sn=3');
      expect(result).toMatchObject({ service: 'Spotify', sn: 3 });
    });

    it('handles URI with sid= but no sn=', () => {
      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9');
      expect(result).toMatchObject({ service: 'Spotify', sid: 9 });
      expect(result!.sn).toBeUndefined();
    });

    it('extracts sn from non-Spotify URIs when present', () => {
      const result = detectServiceFromUri('x-sonos-http:deezer:track:123?sid=2&sn=5');
      expect(result).toMatchObject({ service: 'Deezer', sn: 5 });
    });
  });

  // ─── T013: accountLabel resolution ──────────────────────────────────────────

  describe('T013: accountLabel resolution', () => {
    beforeEach(() => {
      vi.mocked(getIntegrationConfig).mockReset();
    });

    it('includes accountLabel when label exists for sn value', () => {
      vi.mocked(getIntegrationConfig).mockReturnValue(
        JSON.stringify({ 'sn:7': "Dad's Spotify", 'sn:12': "Kid's Spotify" }),
      );

      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=7');
      expect(result).toMatchObject({
        service: 'Spotify',
        sn: 7,
        accountLabel: "Dad's Spotify",
      });
    });

    it('accountLabel is undefined when no label exists for sn value', () => {
      vi.mocked(getIntegrationConfig).mockReturnValue(
        JSON.stringify({ 'sn:7': "Dad's Spotify" }),
      );

      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=99');
      expect(result).toMatchObject({ service: 'Spotify', sn: 99 });
      expect(result!.accountLabel).toBeUndefined();
    });

    it('accountLabel is undefined when no labels are configured', () => {
      vi.mocked(getIntegrationConfig).mockReturnValue(null);

      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9&sn=7');
      expect(result).toMatchObject({ service: 'Spotify', sn: 7 });
      expect(result!.accountLabel).toBeUndefined();
    });

    it('accountLabel is undefined when URI has no sn=', () => {
      vi.mocked(getIntegrationConfig).mockReturnValue(null);

      const result = detectServiceFromUri('x-sonos-spotify:spotify:track:abc?sid=9');
      expect(result).toMatchObject({ service: 'Spotify' });
      expect(result!.accountLabel).toBeUndefined();
    });
  });
});
