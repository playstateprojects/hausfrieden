import { z } from 'zod';

// Shared by client and server. The server validates every request with these.

export const id = z.string().min(1).max(64);
export const name = z.string().trim().min(1, 'Required').max(120);
export const emoji = z.string().trim().min(1).max(16);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const memberIds = z.array(id).max(30);

export const taskInput = z.object({
	id: id.optional(),
	name,
	roomId: id,
	every: z.number().int().min(1).max(365),
	mins: z.number().int().min(1).max(240),
	pts: z.number().int().min(1).max(1000).nullable(),
	who: id.nullable(),
	team: memberIds.nullable(),
	each: z.boolean(),
	only: memberIds.nullable(),
	days: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
	carry: z.boolean(),
	once: z.boolean().default(false),
	routine: z.enum(['morning', 'afternoon', 'evening']).nullable()
});
export type TaskInput = z.infer<typeof taskInput>;

export const rewardInput = z.object({
	id: id.optional(),
	emoji,
	name,
	cost: z.number().int().min(5).max(100_000)
});

export const memberInput = z.object({ id: id.optional(), name, emoji, color, kind: z.enum(['adult', 'kid']).default('kid') });

const hhmm = z.string().regex(/^\d\d:\d\d$/);
const weekdays = z.array(z.number().int().min(0).max(6)).max(7);
export const alarmInput = z.object({
	id,
	emoji,
	label: z.string().trim().min(1).max(60),
	note: z.string().trim().max(120),
	time: hhmm,
	days: weekdays,
	who: z.union([z.literal('all'), memberIds]),
	pts: z.number().int().min(0).max(50),
	extend: z.boolean(),
	on: z.boolean()
});
export const medInput = z.object({
	id,
	created: z.number().int().min(0),
	who: id,
	label: z.string().trim().min(1).max(60),
	note: z.string().trim().max(120),
	times: z.array(hhmm).min(1).max(12),
	days: weekdays,
	on: z.boolean()
});
export const roomInput = z.object({ id: id.optional(), key: z.string().max(32).nullable().optional(), name, emoji, color });

/** Every mutation against a family goes through one endpoint as one of these ops. */
export const op = z.discriminatedUnion('op', [
	z.object({ op: z.literal('task.save'), task: taskInput }),
	z.object({ op: z.literal('task.delete'), id }),
	z.object({ op: z.literal('task.complete'), id, memberId: id, logId: id }),
	z.object({
		op: z.literal('task.undo'),
		id,
		memberId: id,
		logId: id,
		prev: z.discriminatedUnion('each', [
			z.object({ each: z.literal(true), last: z.number().int().min(0) }),
			z.object({ each: z.literal(false), last: z.number().int().min(0), lastBy: id.nullable() })
		])
	}),
	z.object({
		op: z.literal('log.add'),
		id,
		memberId: id,
		name,
		pts: z.number().int().min(0).max(500),
		at: z.number().int().optional(),
		alarmKey: z.string().max(200).optional(),
		medKey: z.string().max(200).optional(),
		slotAt: z.number().int().optional()
	}),
	z.object({ op: z.literal('log.delete'), id }),
	z.object({ op: z.literal('reward.save'), reward: rewardInput }),
	z.object({ op: z.literal('reward.delete'), id }),
	z.object({ op: z.literal('reward.redeem'), id, rewardId: id, memberId: id }),
	z.object({ op: z.literal('redemption.delete'), id }),
	z.object({ op: z.literal('members.save'), members: z.array(memberInput).min(1).max(30) }),
	z.object({ op: z.literal('rooms.save'), rooms: z.array(roomInput).max(50) }),
	z.object({ op: z.literal('member.profile'), id, name, emoji, color }),
	z.object({ op: z.literal('routine.reorder'), ids: z.array(id).min(1).max(100) }),
	z.object({
		op: z.literal('goals.save'),
		goal: z.number().int().min(0).max(100_000),
		goalReward: z.string().trim().max(120),
		monthGoal: z.number().int().min(0).max(1_000_000),
		monthGoalReward: z.string().trim().max(120),
		monthPrize: z.string().trim().max(120),
		adultRate: z.number().min(0.1).max(1),
		budget: z.enum(['free', 'low', 'mid', 'splurge'])
	}),
	z.object({
		op: z.literal('alarms.save'),
		alarms: z.array(alarmInput).max(30),
		extendCost: z.number().int().min(0).max(1000),
		extendMax: z.number().int().min(1).max(10)
	}),
	z.object({ op: z.literal('meds.save'), meds: z.array(medInput).max(40) }),
	z.object({ op: z.literal('alarm.extend'), id, memberId: id, alarmId: id }),
	z.object({ op: z.literal('family.rename'), name }),
	z.object({ op: z.literal('invite.rotate') })
]);
export type Op = z.infer<typeof op>;

export const createFamily = z.object({
	name,
	members: z.array(z.object({ name, emoji, kind: z.enum(['adult', 'kid']).default('kid') })).min(1).max(30),
	/** Index in `members` of the person creating the family. */
	meIndex: z.number().int().min(0),
	starter: z.boolean(),
	/** Client's Date#getTimezoneOffset(), so the starter plan staggers by local day. */
	tzOffset: z.number().int().min(-900).max(900).default(0)
});
export type CreateFamily = z.infer<typeof createFamily>;

export const joinFamily = z.object({
	/** Claim an existing household member (e.g. one the creator already added), or add yourself. */
	memberId: id.optional(),
	name: name.optional(),
	emoji: emoji.optional()
});

export const signUp = z.object({
	name,
	email: z.email(),
	password: z.string().min(8, 'At least 8 characters').max(128)
});
export const signIn = z.object({
	email: z.email(),
	password: z.string().min(1, 'Required')
});
