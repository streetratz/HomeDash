/**
 * T007 (005): TypeScript interfaces for todo lists and items.
 */

export interface TodoList {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  providerType: 'local' | 'microsoft' | 'apple';
  providerListId: string | null;
  oauthAccountId: string | null;
  caldavAccountId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: number; // 0=none, 1=low, 2=medium, 3=high
  completed: number; // 0 | 1 (SQLite integer boolean)
  completedAt: string | null;
  orderIndex: number;
  providerItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoWidgetConfig {
  selectedListIds: string[];
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'manual';
  groupByList: boolean;
  maxItems: number;
  showCompleted: boolean;
}

export type TodoProvider = 'local' | 'microsoft' | 'apple';
