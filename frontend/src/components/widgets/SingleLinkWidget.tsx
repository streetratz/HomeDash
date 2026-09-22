/**
 * 030-shortcuts-single-link (US3): Single-Link display widget.
 * A single clickable tile with icon, label, optional subtitle, and background.
 */

import { createElement } from 'react';
import { Globe, icons as lucideIcons } from 'lucide-react';
import type { WidgetDisplayProps } from './registry.js';
import type { SingleLinkConfig } from '../../state/dashboards.js';
import { isCdnIcon, parseCdnIcon, cdnIconUrl } from '../IconPicker.js';

/** Gradient preset names → CSS gradient strings. */
export const GRADIENT_PRESETS: Record<string, string> = {
  'gradient-blue':   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'gradient-green':  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'gradient-orange': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'gradient-dark':   'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  'gradient-sunset': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'gradient-ocean':  'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
} as const;

const DEFAULT_CONFIG: SingleLinkConfig = {
  url: '',
  label: '',
  iconKey: null,
  subtitle: null,
  background: null,
};

/** Resolve background config to inline style. */
function resolveBackground(bg: string | null): React.CSSProperties {
  if (!bg) return {};
  if (bg in GRADIENT_PRESETS) return { background: GRADIENT_PRESETS[bg] };
  if (bg.startsWith('#')) return { backgroundColor: bg };
  return {};
}

/** Whether the background is custom (not default card). */
function hasCustomBg(bg: string | null): boolean {
  return bg !== null && bg !== '';
}

function renderIcon(iconKey: string | null, hasBackground: boolean) {
  const baseCls = `h-full w-full ${hasBackground ? 'text-white drop-shadow-md' : 'text-muted-foreground'}`;

  if (iconKey && isCdnIcon(iconKey)) {
    return (
      <img
        src={cdnIconUrl(parseCdnIcon(iconKey))}
        alt=""
        className={`h-full w-full rounded object-contain ${hasBackground ? 'drop-shadow-md' : ''}`}
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  if (iconKey && iconKey in lucideIcons) {
    return createElement(lucideIcons[iconKey as keyof typeof lucideIcons], { className: baseCls });
  }
  return <Globe className={baseCls} />;
}

export function SingleLinkWidget({ widget }: WidgetDisplayProps) {
  const cfg: SingleLinkConfig = { ...DEFAULT_CONFIG, ...(widget.config as Partial<SingleLinkConfig>) };
  const customBg = hasCustomBg(cfg.background);
  const bgStyle = resolveBackground(cfg.background);
  const hasUrl = cfg.url.trim().length > 0;

  const textCls = customBg ? 'text-white drop-shadow-sm' : '';

  const content = (
    <div className="relative flex h-full flex-col items-center justify-center gap-2 p-4">
      {customBg && <div className="absolute inset-0 rounded-lg bg-black/20" />}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2">
        <div className="flex-1 flex items-center max-h-[60%] aspect-square min-h-10 transition-transform group-hover:scale-105">
          {renderIcon(cfg.iconKey, customBg)}
        </div>
        {cfg.label ? (
          <span className={`text-sm font-medium leading-tight text-center ${textCls}`}>
            {cfg.label}
          </span>
        ) : !hasUrl ? (
          <span className="text-xs text-muted-foreground italic">Configure URL</span>
        ) : null}
        {cfg.subtitle && (
          <span className={`text-xs leading-tight text-center ${customBg ? 'text-white/80 drop-shadow-sm' : 'text-muted-foreground'}`}>
            {cfg.subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (!hasUrl) {
    return (
      <div
        className="h-full rounded-lg"
        style={bgStyle}
        data-testid="single-link-widget"
      >
        {content}
      </div>
    );
  }

  return (
    <a
      href={cfg.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-lg active:scale-[0.98] transition-[transform,filter] duration-150 ease-out hover:brightness-[1.1]"
      style={bgStyle}
      data-testid="single-link-widget"
      title={cfg.url}
    >
      {content}
    </a>
  );
}
