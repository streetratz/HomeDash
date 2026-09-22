/**
 * T002 (005): Local todo CRUD operations.
 * Provides list and item management for the todo widget.
 */

import { eq, and, max } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { todoLists, todoItems } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TodoList {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  providerType: string;
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
  priority: number;
  completed: number;
  completedAt: string | null;
  orderIndex: number;
  providerItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListInput {
  name: string;
  color?: string | undefined;
}

export interface CreateItemInput {
  title: string;
  notes?: string | undefined;
  dueDate?: string | undefined;
  priority?: number | undefined;
}

export interface TodoItemUpdate {
  title?: string | undefined;
  notes?: string | null | undefined;
  dueDate?: string | null | undefined;
  priority?: number | undefined;
  completed?: boolean | undefined;
  orderIndex?: number | undefined;
}

// ─── List operations ─────────────────────────────────────────────────────────

export function getListsForUser(userId: string): TodoList[] {
  const db = getDb();
  return db.select().from(todoLists).where(eq(todoLists.userId, userId)).all();
}

export function createList(userId: string, input: CreateListInput): TodoList {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(todoLists)
    .values({
      id,
      userId,
      name: input.name,
      color: input.color ?? null,
      providerType: 'local',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(todoLists).where(eq(todoLists.id, id)).get()!;
}

export function updateList(
  listId: string,
  input: { name?: string | undefined; color?: string | null | undefined },
): TodoList {
  const db = getDb();
  const existing = db.select().from(todoLists).where(eq(todoLists.id, listId)).get();
  if (!existing) throw Errors.notFound('Todo list not found');

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) updates['name'] = input.name;
  if (input.color !== undefined) updates['color'] = input.color;

  db.update(todoLists).set(updates).where(eq(todoLists.id, listId)).run();

  return db.select().from(todoLists).where(eq(todoLists.id, listId)).get()!;
}

export function deleteList(listId: string): void {
  const db = getDb();
  const existing = db.select().from(todoLists).where(eq(todoLists.id, listId)).get();
  if (!existing) throw Errors.notFound('Todo list not found');

  // Cascade: delete items first, then list (in transaction)
  db.transaction((tx) => {
    tx.delete(todoItems).where(eq(todoItems.listId, listId)).run();
    tx.delete(todoLists).where(eq(todoLists.id, listId)).run();
  });
}

// ─── Item operations ─────────────────────────────────────────────────────────

export function getItemsForList(listId: string, includeCompleted = true): TodoItem[] {
  const db = getDb();
  const conditions = includeCompleted
    ? eq(todoItems.listId, listId)
    : and(eq(todoItems.listId, listId), eq(todoItems.completed, 0));

  return db.select().from(todoItems).where(conditions).orderBy(todoItems.orderIndex).all();
}

export function createItem(listId: string, input: CreateItemInput): TodoItem {
  const db = getDb();

  // Verify list exists
  const list = db.select().from(todoLists).where(eq(todoLists.id, listId)).get();
  if (!list) throw Errors.notFound('Todo list not found');

  // Calculate next orderIndex
  const maxResult = db
    .select({ maxIdx: max(todoItems.orderIndex) })
    .from(todoItems)
    .where(eq(todoItems.listId, listId))
    .get();
  const nextOrder = (maxResult?.maxIdx ?? -1) + 1;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(todoItems)
    .values({
      id,
      listId,
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? 0,
      completed: 0,
      orderIndex: nextOrder,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(todoItems).where(eq(todoItems.id, id)).get()!;
}

export function updateItem(itemId: string, input: TodoItemUpdate): TodoItem {
  const db = getDb();
  const existing = db.select().from(todoItems).where(eq(todoItems.id, itemId)).get();
  if (!existing) throw Errors.notFound('Todo item not found');

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates['title'] = input.title;
  if (input.notes !== undefined) updates['notes'] = input.notes;
  if (input.dueDate !== undefined) updates['dueDate'] = input.dueDate;
  if (input.priority !== undefined) updates['priority'] = input.priority;
  if (input.orderIndex !== undefined) updates['orderIndex'] = input.orderIndex;

  if (input.completed !== undefined) {
    updates['completed'] = input.completed ? 1 : 0;
    if (input.completed && !existing.completed) {
      updates['completedAt'] = now;
    } else if (!input.completed && existing.completed) {
      updates['completedAt'] = null;
    }
  }

  db.update(todoItems).set(updates).where(eq(todoItems.id, itemId)).run();

  return db.select().from(todoItems).where(eq(todoItems.id, itemId)).get()!;
}

export function deleteItem(itemId: string): void {
  const db = getDb();
  const existing = db.select().from(todoItems).where(eq(todoItems.id, itemId)).get();
  if (!existing) throw Errors.notFound('Todo item not found');

  db.delete(todoItems).where(eq(todoItems.id, itemId)).run();
}

export function reorderItems(listId: string, items: { id: string; orderIndex: number }[]): void {
  const db = getDb();
  db.transaction((tx) => {
    for (const item of items) {
      tx.update(todoItems)
        .set({ orderIndex: item.orderIndex, updatedAt: new Date().toISOString() })
        .where(and(eq(todoItems.id, item.id), eq(todoItems.listId, listId)))
        .run();
    }
  });
}
