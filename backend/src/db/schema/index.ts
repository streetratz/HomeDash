/**
 * T024: Drizzle schema per data-model.md.
 * All entities use TEXT UUIDs (server-generated) and ISO8601 timestamp strings.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: ['admin', 'standard'] }).notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastLoginAt: text('last_login_at'),
  },
  (t) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(t.username),
  }),
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  oauthAccounts: many(oauthAccounts),
  calendarSources: many(calendarSources),
  todoLists: many(todoLists),
  caldavAccounts: many(caldavAccounts),
  groupMemberships: many(userGroupMemberships),
  publicWidgetInstances: many(appWidgetInstances),
}));

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    /** Per-session CSRF secret (seed used to derive/verify tokens). */
    csrfSecret: text('csrf_secret').notNull(),
  },
  (t) => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(t.expiresAt),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ─── App Shell Settings (singleton row) ──────────────────────────────────────

export const appShellSettings = sqliteTable('app_shell_settings', {
  id: text('id').primaryKey().default('global'),
  titleText: text('title_text').notNull().default('HomeDash'),
  titleFont: text('title_font').notNull().default('system'),
  titleFontSizePx: integer('title_font_size_px').notNull().default(20),
  bodyFont: text('body_font').notNull().default('system'),
  headerHeightPx: integer('header_height_px').notNull().default(56),
  logoAssetId: text('logo_asset_id').references(() => uploadedAssets.id, {
    onDelete: 'set null',
  }),
  clockStripEnabled: integer('clock_strip_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Horizontal alignment of the clock strip bar: 'left' | 'center' | 'right'. */
  clockStripAlignment: text('clock_strip_alignment', { enum: ['left', 'center', 'right'] }).notNull().default('center'),
  homeTimezone: text('home_timezone'),
  /** JSON array of { label: string; timezone: string }[] — up to 5 extras. */
  timezonesJson: text('timezones_json').notNull().default('[]'),
  /** JSON object for home clock display config: { label?, layout?, showOffset?, homeIconSide?, dayNightSide? } */
  homeClockConfig: text('home_clock_config'),
  footerText: text('footer_text'),
  repoUrl: text('repo_url'),
  /** Explicitly selected dashboard shown to unauthenticated web users. */
  unauthWebDashboardId: text('unauth_web_dashboard_id').references(() => dashboards.id, {
    onDelete: 'set null',
  }),
  /** Explicitly selected dashboard shown to unauthenticated mobile users. */
  unauthMobileDashboardId: text('unauth_mobile_dashboard_id').references(() => dashboards.id, {
    onDelete: 'set null',
  }),
  /** Whether the screensaver is enabled globally */
  screensaverEnabled: integer('screensaver_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Minutes of idle before screensaver activates (default 15) */
  screensaverIdleMinutes: integer('screensaver_idle_minutes').notNull().default(15),
  /** Photo source ID used for the screensaver slideshow */
  screensaverSourceId: text('screensaver_source_id'),
  /** Screensaver slide interval in seconds (default 30) */
  screensaverIntervalSeconds: integer('screensaver_interval_seconds').notNull().default(30),
  /** Screensaver weather overlay — latitude */
  screensaverWeatherLat: real('screensaver_weather_lat'),
  /** Screensaver weather overlay — longitude */
  screensaverWeatherLon: real('screensaver_weather_lon'),
  /** Screensaver weather overlay — display name for the location */
  screensaverWeatherLocation: text('screensaver_weather_location'),
  /** Screensaver weather overlay — temperature unit C or F */
  screensaverWeatherUnit: text('screensaver_weather_unit', { enum: ['C', 'F'] }).default('C'),
  /** Screensaver clock format — 12h or 24h */
  screensaverClockFormat: text('screensaver_clock_format', { enum: ['12h', '24h'] }).default('12h'),
  /** Screensaver image transition effect */
  screensaverTransition: text('screensaver_transition', { enum: ['fade', 'slide', 'kenburns', 'crossfade'] }).default('kenburns'),
  /** Header animation style */
  headerStyle: text('header_style', { enum: ['none', 'gradient-shift', 'aurora', 'aurora-australis', 'glass-glow', 'gradient-underline'] }).notNull().default('none'),
  /** Where header animation is applied (deprecated — use headerStyle for bg and headerTitleStyle for text) */
  headerStyleTarget: text('header_style_target', { enum: ['background', 'border', 'title'] }).notNull().default('background'),
  /** Whether to apply glassmorphism effect over header */
  headerGlassEffect: integer('header_glass_effect', { mode: 'boolean' }).notNull().default(false),
  /** Header title text animation style */
  headerTitleStyle: text('header_title_style', { enum: ['none', 'gradient-shift', 'aurora', 'aurora-australis', 'glass-glow', 'gradient-underline'] }).notNull().default('none'),
  updatedAt: text('updated_at').notNull(),
});

// ─── User Preferences ────────────────────────────────────────────────────────

export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  themeMode: text('theme_mode', { enum: ['light', 'dark'] }).notNull().default('dark'),
  webDashboardId: text('web_dashboard_id').references(() => dashboards.id, {
    onDelete: 'set null',
  }),
  mobileDashboardId: text('mobile_dashboard_id').references(() => dashboards.id, {
    onDelete: 'set null',
  }),
  updatedAt: text('updated_at').notNull(),
});

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

