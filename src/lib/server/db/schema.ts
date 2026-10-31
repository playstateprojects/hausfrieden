import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* ------------------------------------------------------------------ */
/* better-auth core tables (field names must match better-auth's model) */
/* ------------------------------------------------------------------ */

const authTimestamps = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
};

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	...authTimestamps
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		...authTimestamps
	},
	(t) => [index('session_user_idx').on(t.userId)]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		...authTimestamps
	},
	(t) => [index('account_user_idx').on(t.userId)]
);

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	...authTimestamps
});

/* ------------------------------------------------------------------ */
/* Hausfrieden                                                          */
/* ------------------------------------------------------------------ */
// Timestamps for app data are plain epoch milliseconds (numbers), which is
// what the scheduling logic works in.

/** A household. Many families can use the same deployment. */
export const families = sqliteTable('families', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Share this code (or /join/<code>) to let someone join the family. */
	inviteCode: text('invite_code').notNull().unique(),
	goal: integer('goal').notNull().default(0),
	goalReward: text('goal_reward').notNull().default(''),
	createdAt: integer('created_at').notNull()
});

/**
 * A person in a household. `userId` links a member to a login; members without one
 * (e.g. younger kids) are picked from the "who's using this phone?" screen.
 */
export const members = sqliteTable(
	'members',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		emoji: text('emoji').notNull(),
		color: text('color').notNull(),
		role: text('role', { enum: ['admin', 'member'] })
			.notNull()
			.default('member'),
		sort: integer('sort').notNull().default(0),
		createdAt: integer('created_at').notNull()
	},
	(t) => [
		index('members_family_idx').on(t.familyId),
		uniqueIndex('members_family_user_uq').on(t.familyId, t.userId)
	]
);

export const rooms = sqliteTable(
	'rooms',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		/** Optional well-known key, e.g. 'homework' gets its own section on Today. */
		key: text('key'),
		name: text('name').notNull(),
		emoji: text('emoji').notNull(),
		color: text('color').notNull(),
		sort: integer('sort').notNull().default(0)
	},
	(t) => [index('rooms_family_idx').on(t.familyId)]
);

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		roomId: text('room_id').notNull(),
		name: text('name').notNull(),
		/** Repeat interval in days (ignored when `days` is set). */
		every: integer('every').notNull().default(7),
		mins: integer('mins').notNull().default(5),
		/** Fixed points; null means auto (5 + mins). */
		pts: integer('pts'),
		/** Single assignee member id; null means anyone. */
		who: text('who'),
		/** Several possible assignees — whoever does it first. */
		team: text('team', { mode: 'json' }).$type<string[] | null>(),
		/** Everyone ticks off their own copy. */
		each: integer('each', { mode: 'boolean' }).notNull().default(false),
		/** With `each`, limit to these members. */
		only: text('only', { mode: 'json' }).$type<string[] | null>(),
		/** Fixed weekdays (0 = Sunday). */
		days: text('days', { mode: 'json' }).$type<number[] | null>(),
		/** Day-scheduled task stays due until done. */
		carry: integer('carry', { mode: 'boolean' }).notNull().default(false),
		routine: text('routine', { enum: ['morning', 'evening'] }),
		sortOrder: integer('sort_order').notNull().default(0),
		last: integer('last').notNull().default(0),
		lastBy: text('last_by'),
		/** With `each`: memberId -> last completion. */
		lastFor: text('last_for', { mode: 'json' })
			.$type<Record<string, number>>()
			.notNull()
			.default(sql`'{}'`),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('tasks_family_idx').on(t.familyId)]
);

/** Completed tasks and bonus points. */
export const logEntries = sqliteTable(
	'log_entries',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		taskId: text('task_id'),
		name: text('name').notNull(),
		memberId: text('member_id').notNull(),
		at: integer('at').notNull(),
		pts: integer('pts').notNull()
	},
	(t) => [index('log_family_at_idx').on(t.familyId, t.at)]
);

/** The treat shop. */
export const rewards = sqliteTable(
	'rewards',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		emoji: text('emoji').notNull(),
		name: text('name').notNull(),
		cost: integer('cost').notNull()
	},
	(t) => [index('rewards_family_idx').on(t.familyId)]
);

/** Treats someone has spent points on. */
export const redemptions = sqliteTable(
	'redemptions',
	{
		id: text('id').primaryKey(),
		familyId: text('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		memberId: text('member_id').notNull(),
		name: text('name').notNull(),
		emoji: text('emoji').notNull(),
		cost: integer('cost').notNull(),
		at: integer('at').notNull()
	},
	(t) => [index('redemptions_family_at_idx').on(t.familyId, t.at)]
);
