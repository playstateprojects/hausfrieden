import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { HISTORY_DAYS, DAY, PERSON_COLORS } from '#lib/constants.ts';
import type { CreateFamily, JoinFamily } from '#lib/schemas.ts';
import { BASIC_ROOMS, starterPlan } from '#lib/starter.ts';
import type { FamilyState } from '#lib/types.ts';
import type { DB } from './db/index.ts';
import { events, families, handoffs, logEntries, members, redemptions, rewards, rooms, shoppingItems, tasks, todos } from './db/schema.ts';

export const newId = (): string => crypto.randomUUID();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode(len = 8) {
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Families the user belongs to (via a linked member). */
export async function familiesForUser(db: DB, userId: string) {
	return db
		.select({ id: families.id, name: families.name, memberId: members.id })
		.from(members)
		.innerJoin(families, eq(families.id, members.familyId))
		.where(eq(members.userId, userId))
		.orderBy(asc(families.createdAt));
}

/** Throws 403 unless the user has a member in this family. Returns that member. */
export async function requireMembership(db: DB, familyId: string, userId: string) {
	const m = await db.query.members.findFirst({
		where: and(eq(members.familyId, familyId), eq(members.userId, userId))
	});
	if (!m) error(403, 'Not a member of this family');
	return m;
}

/** Throws 400 unless every given member id belongs to the family. */
export async function assertMembers(db: DB, familyId: string, ids: (string | null | undefined)[]) {
	const wanted = [...new Set(ids.filter((x): x is string => !!x))];
	if (!wanted.length) return;
	const found = await db
		.select({ id: members.id })
		.from(members)
		.where(and(eq(members.familyId, familyId), inArray(members.id, wanted)));
	if (found.length !== wanted.length) error(400, 'Unknown family member');
}

export async function balancesFor(db: DB, familyId: string) {
	const [earned, spent] = await Promise.all([
		db
			.select({ memberId: logEntries.memberId, total: sql<number>`coalesce(sum(${logEntries.pts}), 0)` })
			.from(logEntries)
			.where(eq(logEntries.familyId, familyId))
			.groupBy(logEntries.memberId),
		db
			.select({ memberId: redemptions.memberId, total: sql<number>`coalesce(sum(${redemptions.cost}), 0)` })
			.from(redemptions)
			.where(eq(redemptions.familyId, familyId))
			.groupBy(redemptions.memberId)
	]);
	const out: Record<string, number> = {};
	for (const e of earned) out[e.memberId] = (out[e.memberId] || 0) + Number(e.total);
	for (const s of spent) out[s.memberId] = (out[s.memberId] || 0) - Number(s.total);
	return out;
}

export async function loadFamilyState(db: DB, familyId: string, myMemberId: string): Promise<FamilyState> {
	const since = Date.now() - HISTORY_DAYS * DAY;
	const [family, mem, rms, tks, log, rws, red, balances, evs, shop, hand, allTodos] = await Promise.all([
		db.query.families.findFirst({ where: eq(families.id, familyId) }),
		db.select().from(members).where(eq(members.familyId, familyId)).orderBy(asc(members.sort), asc(members.createdAt)),
		db.select().from(rooms).where(eq(rooms.familyId, familyId)).orderBy(asc(rooms.sort)),
		db.select().from(tasks).where(eq(tasks.familyId, familyId)),
		db
			.select()
			.from(logEntries)
			.where(and(eq(logEntries.familyId, familyId), gte(logEntries.at, since)))
			.orderBy(desc(logEntries.at))
			.limit(1000),
		db.select().from(rewards).where(eq(rewards.familyId, familyId)),
		db
			.select()
			.from(redemptions)
			.where(and(eq(redemptions.familyId, familyId), gte(redemptions.at, since)))
			.orderBy(desc(redemptions.at))
			.limit(1000),
		balancesFor(db, familyId),
		db.select().from(events).where(eq(events.familyId, familyId)),
		// cleared items stay a month so they can be offered as "add again"
		db
			.select()
			.from(shoppingItems)
			.where(and(eq(shoppingItems.familyId, familyId), or(eq(shoppingItems.cleared, 0), gt(shoppingItems.cleared, Date.now() - 30 * DAY)))),
		db
			.select()
			.from(handoffs)
			.where(and(eq(handoffs.familyId, familyId), or(eq(handoffs.done, 0), gt(handoffs.done, Date.now() - 7 * DAY)))),
		db
			.select()
			.from(todos)
			.where(and(eq(todos.familyId, familyId), or(eq(todos.done, 0), gt(todos.done, Date.now() - 8 * DAY))))
	]);
	if (!family) error(404, 'Family not found');
	const strip = <T extends { familyId: string }>({ familyId: _f, ...rest }: T) => rest;
	return {
		family: {
			id: family.id,
			name: family.name,
			inviteCode: family.inviteCode,
			goal: family.goal,
			goalReward: family.goalReward,
			monthGoal: family.monthGoal,
			monthGoalReward: family.monthGoalReward,
			monthPrize: family.monthPrize,
			adultRate: family.adultRate,
			adultCap: family.adultCap,
			budget: family.budget,
			champStart: family.champStart,
			extendCost: family.extendCost,
			extendMax: family.extendMax,
			alarms: family.alarms,
			meds: family.meds
		},
		members: mem.map(({ familyId: _f, createdAt: _c, ...m }) => m),
		rooms: rms.map(strip),
		tasks: tks.map(strip),
		log: log.map(strip),
		rewards: rws.map(strip),
		redemptions: red.map(strip),
		events: evs.map(({ familyId: _f, ...e }) => e),
		shopping: shop.map(({ familyId: _f, ...x }) => x),
		handoffs: hand.map(({ familyId: _f, ...x }) => x),
		// private: yours, plus people who share a device because they have no login
		todos: allTodos
			.filter((t) => t.memberId === myMemberId || mem.find((m) => m.id === t.memberId)?.userId === null)
			.map(({ familyId: _f, ...x }) => x),
		balances,
		myMemberId
	};
}

/** Creates a family, its members (the creator linked to their login), and optionally the starter plan. */
export async function createFamily(db: DB, userId: string, input: CreateFamily) {
	const now = Date.now();
	const familyId = newId();
	const memberRows = input.members.map((p, i) => ({
		id: newId(),
		familyId,
		userId: i === input.meIndex ? userId : null,
		name: p.name,
		emoji: p.emoji,
		color: PERSON_COLORS[i % PERSON_COLORS.length],
		role: i === input.meIndex ? ('admin' as const) : ('member' as const),
		kind: p.kind,
		sort: i,
		createdAt: now
	}));
	if (input.meIndex >= memberRows.length) error(400, 'meIndex out of range');

	// start of the creator's local day, from their timezone offset
	const local = now - input.tzOffset * 60_000;
	const startOfDay = local - (local % DAY) + input.tzOffset * 60_000;

	const plan = input.starter
		? starterPlan(input.members, now, startOfDay)
		: { rooms: BASIC_ROOMS, tasks: [], rewards: [] };

	const roomIds = new Map(plan.rooms.map((r) => [r.key, newId()]));
	const idx = (i: number | null) => (i === null ? null : (memberRows[i]?.id ?? null));

	const statements = [
		db.insert(families).values({
			id: familyId,
			name: input.name,
			inviteCode: newInviteCode(),
			goal: input.starter ? 500 : 0,
			goalReward: 'Pizza & film night',
			monthGoal: input.starter ? 2000 : 0,
			monthGoalReward: 'Family day out',
			monthPrize: 'Choose where we go for family dinner',
			// the first monthly race starts on the 1st of next month
			champStart: nextMonthStart(startOfDay),
			createdAt: now
		}),
		// D1 allows max 100 bound parameters per statement, hence the chunking
		...chunk(memberRows, 10).map((batch) => db.insert(members).values(batch)),
		db.insert(rooms).values(
			plan.rooms.map((r, i) => ({ id: roomIds.get(r.key)!, familyId, key: r.key, name: r.name, emoji: r.emoji, color: r.color, sort: i }))
		),
		...chunk(plan.tasks, 4).map((batch) =>
			db.insert(tasks).values(
				batch.map((t) => ({
					id: newId(),
					familyId,
					roomId: roomIds.get(t.roomKey)!,
					name: t.name,
					every: t.every,
					mins: t.mins,
					pts: t.pts,
					who: idx(t.who),
					team: t.team ? t.team.map(idx).filter((x): x is string => !!x) : null,
					each: t.each,
					only: t.only ? t.only.map(idx).filter((x): x is string => !!x) : null,
					days: t.days,
					carry: t.carry,
					once: false,
					routine: t.routine,
					sortOrder: t.sortOrder,
					last: t.last,
					lastBy: null,
					lastFor: {},
					createdAt: now
				}))
			)
		),
		...(plan.rewards.length
			? [db.insert(rewards).values(plan.rewards.map((r) => ({ id: newId(), familyId, ...r })))]
			: [])
	];
	// D1 batch runs atomically
	await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
	return familyId;
}

/** Members in a family that aren't linked to a login yet (claimable when joining). */
export async function unlinkedMembers(db: DB, familyId: string) {
	return db
		.select({ id: members.id, name: members.name, emoji: members.emoji, color: members.color })
		.from(members)
		.where(and(eq(members.familyId, familyId), isNull(members.userId)))
		.orderBy(asc(members.sort));
}

function nextMonthStart(ms: number) {
	const d = new Date(ms);
	return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function chunk<T>(arr: T[], n: number) {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
	return out;
}

/** Looks a family up by invite code, or throws 404. */
export async function familyByCode(db: DB, code: string) {
	const family = await db.query.families.findFirst({ where: eq(families.inviteCode, code.toUpperCase()) });
	if (!family) error(404, 'That invite code doesn’t match a family. Ask for a fresh link.');
	return family;
}

/** Links the user to a family: claims an unlinked member, or adds them as a new grown-up. */
export async function joinFamily(db: DB, familyId: string, userId: string, input: JoinFamily) {
	if (input.memberId) {
		// claim an existing household member that has no login yet
		const res = await db
			.update(members)
			.set({ userId })
			.where(and(eq(members.id, input.memberId), eq(members.familyId, familyId), isNull(members.userId)))
			.returning({ id: members.id });
		if (!res.length) error(400, 'Someone already claimed that person. Pick another or add yourself.');
		return;
	}
	if (!input.name) error(400, 'Tell us your name');
	const existing = await db.select({ id: members.id }).from(members).where(eq(members.familyId, familyId));
	await db.insert(members).values({
		id: newId(),
		familyId,
		userId,
		name: input.name,
		emoji: input.emoji || '🙂',
		color: PERSON_COLORS[existing.length % PERSON_COLORS.length],
		role: 'member',
		// people with their own login are grown-ups; edit under Household if not
		kind: 'adult',
		sort: existing.length,
		createdAt: Date.now()
	});
}