// ─── Dashboards ───────────────────────────────────────────────────────────────

export const dashboards = sqliteTable(
  'dashboards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    applicability: text('applicability', { enum: ['web', 'mobile', 'both'] })
      .notNull()
      .default('both'),
    backgroundType: text('background_type', { enum: ['solid', 'image'] })
      .notNull()
      .default('solid'),
    backgroundColor: text('background_color'),
    backgroundAssetId: text('background_asset_id').references(() => uploadedAssets.id, {
      onDelete: 'set null',
    }),
    backgroundDisplayMode: text('background_display_mode', { enum: ['fill', 'stretch'] }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    applicabilityIdx: index('dashboards_applicability_idx').on(t.applicability),
  }),
);

export const dashboardsRelations = relations(dashboards, ({ many }) => ({
  placeholderWidgets: many(placeholderWidgets),
}));

// ─── Placeholder Widgets ──────────────────────────────────────────────────────

export const placeholderWidgets = sqliteTable(
  'placeholder_widgets',
  {
    id: text('id').primaryKey(),
    dashboardId: text('dashboard_id')
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    /** Stable identifier that survives layout edits. */
    stableKey: text('stable_key').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    w: integer('w').notNull(),
    h: integer('h').notNull(),
    borderColor: text('border_color').notNull().default('#ffffff'),
    borderSize: integer('border_size').notNull().default(2),
    showBorder: integer('show_border', { mode: 'boolean' }).notNull().default(true),
    title: text('title'),
    showTitle: integer('show_title', { mode: 'boolean' }).notNull().default(false),
    /** Title display style: 'header' (bar) or 'pill' (floating badge) */
    titleStyle: text('title_style').notNull().default('header'),
    /** Child layout: 'stacked' (vertical) or 'side-by-side' (horizontal) */
    childLayout: text('child_layout').notNull().default('stacked'),
    opacity: real('opacity').notNull().default(0.3),
    /** Background style: 'solid' or 'aurora' */
    backgroundStyle: text('background_style').notNull().default('solid'),
    /** Background color (hex) for solid style */
    backgroundColor: text('background_color'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    dashboardIdIdx: index('placeholder_widgets_dashboard_id_idx').on(t.dashboardId),
  }),
);

export const placeholderWidgetsRelations = relations(placeholderWidgets, ({ one, many }) => ({
  dashboard: one(dashboards, {
    fields: [placeholderWidgets.dashboardId],
    references: [dashboards.id],
  }),
  widgetInstances: many(appWidgetInstances),
  breakpointLayouts: many(placeholderBreakpointLayouts),
}));

