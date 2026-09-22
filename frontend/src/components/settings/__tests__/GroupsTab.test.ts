import { describe, expect, it } from 'vitest';
import { filterEligibleGroupUsers } from '../GroupsTab.js';
import type { AdminUser } from '../../../state/users.js';

const users: AdminUser[] = [
  {
    id: 'user-1',
    username: 'alex',
    displayName: 'Alex Smith',
    role: 'standard',
    lastLoginAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    groups: [],
  },
  {
    id: 'user-2',
    username: 'jamie',
    displayName: 'Jamie Jones',
    role: 'standard',
    lastLoginAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    groups: [],
  },
];

describe('filterEligibleGroupUsers', () => {
  it('excludes existing members and searches display names and usernames', () => {
    expect(filterEligibleGroupUsers(users, ['user-1'], '')).toEqual([users[1]]);
    expect(filterEligibleGroupUsers(users, [], 'SMITH')).toEqual([users[0]]);
    expect(filterEligibleGroupUsers(users, [], 'jamie')).toEqual([users[1]]);
  });
});
