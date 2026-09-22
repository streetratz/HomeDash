/**
 * T009 (005): TodoTaskItem — single task row with checkbox, title, badges.
 */

import { Trash2 } from 'lucide-react';
import { cn } from '../lib/utils.js';
import type { TodoItem } from '../types/todo.js';

const PRIORITY_BADGES: Record<number, { label: string; className: string } | undefined> = {
  3: { label: '!!!', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  2: { label: '!!', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  1: { label: '!', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
};

function dueDateBadge(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - now.getTime()) / 86_400_000);

  let label: string;
  let className: string;
  if (diff < 0) {
    label = 'Overdue';
    className = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  } else if (diff === 0) {
    label = 'Today';
    className = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
  } else if (diff === 1) {
    label = 'Tomorrow';
    className = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
  } else {
    label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    className = 'bg-muted text-muted-foreground';
  }

  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', className)}>
      {label}
    </span>
  );
}

interface TodoTaskItemProps {
  item: TodoItem;
  listColor?: string | null | undefined;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function TodoTaskItem({ item, listColor, onToggleComplete, onDelete }: TodoTaskItemProps) {
  const isComplete = item.completed === 1;
  const priority = PRIORITY_BADGES[item.priority];

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50',
        listColor && 'border-l-2',
      )}
      style={listColor ? { borderLeftColor: listColor } : undefined}
    >
      {/* Checkbox — 44×44 tap target */}
      <button
        type="button"
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center"
        onClick={() => onToggleComplete(item.id, !isComplete)}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
      >
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
            isComplete
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40',
          )}
        >
          {isComplete && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </span>
      </button>

      {/* Title + badges */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            'truncate text-sm',
            isComplete && 'text-muted-foreground line-through',
          )}
        >
          {item.title}
        </span>
        {!isComplete && priority && (
          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', priority.className)}>
            {priority.label}
          </span>
        )}
        {!isComplete && dueDateBadge(item.dueDate)}
      </div>

      {/* Delete button */}
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
        onClick={() => onDelete(item.id)}
        aria-label="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