// ─── Placeholder Breakpoint Layouts ──────────────────────────────────────────

export const placeholderBreakpointLayouts = sqliteTable(
  'placeholder_breakpoint_layouts',
  {
    id: text('id').primaryKey(),
    placeholderId: text('placeholder_id')
      .notNull()
      .references(() => placeholderWidgets.id, { onDelete: 'cascade' }),
    breakpoint: text('breakpoint').notNull(), // 'md' | 'sm' | 'xs' | 'xxs'
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    w: integer('w').notNull(),
    h: integer('h').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    uniquePlaceholderBp: uniqueIndex('placeholder_bp_unique_idx').on(t.placeholderId, t.breakpoint),
  }),
);

export const placeholderBreakpointLayoutsRelations = relations(placeholderBreakpointLayouts, ({ one }) => ({
  placeholder: one(placeholderWidgets, {
    fields: [placeholderBreakpointLayouts.placeholderId],
    references: [placeholderWidgets.id],
  }),
}));

// ─── App Widget Instances ─────────────────────────────────────────────────────

export const appWidgetInstances = sqliteTable(
  'app_widget_instances',
  {
    id: text('id').primaryKey(),
    placeholderId: text('placeholder_id')
      .notNull()
      .references(() => placeholderWidgets.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // e.g. 'links_list'
    orderIndex: integer('order_index').notNull().default(0),
    /** Type-specific JSON configuration. */
    configJson: text('config_json').notNull().default('{}'),
    publicVisibility: text('public_visibility', {
      enum: ['hidden', 'read-only', 'visible'],
    })
      .notNull()
      .default('hidden'),
    publicSourceUserId: text('public_source_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    placeholderOrderIdx: index('app_widget_instances_placeholder_order_idx').on(
      t.placeholderId,
      t.orderIndex,
    ),
    publicVisibilityCheck: check(
      'app_widget_instances_public_visibility_check',
      sql`${t.publicVisibility} in ('hidden', 'read-only', 'visible')`,
    ),
  }),
);

export const appWidgetInstancesRelations = relations(appWidgetInstances, ({ one, many }) => ({
  placeholder: one(placeholderWidgets, {
    fields: [appWidgetInstances.placeholderId],
    references: [placeholderWidgets.id],
  }),
  publicSourceUser: one(users, {
    fields: [appWidgetInstances.publicSourceUserId],
    references: [users.id],
  }),
  linksListItems: many(linksListItems),
  shortcutGroups: many(shortcutGroups),
  appShortcuts: many(appShortcuts),
}));

// ─── Links List Items ─────────────────────────────────────────────────────────

export const linksListItems = sqliteTable(
  'links_list_items',
  {
    id: text('id').primaryKey(),
    widgetInstanceId: text('widget_instance_id')
      .notNull()
      .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull().default(0),
    title: text('title').notNull(), // max 15 chars validated at service layer
    url: text('url').notNull(),
    iconKey: text('icon_key'),
    iconOverrideKey: text('icon_override_key'),
  },
  (t) => ({
    widgetOrderIdx: index('links_list_items_widget_order_idx').on(
      t.widgetInstanceId,
      t.orderIndex,
    ),
  }),
);

export const linksListItemsRelations = relations(linksListItems, ({ one }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [linksListItems.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
}));

// ─── Uploaded Assets ──────────────────────────────────────────────────────────

export const uploadedAssets = sqliteTable('uploaded_assets', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['logo', 'background', 'icon'] }).notNull(),
  originalFilename: text('original_filename').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  sha256: text('sha256').notNull(),
  /** Relative path within HOMEDASH_DATA_DIR. */
  storagePath: text('storage_path').notNull(),
  createdAt: text('created_at').notNull(),
});

// ─── OAuth Accounts ──────────────────────────────────────────────────────────

