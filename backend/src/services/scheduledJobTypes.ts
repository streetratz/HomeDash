/**
 * T006: Scheduled job Zod validation schemas and types.
 */

import { z } from 'zod';

// ── Action Types ─────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'calendar_sync',
  'sonos_playback',
  'database_backup',
  'portable_backup',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

// ── Action Param Schemas ─────────────────────────────────────────────────────

export const calendarSyncParamsSchema = z.object({}).strict();

export const databaseBackupParamsSchema = z.object({
  retention: z.number().int().min(1).max(30).default(7),
});

export const portableBackupParamsSchema = z.object({
  retention: z.number().int().min(1).max(30).default(7),
});

export const sonosPlaybackParamsSchema = z.object({
  userId: z.string().min(1),
  householdId: z.string().min(1),
  groupId: z.string().min(1),
  favoriteId: z.string().min(1),
  volume: z.number().min(0).max(100).optional(),
  playOnCompletion: z.boolean().optional().default(true),
});

/** Map action type → param schema for runtime validation. */
export const actionParamSchemas: Record<ActionType, z.ZodTypeAny> = {
  calendar_sync: calendarSyncParamsSchema,
  sonos_playback: sonosPlaybackParamsSchema,
  database_backup: databaseBackupParamsSchema,
  portable_backup: portableBackupParamsSchema,
};

// ── Cron Validation ──────────────────────────────────────────────────────────

/** Basic cron expression validation (5-field). Detailed check done by croner at runtime. */
const cronExpressionSchema = z
  .string()
  .regex(/^(\S+\s+){4}\S+$/, 'Must be a valid 5-field cron expression (e.g., "*/5 * * * *")');

// ── CRUD Schemas ─────────────────────────────────────────────────────────────

export const createScheduledJobSchema = z.object({
  name: z.string().min(1).max(100),
  actionType: z.enum(ACTION_TYPES),
  actionParams: z.string().default('{}'),
  cronExpression: cronExpressionSchema,
  enabled: z.boolean().optional().default(true),
});

export const updateScheduledJobSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  actionType: z.enum(ACTION_TYPES).optional(),
  actionParams: z.string().optional(),
  cronExpression: cronExpressionSchema.optional(),
  enabled: z.boolean().optional(),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type CreateScheduledJobInput = z.infer<typeof createScheduledJobSchema>;
export type UpdateScheduledJobInput = z.infer<typeof updateScheduledJobSchema>;
