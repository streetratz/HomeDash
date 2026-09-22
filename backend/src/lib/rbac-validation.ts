/**
 * T002 (012-RBAC): Zod validation schemas for RBAC inputs.
 */

import { z } from 'zod';
import { PERMISSION_CATEGORIES, PERMISSION_LEVELS } from './permissions.js';

// ─── Group schemas ───────────────────────────────────────────────────────────

export const GroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
  permissions: z
    .array(
      z.object({
        category: z.enum(PERMISSION_CATEGORIES),
        level: z.enum(PERMISSION_LEVELS),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

export const GroupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  permissions: z
    .array(
      z.object({
        category: z.enum(PERMISSION_CATEGORIES),
        level: z.enum(PERMISSION_LEVELS),
      }),
    )
    .max(10)
    .optional(),
});

// ─── Membership schemas ──────────────────────────────────────────────────────

export const MembershipAddSchema = z.object({
  userId: z.string().uuid(),
});

// ─── Dashboard access schemas ────────────────────────────────────────────────

export const DashboardAccessRuleSchema = z.object({
  groupId: z.string().uuid(),
  accessLevel: z.enum(['view', 'edit']),
});

export const DashboardAccessUpdateSchema = z.object({
  rules: z.array(DashboardAccessRuleSchema).max(50),
});