export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['microsoft', 'google', 'spotify', 'sonos'] }).notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessTokenEnc: text('access_token_enc').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    tokenExpiresAt: text('token_expires_at'),
    email: text('email'),
    displayName: text('display_name'),
    status: text('status', { enum: ['active', 'error'] })
      .notNull()
      .default('active'),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('oauth_accounts_user_id_idx').on(t.userId),
    providerAccountIdx: uniqueIndex('oauth_accounts_provider_account_idx').on(
      t.provider,
      t.providerAccountId,
    ),
  }),
);

export const oauthAccountsRelations = relations(oauthAccounts, ({ one, many }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
  calendarSources: many(calendarSources),
}));

// ─── Calendar Sources ────────────────────────────────────────────────────────

export const calendarSources = sqliteTable(
  'calendar_sources',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    oauthAccountId: text('oauth_account_id').references(() => oauthAccounts.id, {
      onDelete: 'set null',
    }),
    type: text('type', {
      enum: ['microsoft', 'google', 'ical', 'ical_file', 'birthday_local'],
    }).notNull(),
    name: text('name').notNull(),
    url: text('url'),
    icsContent: text('ics_content'),
    fileName: text('file_name'),
    color: text('color').notNull().default('#3b82f6'),
    syncIntervalSeconds: integer('sync_interval_seconds').notNull().default(300),
    lastSyncAt: text('last_sync_at'),
    lastSyncError: text('last_sync_error'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('calendar_sources_user_id_idx').on(t.userId),
    oauthAccountIdIdx: index('calendar_sources_oauth_account_id_idx').on(t.oauthAccountId),
  }),
);

export const calendarSourcesRelations = relations(calendarSources, ({ one, many }) => ({
  user: one(users, { fields: [calendarSources.userId], references: [users.id] }),
  oauthAccount: one(oauthAccounts, {
    fields: [calendarSources.oauthAccountId],
    references: [oauthAccounts.id],
  }),
  calendarEvents: many(calendarEvents),
  birthdays: many(calendarBirthdays),
}));

// ─── Calendar Events ─────────────────────────────────────────────────────────

export const calendarEvents = sqliteTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => calendarSources.id, { onDelete: 'cascade' }),
    providerEventId: text('provider_event_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    startTz: text('start_tz'),
    endTz: text('end_tz'),
    isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
    isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
    recurrenceRule: text('recurrence_rule'),
    calendarName: text('calendar_name'),
    rawJson: text('raw_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    sourceStartIdx: index('calendar_events_source_start_idx').on(t.sourceId, t.startAt),
    sourceProviderIdx: uniqueIndex('calendar_events_source_provider_idx').on(
      t.sourceId,
      t.providerEventId,
    ),
  }),
);

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  source: one(calendarSources, {
    fields: [calendarEvents.sourceId],
    references: [calendarSources.id],
  }),
}));

// ─── Local Birthday Records ──────────────────────────────────────────────────

export const calendarBirthdays = sqliteTable(
  'calendar_birthdays',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => calendarSources.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    month: integer('month').notNull(),
    day: integer('day').notNull(),
    birthYear: integer('birth_year'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    sourceIdIdx: index('calendar_birthdays_source_id_idx').on(t.sourceId),
  }),
);

export const calendarBirthdaysRelations = relations(calendarBirthdays, ({ one }) => ({
  source: one(calendarSources, {
    fields: [calendarBirthdays.sourceId],
    references: [calendarSources.id],
  }),
}));

// ─── Icon Cache Entries ───────────────────────────────────────────────────────

// ─── Todo Lists ──────────────────────────────────────────────────────────────

export const todoLists = sqliteTable(
  'todo_lists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    providerType: text('provider_type', { enum: ['local', 'microsoft', 'apple'] })
      .notNull()
      .default('local'),
    providerListId: text('provider_list_id'),
    oauthAccountId: text('oauth_account_id').references(() => oauthAccounts.id, {
      onDelete: 'set null',
    }),
    caldavAccountId: text('caldav_account_id'),
    lastSyncedAt: text('last_synced_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('todo_lists_user_id_idx').on(t.userId),
  }),
);

