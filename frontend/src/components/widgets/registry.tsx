/**
 * 002: Widget type registry — maps widget type keys to their UI definitions.
 *
 * Adding a new widget type requires:
 * 1. Create DisplayComponent (widgets/XyzWidget.tsx)
 * 2. Create ConfigFormComponent (widgets/XyzConfigForm.tsx)
 * 3. Register here with registry.set(...)
 *
 * SC-008: ≤ 3 files to add a new widget type.
 */

import type { LucideIcon } from 'lucide-react';
import { Calendar, CheckSquare, Clock, Container, FileText, Globe, Image, LayoutGrid, Link, List, Activity, CloudSun, Music, Shield, Speaker, TrendingUp, Router } from 'lucide-react';
import type { WidgetView } from '../../state/dashboards.js';
import type { WidgetDraft } from '../../state/useEditMode.js';
import { LinksListWidget } from '../LinksListWidget.js';
import { ClockWidget } from './ClockWidget.js';
import { ClockConfigForm } from './ClockConfigForm.js';
import { MarkdownWidget } from './MarkdownWidget.js';
import { MarkdownConfigForm } from './MarkdownConfigForm.js';
import { IframeWidget } from './IframeWidget.js';
import { IframeConfigForm } from './IframeConfigForm.js';
import { SystemStatusWidget } from './SystemStatusWidget.js';
import { SystemStatusConfigForm } from './SystemStatusConfigForm.js';
import { WeatherWidget } from './WeatherWidget.js';
import { WeatherConfigForm } from './WeatherConfigForm.js';
import { LinksListConfigForm } from './LinksListConfigForm.js';
import { CalendarWidget } from './CalendarWidget.js';
import { CalendarConfigForm } from './CalendarConfigForm.js';
import { TodoWidget } from './TodoWidget.js';
import { TodoConfigForm } from './TodoConfigForm.js';
import { DockerWidget } from './DockerWidget.js';
import { DockerConfigForm } from './DockerConfigForm.js';
import { PhotoFrameWidget } from './PhotoFrameWidget.js';
import { PhotoFrameConfigForm } from './PhotoFrameConfigForm.js';
import { SpotifyWidget } from './SpotifyWidget.js';
import { SpotifyConfigForm } from './SpotifyConfigForm.js';
import { AppShortcutsWidget } from './AppShortcutsWidget.js';
import { AppShortcutsConfigForm } from './AppShortcutsConfigForm.js';
import { PiholeWidget } from './PiholeWidget.js';
import { PiholeConfigForm } from './PiholeConfigForm.js';
import { SonosWidget } from './SonosWidget.js';
import { SonosWidgetConfig } from './SonosWidgetConfig.js';
import { StocksWidget } from './StocksWidget.js';
import { StocksConfigForm } from './StocksConfigForm.js';
import { UnifiWidget } from './UnifiWidget.js';
import { UnifiConfigForm } from './UnifiConfigForm.js';
import { SingleLinkWidget } from './SingleLinkWidget.js';
import { SingleLinkConfigForm } from './SingleLinkConfigForm.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface WidgetDisplayProps {
  widget: WidgetView;
}

export interface WidgetConfigFormProps {
  config: unknown;
  onChange: (config: unknown) => void;
  /** The widget draft being configured — provides access to persistedId and links */
  widget?: WidgetDraft;
}

export type WidgetCategory = 'essentials' | 'content' | 'media' | 'monitoring';

