/**
 * Queue panel for the fullscreen Sonos controller.
 * Shows current playback queue with track list, highlights current item.
 * Local-mode only — shows a message when in cloud mode.
 */

import { Loader2, Music, Trash2, Play } from 'lucide-react';
import { useSonosQueue, useClearQueue, usePlayFromQueue } from '../../hooks/useSonos.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';

interface QueuePanelProps {
  groupId: string | null;
  accent: { text: string; btnBg: string; dot: string };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QueuePanel({ groupId, accent }: QueuePanelProps) {
  const { data, isLoading } = useSonosQueue(groupId ?? undefined);
  const clearQueue = useClearQueue();
  const playFrom = usePlayFromQueue();

  if (!groupId) {
    return <p className="text-xs text-white/30 italic text-center py-8">Select a room first</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  if (data?.localOnly) {
    return (
      <div className="text-center py-8 space-y-2">
        <Music className="h-8 w-8 text-white/20 mx-auto" />
        <p className="text-xs text-white/40">Queue is available in local mode only</p>
        <p className="text-[10px] text-white/25">Switch to local mode in Settings → Integrations</p>
      </div>
    );
  }

  if (!data?.items.length) {
    return <p className="text-xs text-white/30 italic text-center py-8">Queue is empty</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header with clear button */}
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <span className="text-[10px] text-white/40">{data.items.length} tracks</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={clearQueue.isPending}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs text-white/50 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-red-500/10 can-hover:hover:text-red-300 active:scale-[0.97]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear queue
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the queue?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every queued track from this Sonos group. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep queue</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => clearQueue.mutate({ groupId })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear queue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Track list */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="space-y-0.5">
          {data.items.map((item) => {
            const isCurrent = item.trackNumber === data.currentTrack;
            return (
              <button
                key={item.trackNumber}
                onClick={() => playFrom.mutate({ groupId, trackNumber: item.trackNumber })}
                disabled={playFrom.isPending}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors duration-150 ease-out group ${
                  isCurrent ? `${accent.text} bg-white/[0.06]` : 'can-hover:hover:bg-white/[0.04]'
                }`}
              >
                {/* Track number / play icon */}
                <div className="w-6 text-center shrink-0">
                  {isCurrent ? (
                    <span className={`text-xs font-bold ${accent.text}`}>▶</span>
                  ) : (
                    <span className="text-[10px] text-white/30 group-hover:hidden">
                      {item.trackNumber}
                    </span>
                  )}
                  {!isCurrent && (
                    <Play className="h-3 w-3 text-white/40 hidden group-hover:block mx-auto" />
                  )}
                </div>

                {/* Album art */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded shrink-0 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Music className="h-3 w-3 text-white/10" />
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate ${isCurrent ? accent.text : 'text-white/80'}`}>
                    {item.title}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">{item.artist}</p>
                </div>

                {/* Duration */}
                <span className="text-[10px] text-white/30 shrink-0">
                  {item.duration ? formatDuration(item.duration) : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