export const todoListsRelations = relations(todoLists, ({ one, many }) => ({
  user: one(users, { fields: [todoLists.userId], references: [users.id] }),
  oauthAccount: one(oauthAccounts, {
    fields: [todoLists.oauthAccountId],
    references: [oauthAccounts.id],
  }),
  items: many(todoItems),
}));

// ─── Todo Items ──────────────────────────────────────────────────────────────

export const todoItems = sqliteTable(
  'todo_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => todoLists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    dueDate: text('due_date'),
    priority: integer('priority').notNull().default(0),
    completed: integer('completed').notNull().default(0),
    completedAt: text('completed_at'),
    orderIndex: integer('order_index').notNull(),
    providerItemId: text('provider_item_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    listIdIdx: index('todo_items_list_id_idx').on(t.listId),
    providerItemIdx: index('todo_items_provider_item_idx').on(t.providerItemId),
  }),
);

export const todoItemsRelations = relations(todoItems, ({ one }) => ({
  list: one(todoLists, { fields: [todoItems.listId], references: [todoLists.id] }),
}));

// ─── CalDAV Accounts ─────────────────────────────────────────────────────────

export const caldavAccounts = sqliteTable(
  'caldav_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serverUrl: text('server_url').notNull(),
    username: text('username').notNull(),
    encryptedPassword: text('encrypted_password').notNull(),
    displayName: text('display_name'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('caldav_accounts_user_id_idx').on(t.userId),
  }),
);

export const caldavAccountsRelations = relations(caldavAccounts, ({ one, many }) => ({
  user: one(users, { fields: [caldavAccounts.userId], references: [users.id] }),
  todoLists: many(todoLists),
}));

// ─── Icon Cache Entries ───────────────────────────────────────────────────────

export const iconCacheEntries = sqliteTable('icon_cache_entries', {
  /** Normalized hostname or library key (PRIMARY KEY). */
  iconKey: text('icon_key').primaryKey(),
  source: text('source', { enum: ['selfh', 'built_in'] }).notNull(),
  sourceUrl: text('source_url'),
  assetId: text('asset_id').references(() => uploadedAssets.id, { onDelete: 'set null' }),
  etag: text('etag'),
  lastFetchedAt: text('last_fetched_at'),
  status: text('status', { enum: ['ok', 'missing', 'error'] }).notNull().default('missing'),
  errorMessage: text('error_message'),
});

// ─── Photo Sources ────────────────────────────────────────────────────────────

export const photoSources = sqliteTable('photo_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** 'folder' = local server directory, 'url_list' = explicit list of image URLs */
  type: text('type', { enum: ['folder', 'url_list'] }).notNull(),
  /** JSON config — shape depends on type:
   *  folder: { path: string, recursive?: boolean }
   *  url_list: { urls: string[] }
   */
  configJson: text('config_json').notNull().default('{}'),
  /** Cached manifest of image keys, rebuilt on scan */
  manifestJson: text('manifest_json'),
  lastScannedAt: text('last_scanned_at'),
  createdAt: text('created_at').notNull(),
});

// ─── RBAC: Groups ────────────────────────────────────────────────────────────

export const groups = sqliteTable(
  'groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Immutable slug for built-in groups (e.g. 'administrators'). NULL for custom groups. */
    slug: text('slug'),
    description: text('description'),
    /** 1 for Administrators/Users/Viewers; 0 for custom groups. */
    isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('groups_name_idx').on(t.name),
    slugIdx: uniqueIndex('groups_slug_idx').on(t.slug),
  }),
);

export const groupsRelations = relations(groups, ({ many }) => ({
  permissions: many(groupPermissions),
  memberships: many(userGroupMemberships),
  dashboardAccessRules: many(dashboardAccessRules),
}));

