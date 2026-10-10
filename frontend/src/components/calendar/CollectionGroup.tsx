import { collectionIconComponent } from '../../lib/collectionIcons.js';
import { collectionDateLabel } from '../../lib/collectionDates.js';

export interface CollectionDateGroup {
  date: string;
  streams: { key: string; name: string; color: string; icon?: string }[];
}
export interface CollectionGroupProps {
  group: CollectionDateGroup;
  today: string;
  timezone: string;
  next?: boolean;
}
export function CollectionGroup({ group, today, timezone, next = false }: CollectionGroupProps) {
  return (
    <section
      className={`min-w-0 space-y-2 rounded-lg border p-3 ${next ? 'border-border bg-muted/40' : 'border-transparent'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4
          className={
            next
              ? 'text-base font-semibold text-foreground'
              : 'text-sm font-medium text-muted-foreground'
          }
        >
          {collectionDateLabel(group.date, today)}
        </h4>
        <span className="text-xs text-muted-foreground">{timezone}</span>
      </div>
      <ul className="space-y-2" aria-label={next ? 'Next collection' : 'Later collection'}>
        {group.streams.map((stream) => {
          const Icon = collectionIconComponent(stream.icon);
          return (
            <li key={stream.key} className="flex min-w-0 items-start gap-2 text-sm text-foreground">
              <Icon
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: stream.color }}
              />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{stream.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
