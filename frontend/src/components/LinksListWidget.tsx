/**
 * Phase R4: Links List widget — renders a list of hyperlinks with icons.
 *
 * FR-028: Each link has title, URL, icon.
 * FR-030: Supports vertical and horizontal display modes.
 * FR-031: Titles max 15 chars (truncated with ellipsis).
 * FR-032: Vertical — icon left, title right.
 * FR-033: Horizontal — icon top, title below (or hidden).
 */

import { createElement } from 'react';
import { Globe, ExternalLink, icons, type LucideIcon } from 'lucide-react';
import { isCdnIcon, parseCdnIcon, cdnIconUrl } from './IconPicker.js';
import type { LinkView, LinksListConfig } from '../state/dashboards.js';

/** Render a link icon — CDN image for dashboard icons, Lucide SVG for generic. */
function LinkIcon({ iconKey, className }: { iconKey: string | null; className: string }) {
  if (iconKey && isCdnIcon(iconKey)) {
    const name = parseCdnIcon(iconKey);
    // Extract size from className (h-4 → 16px, h-8 → 32px)
    const sizeMatch = className.match(/h-(\d+)/);
    const size = sizeMatch?.[1] ? parseInt(sizeMatch[1], 10) * 4 : 16;
    return (
      <img
        src={cdnIconUrl(name)}
        alt={name}
        width={size}
        height={size}
        className={`object-contain ${className.replace(/text-\S+/g, '').replace(/transition-\S+/g, '')}`}
        loading="lazy"
      />
    );
  }
  const IconComp = resolveLucideIcon(iconKey);
  return createElement(IconComp, { className });
}

/** Resolve a Lucide icon name, falling back to Globe. */
function resolveLucideIcon(iconKey: string | null): LucideIcon {
  if (iconKey) {
    const component = icons[iconKey as keyof typeof icons];
    if (component) return component;
  }
  return Globe;
}

interface LinksListWidgetProps {
  links: LinkView[];
  config?: LinksListConfig;
}

export function LinksListWidget({ links, config }: LinksListWidgetProps) {
  const layout = config?.layout ?? 'vertical';

  if (links.length === 0) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground">No links configured.</p>
    );
  }

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-wrap gap-3 p-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-1 rounded-md p-2 transition-colors hover:bg-accent/50 min-w-[44px] min-h-[44px]"
            title={link.url}
          >
            <LinkIcon iconKey={link.iconKey} className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-foreground" />
            <span className="max-w-[80px] truncate text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">
              {link.title}
            </span>
          </a>
        ))}
      </div>
    );
  }

  // Vertical layout (default)
  return (
    <div className="flex flex-col p-1">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
          title={link.url}
        >
          <LinkIcon iconKey={link.iconKey} className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground/90 group-hover:text-foreground">
            {link.title}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      ))}
    </div>
  );
}
