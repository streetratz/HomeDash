/**
 * T014 (005): Todo sync orchestration for Microsoft To Do.
 * Syncs task lists and items from Microsoft Graph API to local DB.
 * Also provides provider-aware completion toggling.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { todoLists, todoItems, oauthAccounts } from '../db/schema/index.js';
import {
  getMicrosoftTaskLists,
  getMicrosoftTasks,
  updateMicrosoftTaskStatus,
  mapImportanceToPriority,
} from './microsoftTodoService.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  listsSynced: number;
  itemsSynced: number;
  errors: string[];
}

// ─── Sync orchestration ─────────────────────────────────────────────────────

/**
 * Sync Microsoft To Do lists and tasks for a user.
 * Fetches from Graph API, then upserts to local DB in a short transaction.
 */
export async function syncMicrosoftTodoForUser(userId: string): Promise<SyncResult> {
  const db = getDb();
  const result: SyncResult = { listsSynced: 0, itemsSynced: 0, errors: [] };

  // Find Microsoft OAuth accounts for this user
  const accounts = db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'microsoft')))
    .all();

  if (accounts.length === 0) {
    result.errors.push('No Microsoft account connected');
    return result;
  }

  for (const account of accounts) {
    try {
      await syncAccountTasks(userId, account.id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      result.errors.push(`Account ${account.id}: ${message}`);
    }
  }

  return result;
}

async function syncAccountTasks(
  userId: string,
  oauthAccountId: string,
  result: SyncResult,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Phase 1: Fetch all remote data (outside transaction)
  const remoteLists = await getMicrosoftTaskLists(oauthAccountId);
  const remoteTasksByList = new Map<string, Awaited<ReturnType<typeof getMicrosoftTasks>>>();

  for (const list of remoteLists) {
    const tasks = await getMicrosoftTasks(oauthAccountId, list.id, true);
    remoteTasksByList.set(list.id, tasks);
  }

  // Phase 2: Short DB transaction for all writes
  db.transaction((tx) => {
    // Get existing local lists for this oauth account
    const existingLists = tx
      .select()
      .from(todoLists)
      .where(
        and(
          eq(todoLists.userId, userId),
          eq(todoLists.oauthAccountId, oauthAccountId),
          eq(todoLists.providerType, 'microsoft'),
        ),
      )
      .all();

    const existingListMap = new Map(existingLists.map((l) => [l.providerListId, l]));
    const seenListIds = new Set<string>();

    // Upsert lists
    for (const remoteList of remoteLists) {
      seenListIds.add(remoteList.id);
      const existing = existingListMap.get(remoteList.id);

      if (existing) {
        tx.update(todoLists)
          .set({
            name: remoteList.displayName,
            lastSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(todoLists.id, existing.id))
          .run();
      } else {
        tx.insert(todoLists)
          .values({
            id: crypto.randomUUID(),
            userId,
            name: remoteList.displayName,
            providerType: 'microsoft',
            providerListId: remoteList.id,
            oauthAccountId,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      result.listsSynced++;
    }

    // Delete lists no longer on Microsoft
    for (const existing of existingLists) {
      if (existing.providerListId && !seenListIds.has(existing.providerListId)) {
        // Items cascade via FK, but delete explicitly for clarity
        tx.delete(todoItems).where(eq(todoItems.listId, existing.id)).run();
        tx.delete(todoLists).where(eq(todoLists.id, existing.id)).run();
      }
    }

    // Reload lists after upsert to get IDs
    const localLists = tx
      .select()
      .from(todoLists)
      .where(
        and(
          eq(todoLists.userId, userId),
          eq(todoLists.oauthAccountId, oauthAccountId),
          eq(todoLists.providerType, 'microsoft'),
        ),
      )
      .all();

    // Upsert items for each list
    for (const localList of localLists) {
      if (!localList.providerListId) continue;

      const remoteTasks = remoteTasksByList.get(localList.providerListId);
      if (!remoteTasks) continue;

      const existingItems = tx
        .select()
        .from(todoItems)
        .where(eq(todoItems.listId, localList.id))
        .all();

      const existingItemMap = new Map(existingItems.map((i) => [i.providerItemId, i]));
      const seenItemIds = new Set<string>();

      for (const task of remoteTasks) {
        seenItemIds.add(task.id);
        const existing = existingItemMap.get(task.id);
        const isCompleted = task.status === 'completed';
        const priority = mapImportanceToPriority(task.importance);

        if (existing) {
          tx.update(todoItems)
            .set({
              title: task.title,
              notes: task.body,
              dueDate: task.dueDateTime,
              priority,
              completed: isCompleted ? 1 : 0,
              completedAt: task.completedDateTime,
              updatedAt: now,
            })
            .where(eq(todoItems.id, existing.id))
            .run();
        } else {
          // New item — append after existing items
          const maxOrder = existingItems.reduce((max, i) => Math.max(max, i.orderIndex), -1);

          tx.insert(todoItems)
            .values({
              id: crypto.randomUUID(),
              listId: localList.id,
              title: task.title,
              notes: task.body,
              dueDate: task.dueDateTime,
              priority,
              completed: isCompleted ? 1 : 0,
              completedAt: task.completedDateTime,
              orderIndex: maxOrder + 1 + seenItemIds.size,
              providerItemId: task.id,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }

        result.itemsSynced++;
      }

      // Delete items no longer on Microsoft
      const providerIdsToDelete = existingItems
        .filter((i) => i.providerItemId && !seenItemIds.has(i.providerItemId))
        .map((i) => i.id);

      if (providerIdsToDelete.length > 0) {
        tx.delete(todoItems).where(inArray(todoItems.id, providerIdsToDelete)).run();
      }
    }
  });
}

// ─── Provider-aware completion toggle ───────────────────────────────────────

/**
 * Toggle task completion, syncing to the provider if needed.
 * Called from the update item route when a Microsoft-backed item is toggled.
 */
export async function toggleProviderCompletion(itemId: string, completed: boolean): Promise<void> {
  const db = getDb();

  // Look up the item and its list to check provider info
  const item = db
    .select({
      id: todoItems.id,
      listId: todoItems.listId,
      providerItemId: todoItems.providerItemId,
    })
    .from(todoItems)
    .where(eq(todoItems.id, itemId))
    .get();

  if (!item?.providerItemId) return;

  const list = db
    .select({
      providerType: todoLists.providerType,
      providerListId: todoLists.providerListId,
      oauthAccountId: todoLists.oauthAccountId,
    })
    .from(todoLists)
    .where(eq(todoLists.id, item.listId))
    .get();

  if (!list || list.providerType !== 'microsoft') return;
  if (!list.providerListId || !list.oauthAccountId) return;

  // Sync completion to Microsoft Graph API
  await updateMicrosoftTaskStatus(
    list.oauthAccountId,
    list.providerListId,
    item.providerItemId,
    completed,
  );
}
