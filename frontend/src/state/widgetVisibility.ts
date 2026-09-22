export type PublicVisibility = 'hidden' | 'read-only' | 'visible';

export const PUBLICLY_CONFIGURABLE_WIDGET_TYPES = new Set([
  'pihole',
  'unifi',
  'sonos_music',
  'stocks',
  'app_shortcuts',
]);

export const INTRINSIC_PUBLIC_WIDGET_TYPES = new Set([
  'clock',
  'weather',
  'calendar',
  'links_list',
  'single_link',
  'markdown',
  'iframe',
  'photo_frame',
]);

export const SENSITIVE_PUBLIC_WIDGET_TYPES = new Set([
  'pihole',
  'unifi',
  'sonos_music',
  'stocks',
]);

export function visibilityLabel(visibility: PublicVisibility): string {
  switch (visibility) {
    case 'hidden':
      return 'Hidden';
    case 'read-only':
      return 'Read-only';
    case 'visible':
      return 'Visible';
  }
}
