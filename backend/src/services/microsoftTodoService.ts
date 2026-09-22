/**
 * T013 (005): Microsoft Graph API client for To Do task lists and tasks.
 * Handles fetching lists, tasks, and updating task completion status.
 */

import { refreshAccessToken } from './oauth-service.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MicrosoftTaskList {
  id: string;
  displayName: string;
  isOwner: boolean;
}

export interface MicrosoftTask {
  id: string;
  title: string;
  body: string | null;
  dueDateTime: string | null;
  importance: 'low' | 'normal' | 'high';
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  completedDateTime: string | null;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

// ─── Graph API response shapes ──────────────────────────────────────────────

interface GraphTaskList {
  id: string;
  displayName: string;
  isOwner: boolean;
}

interface GraphTask {
  id: string;
  title: string;
  body?: { content?: string; contentType?: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  importance: 'low' | 'normal' | 'high';
  status: string;
  completedDateTime?: { dateTime: string; timeZone: string };
  createdDateTime: string;
  lastModifiedDateTime: string;
}

interface GraphListResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const MAX_PAGES = 10;
const MAX_RETRIES_429 = 3;

async function graphFetch(
  url: string,
  oauthAccountId: string,
  options: RequestInit = {},
  retried401 = false,
): Promise<Response> {
  const token = await refreshAccessToken(oauthAccountId);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle 401 — force token refresh and retry once
  if (res.status === 401 && !retried401) {
    const newToken = await refreshAccessToken(oauthAccountId, true);
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  // Handle 429 — respect Retry-After with bounded retries
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
    const waitMs = Math.min(retryAfter, 30) * 1000; // cap at 30s
    await new Promise((r) => setTimeout(r, waitMs));
    // Return 429 — caller can retry if within budget
    return res;
  }

  return res;
}

function mapGraphTask(gt: GraphTask): MicrosoftTask {
  return {
    id: gt.id,
    title: gt.title,
    body: gt.body?.content?.trim() || null,
    dueDateTime: gt.dueDateTime?.dateTime ? new Date(gt.dueDateTime.dateTime).toISOString() : null,
    importance: gt.importance,
    status: gt.status as MicrosoftTask['status'],
    completedDateTime: gt.completedDateTime?.dateTime
      ? new Date(gt.completedDateTime.dateTime).toISOString()
      : null,
    createdDateTime: gt.createdDateTime,
    lastModifiedDateTime: gt.lastModifiedDateTime,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all task lists for a Microsoft account.
 */
export async function getMicrosoftTaskLists(oauthAccountId: string): Promise<MicrosoftTaskList[]> {
  const res = await graphFetch(`${GRAPH_BASE}/me/todo/lists`, oauthAccountId);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error fetching task lists: ${res.status} ${text}`);
  }

  const data = (await res.json()) as GraphListResponse<GraphTaskList>;
  return data.value.map((list) => ({
    id: list.id,
    displayName: list.displayName,
    isOwner: list.isOwner,
  }));
}

/**
 * Fetch tasks from a specific task list with pagination.
 */
export async function getMicrosoftTasks(
  oauthAccountId: string,
  listId: string,
  includeCompleted = true,
): Promise<MicrosoftTask[]> {
  const filter = includeCompleted ? '' : "&$filter=status ne 'completed'";
  let url: string | undefined = `${GRAPH_BASE}/me/todo/lists/${listId}/tasks?$top=100${filter}`;

  const allTasks: MicrosoftTask[] = [];
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res = await graphFetch(url, oauthAccountId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API error fetching tasks: ${res.status} ${text}`);
    }

    const data = (await res.json()) as GraphListResponse<GraphTask>;
    allTasks.push(...data.value.map(mapGraphTask));

    url = data['@odata.nextLink'];
    pages++;
  }

  return allTasks;
}

/**
 * Update a task's completion status on Microsoft To Do.
 * When completing, sets completedDateTime. When uncompleting, clears it.
 */
export async function updateMicrosoftTaskStatus(
  oauthAccountId: string,
  listId: string,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const body: Record<string, unknown> = {
    status: completed ? 'completed' : 'notStarted',
  };

  if (completed) {
    body['completedDateTime'] = {
      dateTime: new Date().toISOString(),
      timeZone: 'UTC',
    };
  }

  let retries = 0;
  let res: Response;

  do {
    res = await graphFetch(
      `${GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`,
      oauthAccountId,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );

    if (res.status !== 429) break;
    retries++;
  } while (retries < MAX_RETRIES_429);

  if (!res!.ok) {
    const text = await res!.text();
    throw new Error(`Graph API error updating task status: ${res!.status} ${text}`);
  }
}

/**
 * Map Microsoft importance to local priority scale.
 * high → 3, normal → 0, low → 1
 */
export function mapImportanceToPriority(importance: string): number {
  switch (importance) {
    case 'high':
      return 3;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/**
 * Map local priority to Microsoft importance.
 */
export function mapPriorityToImportance(priority: number): 'low' | 'normal' | 'high' {
  if (priority >= 3) return 'high';
  if (priority === 1) return 'low';
  return 'normal';
}
