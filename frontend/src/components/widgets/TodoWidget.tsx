/**
 * T011 (005): TodoWidget — display component for the todo/checklist widget.
 *
 * Reads config from widget.configJson, fetches items for selected lists,
 * applies sorting/filtering, and renders task items with inline add.
 */

import { useMemo } from 'react';
import type { WidgetDisplayProps } from './registry.js';
import type { TodoWidgetConfig, TodoItem } from '../../types/todo.js';
import {
  useTodoLists,
  useAllTodoItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '../../state/todoHooks.js';
import { TodoTaskItem } from '../TodoTaskItem.js';
import { TodoAddInput } from '../TodoAddInput.js';

const DEFAULT_CONFIG: TodoWidgetConfig = {
  selectedListIds: [],
  sortBy: 'manual',
  groupByList: false,
  maxItems: 50,
  showCompleted: true,
};

function sortItems(items: TodoItem[], sortBy: TodoWidgetConfig['sortBy']): TodoItem[] {
  const sorted = [...items];
  switch (sortBy) {
    case 'dueDate':
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case 'priority':
      return sorted.sort((a, b) => b.priority - a.priority);
    case 'createdAt':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'manual':
    default:
      return sorted.sort((a, b) => a.orderIndex - b.orderIndex);
  }
}

export function TodoWidget({ widget }: WidgetDisplayProps) {
  const cfg: TodoWidgetConfig = { ...DEFAULT_CONFIG, ...(widget.config as Partial<TodoWidgetConfig>) };

  const { data: lists } = useTodoLists();
  const { items: allItems, isLoading, error } = useAllTodoItems(cfg.selectedListIds, cfg.showCompleted);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const visibleItems = useMemo(() => {
    const sorted = sortItems(allItems, cfg.sortBy);
    return sorted.slice(0, cfg.maxItems);
  }, [allItems, cfg.sortBy, cfg.maxItems]);

  // Group items by list
  const grouped = useMemo(() => {
    if (!cfg.groupByList) return null;
    const map = new Map<string, TodoItem[]>();
    for (const item of visibleItems) {
      const group = map.get(item.listId) ?? [];
      group.push(item);
      map.set(item.listId, group);
    }
    return map;
  }, [cfg.groupByList, visibleItems]);

  const selectedLists = useMemo(
    () => (lists ?? []).filter((l) => cfg.selectedListIds.includes(l.id)),
    [lists, cfg.selectedListIds],
  );

  // Local lists that support inline add
  const localLists = selectedLists.filter((l) => l.providerType === 'local');

  function handleToggle(id: string, completed: boolean) {
    updateItem.mutate({ id, completed });
  }

  function handleDelete(id: string) {
    deleteItem.mutate(id);
  }

  function handleAdd(listId: string, title: string) {
    createItem.mutate({ listId, title });
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (cfg.selectedListIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Configure widget to select lists
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
        Loading tasks…
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        Failed to load tasks
      </div>
    );
  }

  // ── Grouped view ────────────────────────────────────────────────────────
  if (grouped) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-1">
        {selectedLists.map((list) => {
          const listItems = grouped.get(list.id) ?? [];
          return (
            <div key={list.id} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1">
                {list.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {list.name}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {listItems.filter((i) => i.completed === 0).length}
                </span>
              </div>
              {listItems.map((item) => (
                <TodoTaskItem
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
              {list.providerType === 'local' && (
                <TodoAddInput listId={list.id} onAdd={handleAdd} />
              )}
            </div>
          );
        })}
        {allItems.length > cfg.maxItems && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            +{allItems.length - cfg.maxItems} more
          </div>
        )}
      </div>
    );
  }

  // ── Flat view ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-y-auto p-1">
      {visibleItems.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No tasks yet
        </div>
      )}
      {visibleItems.map((item) => (
        <TodoTaskItem
          key={item.id}
          item={item}
          listColor={selectedLists.length > 1
            ? selectedLists.find((l) => l.id === item.listId)?.color
            : undefined}
          onToggleComplete={handleToggle}
          onDelete={handleDelete}
        />
      ))}
      {allItems.length > cfg.maxItems && (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          +{allItems.length - cfg.maxItems} more
        </div>
      )}
      {localLists.length >= 1 && localLists.map((l) => (
        <TodoAddInput key={l.id} listId={l.id} onAdd={handleAdd} />
      ))}
    </div>
  );
}
