/**
 * Bundled, offline icon allowlist for custom calendar events.
 *
 * Every entry is a lucide-react icon name shipped in the frontend bundle; no
 * external/CDN icon is ever requested for custom events. The list is validated
 * at every trust boundary (admin save, backup restore) so unknown keys are
 * rejected rather than rendered. `Trash2` is the legacy default for pre-refactor
 * bin streams that never stored an icon.
 */
export const COLLECTION_ICONS = [
  'Trash2',
  'Trash',
  'Recycle',
  'Leaf',
  'Trees',
  'TreePine',
  'Sprout',
  'Flower2',
  'Apple',
  'Carrot',
  'Cake',
  'Gift',
  'PartyPopper',
  'CalendarDays',
  'CalendarCheck',
  'CalendarClock',
  'Bell',
  'Star',
  'Heart',
  'House',
  'Package',
  'Truck',
  'Droplet',
  'Droplets',
  'Flame',
  'Sun',
  'Moon',
  'Snowflake',
  'GlassWater',
  'Wine',
  'Coffee',
  'Utensils',
  'Milk',
  'Dog',
  'Cat',
  'Baby',
  'GraduationCap',
  'Plane',
  'Car',
  'Bike',
  'Bus',
  'Wrench',
  'Hammer',
  'Stethoscope',
  'Pill',
  'Dumbbell',
  'Music',
  'BookOpen',
  'Briefcase',
  'ShoppingCart',
  'ShoppingBag',
  'CreditCard',
  'Coins',
  'Users',
  'Flag',
  'MapPin',
  'Clock',
  'Shirt',
  'WashingMachine',
  'Umbrella',
  'Zap',
  'Lightbulb',
  'Key',
  'Mail',
  'Camera',
  'Palette',
  'Scissors',
  'Plug',
] as const;

export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export const DEFAULT_COLLECTION_ICON: CollectionIcon = 'Trash2';

const ICON_SET: ReadonlySet<string> = new Set(COLLECTION_ICONS);

export function isCollectionIcon(value: unknown): value is CollectionIcon {
  return typeof value === 'string' && ICON_SET.has(value);
}
