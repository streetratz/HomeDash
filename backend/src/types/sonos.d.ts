/**
 * Type declarations for the `sonos` npm package (v1.x).
 * Only covers the subset used by HomeDash.
 */
declare module 'sonos' {
  import { EventEmitter } from 'events';

  export interface SonosTrack {
    title: string;
    artist: string;
    album: string;
    albumArtURI?: string;
    albumArtURL?: string;
    duration: number;
    position: number;
    uri?: string;
  }

  export interface SonosZoneGroup {
    ID: string;
    Name: string;
    CoordinatorDevice: () => Sonos;
    ZoneGroupMember: SonosZoneMember[];
  }

  export interface SonosZoneMember {
    UUID: string;
    ZoneName: string;
    Location: string;
    rinconUri?: string;
    Invisible?: boolean | '0' | '1';
  }

  export interface SonosFavoriteItem {
    title: string;
    uri: string;
    albumArtURI?: string;
    metadata?: string;
    artist?: string;
    creator?: string;
    album?: string;
  }

  export interface SonosDeviceDescription {
    friendlyName: string;
    modelName: string;
    modelNumber: string;
    serialNum: string;
    roomName: string;
    displayName?: string;
    UDN: string;
    softwareVersion?: string;
    hardwareVersion?: string;
  }

  export interface SonosZoneInfo {
    SerialNumber: string;
    SoftwareVersion: string;
    DisplaySoftwareVersion: string;
    HardwareVersion: string;
    IPAddress: string;
    MACAddress: string;
    CopyrightInfo: string;
    ExtraInfo: string;
  }

  export interface ListAvailableServicesResult {
    AvailableServiceDescriptorList?: string;
    AvailableServiceTypeList?: string;
    AvailableServiceListVersion?: string;
  }

  export type PlayState =
    | 'playing'
    | 'paused'
    | 'stopped'
    | 'transitioning'
    | 'no_media';

  export class Sonos extends EventEmitter {
    constructor(host: string, port?: number);
    host: string;
    port: number;

    // Playback
    play(uri?: string): Promise<boolean>;
    pause(): Promise<boolean>;
    stop(): Promise<boolean>;
    next(): Promise<boolean>;
    previous(): Promise<boolean>;
    seek(seconds: number): Promise<boolean>;
    togglePlayback(): Promise<boolean>;
    selectQueue(): Promise<boolean>;
    selectTrack(trackNumber: number): Promise<boolean>;
    setAVTransportURI(options: { uri: string; metadata?: string }): Promise<boolean>;

    // State
    currentTrack(): Promise<SonosTrack>;
    getCurrentState(): Promise<PlayState>;
    getPlayMode(): Promise<string>;
    setPlayMode(mode: string): Promise<boolean>;

    // Volume
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<boolean>;
    getMuted(): Promise<boolean>;
    setMuted(muted: boolean): Promise<boolean>;
    adjustVolume(delta: number): Promise<number>;

    // Groups
    getAllGroups(): Promise<SonosZoneGroup[]>;
    joinGroup(coordinatorName: string): Promise<boolean>;
    leaveGroup(): Promise<boolean>;
    becomeCoordinatorOfStandaloneGroup(): Promise<boolean>;

    // Favorites / Library
    getFavorites(): Promise<{ items: SonosFavoriteItem[]; total: number; returned: number }>;
    getMusicLibrary(type: string, options?: { start?: number; total?: number }): Promise<{ items: SonosFavoriteItem[]; total: number; returned: number }>;
    getQueue(): Promise<{ items: SonosTrack[]; total: number; returned: number }>;

    // Queue
    queue(uri: string | { uri: string; metadata?: string }, positionInQueue?: number): Promise<unknown>;
    flush(): Promise<boolean>;

    // Device info
    getName(): Promise<string>;
    getZoneInfo(): Promise<SonosZoneInfo>;
    getZoneAttrs(): Promise<{ CurrentZoneName: string }>;
    deviceDescription(): Promise<SonosDeviceDescription>;

    // Events — emitted when listener active
    on(event: 'CurrentTrack', listener: (track: SonosTrack) => void): this;
    on(event: 'PlayState', listener: (state: PlayState) => void): this;
    on(event: 'Volume', listener: (volume: number) => void): this;
    on(event: 'Mute', listener: (muted: boolean) => void): this;
    on(event: 'AVTransport', listener: (data: unknown) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export class AsyncDeviceDiscovery {
    discover(options?: { timeout?: number }): Promise<Sonos>;
    discoverMultiple(options?: { timeout?: number }): Promise<Sonos[]>;
  }

  export class DeviceDiscovery extends EventEmitter {
    constructor(options?: { timeout?: number });
    on(event: 'DeviceAvailable', listener: (device: Sonos) => void): this;
    destroy(): void;
  }

  export class MusicServices {
    constructor(host: string, port?: number);
    ListAvailableServices(options?: Record<string, unknown>): Promise<ListAvailableServicesResult>;
  }

  export const Services: {
    MusicServices: typeof MusicServices;
  };

  export class Listener extends EventEmitter {
    static startListener(): Promise<void>;
    static stopListener(): Promise<void>;
  }
}