// ─── RBAC: Group Permissions ─────────────────────────────────────────────────

export const groupPermissions = sqliteTable(
  'group_permissions',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    /** Permission category: dashboards, widgets, settings, users, integrations */
    category: text('category').notNull(),
    /** Permission level: view, manage */
    level: text('level').notNull(),
  },
  (t) => ({
    groupIdIdx: index('group_permissions_group_id_idx').on(t.groupId),
    uniqueIdx: uniqueIndex('group_permissions_unique_idx').on(t.groupId, t.category),
  }),
);

export const groupPermissionsRelations = relations(groupPermissions, ({ one }) => ({
  group: one(groups, { fields: [groupPermissions.groupId], references: [groups.id] }),
}));

// ─── RBAC: User–Group Memberships ────────────────────────────────────────────

export const userGroupMemberships = sqliteTable(
  'user_group_memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('user_group_memberships_user_id_idx').on(t.userId),
    uniqueIdx: uniqueIndex('user_group_memberships_unique_idx').on(t.userId, t.groupId),
  }),
);

export const userGroupMembershipsRelations = relations(userGroupMemberships, ({ one }) => ({
  user: one(users, { fields: [userGroupMemberships.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroupMemberships.groupId], references: [groups.id] }),
}));

// ─── RBAC: Dashboard Access Rules ────────────────────────────────────────────

export const dashboardAccessRules = sqliteTable(
  'dashboard_access_rules',
  {
    id: text('id').primaryKey(),
    dashboardId: text('dashboard_id')
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    /** 'view' or 'edit' */
    accessLevel: text('access_level').notNull(),
  },
  (t) => ({
    dashboardIdIdx: index('dashboard_access_rules_dashboard_id_idx').on(t.dashboardId),
    uniqueIdx: uniqueIndex('dashboard_access_rules_unique_idx').on(
      t.dashboardId,
      t.groupId,
      t.accessLevel,
    ),
  }),
);

export const dashboardAccessRulesRelations = relations(dashboardAccessRules, ({ one }) => ({
  dashboard: one(dashboards, {
    fields: [dashboardAccessRules.dashboardId],
    references: [dashboards.id],
  }),
  group: one(groups, {
    fields: [dashboardAccessRules.groupId],
    references: [groups.id],
  }),
}));

// ─── Shortcut Groups (013-app-shortcuts) ─────────────────────────────────────

export const shortcutGroups = sqliteTable(
  'shortcut_groups',
  {
    id: text('id').primaryKey(),
    widgetInstanceId: text('widget_instance_id')
      .notNull()
      .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    widgetInstanceIdIdx: index('shortcut_groups_widget_instance_id_idx').on(t.widgetInstanceId),
  }),
);

export const shortcutGroupsRelations = relations(shortcutGroups, ({ one, many }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [shortcutGroups.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
  shortcuts: many(appShortcuts),
}));

// ─── App Shortcuts (013-app-shortcuts) ───────────────────────────────────────

export const appShortcuts = sqliteTable(
  'app_shortcuts',
  {
    id: text('id').primaryKey(),
    widgetInstanceId: text('widget_instance_id')
      .notNull()
      .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => shortcutGroups.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    iconKey: text('icon_key'),
    iconAssetId: text('icon_asset_id').references(() => uploadedAssets.id, {
      onDelete: 'set null',
    }),
    iconOverrideAssetId: text('icon_override_asset_id').references(() => uploadedAssets.id, {
      onDelete: 'set null',
    }),
    pingEnabled: integer('ping_enabled').notNull().default(0),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    widgetInstanceIdIdx: index('app_shortcuts_widget_instance_id_idx').on(t.widgetInstanceId),
    groupIdIdx: index('app_shortcuts_group_id_idx').on(t.groupId),
  }),
);

