/**
 * Shared Sonos accent-color theme — single source of truth for both
 * SonosWidget (compact) and FullScreenSonos (full-screen) views.
 */

export interface ServiceAccent {
  /** Display label shown in badge (e.g. "YouTube Music") */
  label: string;
  /** Tailwind bg class for buttons (may include hover variant) */
  btnBg: string;
  /** Tailwind hover bg class for buttons (compact widget uses separate hover) */
  btnHover: string;
  /** Tailwind text class for button text */
  btnText: string;
  /** Tailwind bg class for the status/progress dot */
  dot: string;
  /** Tailwind text class for icons/accents */
  text: string;
  /** Tailwind text class for muted/dim accents */
  dim: string;
  /** CSS accent-color value for range inputs */
  range: string;
  /** Tailwind bg class with low opacity for card backgrounds (full-screen) */
  bg: string;
  /** Tailwind ring class (full-screen) */
  ring: string;
}

const SERVICES: Record<string, ServiceAccent> = {
  spotify: {
    label: 'Spotify',
    btnBg: 'bg-green-500', btnHover: 'hover:bg-green-400', btnText: 'text-white',
    dot: 'bg-green-400', text: 'text-green-400', dim: 'text-green-400/60',
    range: '#4ade80',
    bg: 'bg-green-500/10', ring: 'ring-green-500/40',
  },
  'youtube music': {
    label: 'YouTube Music',
    btnBg: 'bg-red-600', btnHover: 'hover:bg-red-500', btnText: 'text-white',
    dot: 'bg-red-400', text: 'text-red-400', dim: 'text-red-400/60',
    range: '#f87171',
    bg: 'bg-red-500/10', ring: 'ring-red-500/40',
  },
  'apple music': {
    label: 'Apple Music',
    btnBg: 'bg-pink-500', btnHover: 'hover:bg-pink-400', btnText: 'text-white',
    dot: 'bg-pink-400', text: 'text-pink-400', dim: 'text-pink-400/60',
    range: '#f472b6',
    bg: 'bg-pink-500/10', ring: 'ring-pink-500/40',
  },
  'amazon music': {
    label: 'Amazon Music',
    btnBg: 'bg-cyan-500', btnHover: 'hover:bg-cyan-400', btnText: 'text-white',
    dot: 'bg-cyan-400', text: 'text-cyan-400', dim: 'text-cyan-400/60',
    range: '#22d3ee',
    bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/40',
  },
  tunein: {
    label: 'TuneIn',
    btnBg: 'bg-indigo-500', btnHover: 'hover:bg-indigo-400', btnText: 'text-white',
    dot: 'bg-indigo-400', text: 'text-indigo-400', dim: 'text-indigo-400/60',
    range: '#818cf8',
    bg: 'bg-indigo-500/10', ring: 'ring-indigo-500/40',
  },
  deezer: {
    label: 'Deezer',
    btnBg: 'bg-purple-500', btnHover: 'hover:bg-purple-400', btnText: 'text-white',
    dot: 'bg-purple-400', text: 'text-purple-400', dim: 'text-purple-400/60',
    range: '#c084fc',
    bg: 'bg-purple-500/10', ring: 'ring-purple-500/40',
  },
  tidal: {
    label: 'Tidal',
    btnBg: 'bg-sky-500', btnHover: 'hover:bg-sky-400', btnText: 'text-white',
    dot: 'bg-sky-400', text: 'text-sky-400', dim: 'text-sky-400/60',
    range: '#38bdf8',
    bg: 'bg-sky-500/10', ring: 'ring-sky-500/40',
  },
  soundcloud: {
    label: 'SoundCloud',
    btnBg: 'bg-orange-600', btnHover: 'hover:bg-orange-500', btnText: 'text-white',
    dot: 'bg-orange-500', text: 'text-orange-500', dim: 'text-orange-500/60',
    range: '#f97316',
    bg: 'bg-orange-600/10', ring: 'ring-orange-500/40',
  },
};

export const DEFAULT_ACCENT: ServiceAccent = {
  label: 'Sonos',
  btnBg: 'bg-orange-500', btnHover: 'hover:bg-orange-400', btnText: 'text-white',
  dot: 'bg-orange-400', text: 'text-orange-400', dim: 'text-orange-400/60',
  range: '#fb923c',
  bg: 'bg-orange-500/10', ring: 'ring-orange-500/40',
};

/** Resolve accent theme from a service name string. */
export function getServiceAccent(serviceName: string): ServiceAccent {
  if (!serviceName) return DEFAULT_ACCENT;
  const key = serviceName.toLowerCase().trim();
  for (const [name, accent] of Object.entries(SERVICES)) {
    if (key === name || key.includes(name)) return accent;
  }
  return DEFAULT_ACCENT;
}