export interface WidgetTypeDefinition {
  type: string;
  displayName: string;
  description: string;
  category: WidgetCategory;
  icon: LucideIcon;
  defaultConfig: Record<string, unknown>;
  DisplayComponent: React.ComponentType<WidgetDisplayProps>;
  ConfigFormComponent: React.ComponentType<WidgetConfigFormProps> | null;
  /** Minimum grid columns (default 1). */
  minW?: number;
  /** Minimum grid rows (default 1). */
  minH?: number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const widgetRegistry = new Map<string, WidgetTypeDefinition>();

// ── Adapters for existing widgets ─────────────────────────────────────────────

/** Adapt LinksListWidget to the WidgetDisplayProps interface */
function LinksListAdapter({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as { layout?: 'vertical' | 'horizontal' };
  return <LinksListWidget links={widget.links} config={config} />;
}

// ── Register existing widget types ────────────────────────────────────────────

widgetRegistry.set('links_list', {
  type: 'links_list',
  displayName: 'Links List',
  description: 'A grid or list of quick-access links',
  category: 'content',
  icon: List,
  defaultConfig: { layout: 'vertical' },
  DisplayComponent: LinksListAdapter,
  ConfigFormComponent: LinksListConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('clock', {
  type: 'clock',
  displayName: 'Clock / Date',
  description: 'Display current time and date for any timezone',
  category: 'essentials',
  icon: Clock,
  defaultConfig: { format: '12h', showDate: true, showSeconds: true },
  DisplayComponent: ClockWidget,
  ConfigFormComponent: ClockConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('markdown', {
  type: 'markdown',
  displayName: 'Markdown / Notes',
  description: 'Display formatted text, notes, and documentation',
  category: 'essentials',
  icon: FileText,
  defaultConfig: { content: '' },
  DisplayComponent: MarkdownWidget,
  ConfigFormComponent: MarkdownConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('iframe', {
  type: 'iframe',
  displayName: 'Iframe Embed',
  description: 'Embed any web page or dashboard',
  category: 'content',
  icon: Globe,
  defaultConfig: { url: '', aspectRatio: 'auto' },
  DisplayComponent: IframeWidget,
  ConfigFormComponent: IframeConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('system_status', {
  type: 'system_status',
  displayName: 'System Status',
  description: 'Monitor health of your services',
  category: 'monitoring',
  icon: Activity,
  defaultConfig: { services: [], pollIntervalSeconds: 60 },
  DisplayComponent: SystemStatusWidget,
  ConfigFormComponent: SystemStatusConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('weather', {
  type: 'weather',
  displayName: 'Weather',
  description: 'Current weather conditions for a location',
  category: 'essentials',
  icon: CloudSun,
  defaultConfig: { temperatureUnit: 'C' },
  DisplayComponent: WeatherWidget,
  ConfigFormComponent: WeatherConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('calendar', {
  type: 'calendar',
  displayName: 'Calendar',
  description: 'Show upcoming events from connected calendars',
  category: 'essentials',
  icon: Calendar,
  defaultConfig: { sourceIds: [], viewMode: 'agenda', daysAhead: 7, maxEvents: 25, showLocation: true },
  DisplayComponent: CalendarWidget,
  ConfigFormComponent: CalendarConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('todo', {
  type: 'todo',
  displayName: 'Todo List',
  description: 'Task lists with checkboxes',
  category: 'essentials',
  icon: CheckSquare,
  defaultConfig: { selectedListIds: [], sortBy: 'manual', groupByList: false, maxItems: 50, showCompleted: true },
  DisplayComponent: TodoWidget,
  ConfigFormComponent: TodoConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('docker', {
  type: 'docker',
  displayName: 'Docker Containers',
  description: 'Monitor and control Docker containers',
  category: 'monitoring',
  icon: Container,
  defaultConfig: { pollIntervalSeconds: 30, maxContainers: 25, allowControls: false },
  DisplayComponent: DockerWidget,
  ConfigFormComponent: DockerConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('photo_frame', {
  type: 'photo_frame',
  displayName: 'Photo Frame',
  description: 'Rotating slideshow from local folders or URL lists',
  category: 'media',
  icon: Image,
  defaultConfig: { sourceId: '', intervalSeconds: 30, transition: 'crossfade', fitMode: 'cover', shuffle: true, showCaption: false },
  DisplayComponent: PhotoFrameWidget,
  ConfigFormComponent: PhotoFrameConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('spotify', {
  type: 'spotify',
  displayName: 'Spotify',
  description: 'Music playback controls with now-playing display',
  category: 'media',
  icon: Music,
  defaultConfig: { showAlbumArt: true, compactMode: false },
  DisplayComponent: SpotifyWidget,
  ConfigFormComponent: SpotifyConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('app_shortcuts', {
  type: 'app_shortcuts',
  displayName: 'App Shortcuts',
  description: 'Grid of application links with icons',
  category: 'content',
  icon: LayoutGrid,
  defaultConfig: { columns: 4, iconSize: 'md', showLabels: true },
  DisplayComponent: AppShortcutsWidget,
  ConfigFormComponent: AppShortcutsConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('pihole', {
  type: 'pihole',
  displayName: 'Pi-hole DNS',
  description: 'DNS blocking stats and controls for Pi-hole',
  category: 'monitoring',
  icon: Shield,
  defaultConfig: { sections: ['controls', 'system', 'queries'] },
  DisplayComponent: PiholeWidget,
  ConfigFormComponent: PiholeConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('sonos_music', {
  type: 'sonos_music',
  displayName: 'Sonos Music',
  description: 'Control Sonos speakers — room picker, now playing, volume',
  category: 'media',
  icon: Speaker,
  defaultConfig: { showGrouping: true, compactMode: false },
  DisplayComponent: SonosWidget,
  ConfigFormComponent: SonosWidgetConfig,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('stocks', {
  type: 'stocks',
  displayName: 'Stocks Portfolio',
  description: 'Track stock portfolios with live quotes and currency conversion',
  category: 'monitoring',
  icon: TrendingUp,
  defaultConfig: {
    groups: [],
    displayCurrency: 'AUD',
    refreshInterval: 300,
    displayMode: 'compact',
    showSparkline: false,
    reduceOffHours: true,
  },
  DisplayComponent: StocksWidget,
  ConfigFormComponent: StocksConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('unifi', {
  type: 'unifi',
  displayName: 'UniFi Network',
  description: 'Network stats from UniFi OS controller (clients, WAN, devices)',
  category: 'monitoring',
  icon: Router,
  defaultConfig: { showDevices: true, showWifi: true, showIps: true, showHealth: true },
  DisplayComponent: UnifiWidget,
  ConfigFormComponent: UnifiConfigForm,
  minW: 1,
  minH: 1,
});

widgetRegistry.set('single_link', {
  type: 'single_link',
  displayName: 'Single Link',
  description: 'A prominent single-link tile with icon and optional background',
  category: 'content',
  icon: Link,
  defaultConfig: { url: '', label: '', iconKey: null, subtitle: null, background: null },
  DisplayComponent: SingleLinkWidget,
  ConfigFormComponent: SingleLinkConfigForm,
  minW: 1,
  minH: 1,
});