export const appShortcutsRelations = relations(appShortcuts, ({ one }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [appShortcuts.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
  group: one(shortcutGroups, {
    fields: [appShortcuts.groupId],
    references: [shortcutGroups.id],
  }),
  pingResult: one(shortcutPingResults, {
    fields: [appShortcuts.id],
    references: [shortcutPingResults.shortcutId],
  }),
}));

// ─── Shortcut Ping Results (013-app-shortcuts) ──────────────────────────────

export const shortcutPingResults = sqliteTable('shortcut_ping_results', {
  shortcutId: text('shortcut_id')
    .primaryKey()
    .references(() => appShortcuts.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['up', 'down', 'unknown'] }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  checkedAt: text('checked_at').notNull(),
  error: text('error'),
});

export const shortcutPingResultsRelations = relations(shortcutPingResults, ({ one }) => ({
  shortcut: one(appShortcuts, {
    fields: [shortcutPingResults.shortcutId],
    references: [appShortcuts.id],
  }),
}));

// ─── Pi-hole Instances (Connection-level, decoupled from widgets) ────────────

export const piholeInstances = sqliteTable('pihole_instances', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default('Pi-hole'),
  /** @deprecated — use widget_connections join table. Kept for migration fallback. */
  widgetInstanceId: text('widget_instance_id')
    .references(() => appWidgetInstances.id, { onDelete: 'set null' }),
  baseUrl: text('base_url').notNull(),
  apiTokenEncrypted: text('api_token_encrypted').notNull(),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(30),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const piholeInstancesRelations = relations(piholeInstances, ({ one }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [piholeInstances.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
}));

// ─── Docker Connections ──────────────────────────────────────────────────────

// ─── UniFi Instances ─────────────────────────────────────────────────────────

export const unifiInstances = sqliteTable('unifi_instances', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default('UniFi'),
  widgetInstanceId: text('widget_instance_id')
    .references(() => appWidgetInstances.id, { onDelete: 'set null' }),
  baseUrl: text('base_url').notNull(),
  usernameEncrypted: text('username_encrypted').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  siteName: text('site_name').notNull().default('default'),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(30),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const unifiInstancesRelations = relations(unifiInstances, ({ one }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [unifiInstances.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
}));

// ─── Docker Connections ──────────────────────────────────────────────────────

export const dockerConnections = sqliteTable('docker_connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default('Docker'),
  dockerUrl: text('docker_url').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Widget ↔ Connection mapping ─────────────────────────────────────────────

export const widgetConnections = sqliteTable(
  'widget_connections',
  {
    widgetInstanceId: text('widget_instance_id')
      .notNull()
      .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
    connectionType: text('connection_type').notNull(), // 'pihole' | 'docker' | 'unifi'
    connectionId: text('connection_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('widget_conn_pk').on(
      table.widgetInstanceId,
      table.connectionType,
      table.connectionId,
    ),
    index('widget_conn_by_connection').on(table.connectionType, table.connectionId),
  ],
);

export const widgetConnectionsRelations = relations(widgetConnections, ({ one }) => ({
  widgetInstance: one(appWidgetInstances, {
    fields: [widgetConnections.widgetInstanceId],
    references: [appWidgetInstances.id],
  }),
}));

// ── Integration configs (key-value store for integration credentials) ────────

export const integrationConfigs = sqliteTable(
  'integration_configs',
  {
    provider: text('provider').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('integration_configs_pk').on(table.provider, table.key),
  ],
);

// ─── Scheduled Jobs ──────────────────────────────────────────────────────────

export const scheduledJobs = sqliteTable('scheduled_jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  actionType: text('action_type').notNull(),
  actionParams: text('action_params').notNull().default('{}'),
  cronExpression: text('cron_expression').notNull(),
  enabled: integer('enabled').notNull().default(1),
  isSystem: integer('is_system').notNull().default(0),
  lastRunAt: text('last_run_at'),
  lastRunStatus: text('last_run_status'),
  lastRunError: text('last_run_error'),
  disabledReason: text('disabled_reason'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
