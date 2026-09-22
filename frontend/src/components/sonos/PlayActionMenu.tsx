/**
 * PlayActionMenu — dropdown with queue actions.
 * Used in library grid tiles and track rows.
 * Supports both track actions (4 options) and container actions (2 options: Add to End, Play Now/Replace Queue).
 */

import { useState, useRef, useEffect } from 'react';
import { Play, ListPlus, ListEnd, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';

export type QueueAction = 'play_now' | 'play_next' | 'add_to_end' | 'replace_queue';

interface PlayActionMenuProps {
  onAction: (action: QueueAction) => void;
  accent: { btnBg: string };
  compact?: boolean;
  isLoading?: boolean;
  /** When true, shows only container-relevant actions (Add to End, Replace Queue / Play Now) */
  containerMode?: boolean;
}

const TRACK_ACTIONS: { id: QueueAction; label: string; icon: typeof Play }[] = [
  { id: 'play_now', label: 'Play Now', icon: Play },
  { id: 'play_next', label: 'Play Next', icon: ListPlus },
  { id: 'add_to_end', label: 'Add to End', icon: ListEnd },
  { id: 'replace_queue', label: 'Replace Queue', icon: RefreshCw },
];

const CONTAINER_ACTIONS: { id: QueueAction; label: string; icon: typeof Play }[] = [
  { id: 'replace_queue', label: 'Play Now', icon: Play },
  { id: 'add_to_end', label: 'Add to End', icon: ListEnd },
];

export function PlayActionMenu({ onAction, accent, compact, isLoading, containerMode }: PlayActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = containerMode ? CONTAINER_ACTIONS : TRACK_ACTIONS;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoading) setOpen(!open);
        }}
        disabled={isLoading}
        className={`${compact ? 'p-1' : 'p-1.5'} rounded-full ${accent.btnBg} text-white flex items-center gap-0.5 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Play options"
      >
        {isLoading ? (
          <Loader2 className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} animate-spin`} />
        ) : (
          <Play className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        )}
        <ChevronDown className="h-2 w-2" />
      </button>

      {open && !isLoading && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(a.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Icon className="h-3 w-3" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
