/**
 * T011, T025 (005): TodoConfigForm — widget configuration for todo lists.
 *
 * Shows list selection with provider icons, sort order, grouping toggle,
 * max items, show completed toggle, and collapsible account manager.
 */

import { ClipboardList } from 'lucide-react';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Switch } from '../ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { TodoWidgetConfig } from '../../types/todo.js';
import { useTodoLists } from '../../state/todoHooks.js';
import { TodoAccountManager } from '../TodoAccountManager.js';

const SORT_OPTIONS: { value: TodoWidgetConfig['sortBy']; label: string }[] = [
  { value: 'manual', label: 'Manual (drag order)' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Recently Created' },
];

const DEFAULT_CONFIG: TodoWidgetConfig = {
  selectedListIds: [],
  sortBy: 'manual',
  groupByList: false,
  maxItems: 50,
  showCompleted: true,
};

function ProviderIcon({ type }: { type: string }) {
  if (type === 'microsoft') {
    return (
      <svg viewBox="0 0 21 21" className="h-3.5 w-3.5 shrink-0" aria-label="Microsoft">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
    );
  }
  return <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

const PROVIDER_LABELS: Record<string, string> = {
  local: 'Local',
  microsoft: 'Microsoft To Do',
  apple: 'Apple Reminders',
};

export function TodoConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg: TodoWidgetConfig = { ...DEFAULT_CONFIG, ...(config as Partial<TodoWidgetConfig>) };
  const { data: lists } = useTodoLists();

  function update(patch: Partial<TodoWidgetConfig>) {
    onChange({ ...cfg, ...patch });
  }

  function toggleList(listId: string) {
    const ids = cfg.selectedListIds.includes(listId)
      ? cfg.selectedListIds.filter((id) => id !== listId)
      : [...cfg.selectedListIds, listId];
    update({ selectedListIds: ids });
  }

  return (
    <div className="space-y-4">
      {/* List selection */}
      <div className="space-y-2">
        <Label>Lists</Label>
        {!lists || lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No todo lists yet. Create one from the widget after saving.
          </p>
        ) : (
          <div className="space-y-1 rounded-md border p-2">
            {lists.map((list) => (
              <label
                key={list.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={cfg.selectedListIds.includes(list.id)}
                  onChange={() => toggleList(list.id)}
                  className="h-4 w-4 rounded border-muted-foreground/40"
                />
                <ProviderIcon type={list.providerType} />
                {list.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                )}
                <span className="text-sm">{list.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {PROVIDER_LABELS[list.providerType] ?? list.providerType}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Sort order */}
      <div className="space-y-2">
        <Label htmlFor="todo-sort">Sort By</Label>
        <Select
          value={cfg.sortBy}
          onValueChange={(value) => update({ sortBy: value as TodoWidgetConfig['sortBy'] })}
        >
          <SelectTrigger id="todo-sort" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Group by list */}
      <div className="flex items-center justify-between">
        <Label htmlFor="todo-group">Group by List</Label>
        <Switch
          id="todo-group"
          checked={cfg.groupByList}
          onCheckedChange={(checked) => update({ groupByList: checked })}
        />
      </div>

      {/* Max items */}
      <div className="space-y-2">
        <Label htmlFor="todo-max">Max Items</Label>
        <Input
          id="todo-max"
          type="number"
          min={1}
          max={200}
          value={cfg.maxItems}
          onChange={(e) => update({ maxItems: Math.max(1, Math.min(200, Number(e.target.value) || 50)) })}
        />
      </div>

      {/* Show completed */}
      <div className="flex items-center justify-between">
        <Label htmlFor="todo-completed">Show Completed</Label>
        <Switch
          id="todo-completed"
          checked={cfg.showCompleted}
          onCheckedChange={(checked) => update({ showCompleted: checked })}
        />
      </div>

      {/* Manage Accounts (collapsible) */}
      <details className="group rounded-md border p-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-primary hover:text-primary/80">
          <span className="group-open:hidden">▶ Manage Accounts</span>
          <span className="hidden group-open:inline">▼ Manage Accounts</span>
        </summary>
        <div className="mt-3">
          <TodoAccountManager />
        </div>
      </details>
    </div>
  );
}
