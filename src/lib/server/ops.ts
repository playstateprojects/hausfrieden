import { error } from '@sveltejs/kit';
import { and, eq, gt, inArray, lt, max, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { DAY, PERSON_COLORS } from '#lib/constants.ts';
import { ptsFor } from '#lib/logic.ts';
import type { Op } from '#lib/schemas.ts';
import type { DB } from './db/index.ts';
import { events, families, handoffs, logEntries, members, redemptions, rewards, rooms, shoppingItems, tasks, todos } from './db/schema.ts';
import { assertMembers, balancesFor, newId, newInviteCode } from './family.ts';

type Actor = { familyId: string; memberId: string; role: 'admin' | 'member' };

async function getTask(db: DB, familyId: string, id: string) {
	const t = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.familyId, familyId)) });
	if (!t) error(404, 'Task not found');
	return t;
}

async function assertRoom(db: DB, familyId: string, roomId: string) {
	const r = await db.query.rooms.findFirst({ where: and(eq(rooms.id, roomId), eq(rooms.familyId, familyId)) });
	if (!r) error(400, 'Unknown room');
}

/** Grown-ups earn a fraction of task points (capped), so the kids can win the monthly race. */
function awardPts(raw: number, kind: 'adult' | 'kid' | undefined, fam: { adultRate: number; adultCap: number } | undefined) {
	if (kind !== 'adult' || !fam || fam.adultRate >= 1) return raw;
	return Math.max(1, Math.min(fam.adultCap, Math.round(raw * fam.adultRate)));
}

/** Private to-dos belong to the signed-in member, or to someone without a login who shares this device. */
async function assertTodoOwner(db: DB, actor: Actor, memberId: string) {
	if (memberId === actor.memberId) return;
	const m = await db.query.members.findFirst({ where: and(eq(members.id, memberId), eq(members.familyId, actor.familyId)) });
	if (!m || m.userId) error(403, 'That list is private');
}

/** Applies one validated op to a family. Returns a small JSON-able result. */
export async function applyOp(db: DB, actor: Actor, o: Op): Promise<Record<string, unknown>> {
	const fid = actor.familyId;
	const inFamily = (t: { id: SQLiteColumn; familyId: SQLiteColumn }, id: string) =>
		and(eq(t.id, id), eq(t.familyId, fid));

	switch (o.op) {
		case 'task.save': {
			const t = o.task;
			await assertRoom(db, fid, t.roomId);
			await assertMembers(db, fid, [t.who, ...(t.team ?? []), ...(t.only ?? [])]);
			const fields = {
				name: t.name,
				roomId: t.roomId,
				every: t.every,
				mins: t.mins,
				pts: t.pts,
				who: t.each ? null : t.who,
				team: t.each ? null : t.team?.length ? t.team : null,
				each: t.each,
				only: t.each && t.only?.length ? t.only : null,
				carry: t.days?.length && !t.once ? t.carry : false,
				once: t.once,
				days: !t.once && t.days?.length ? [...t.days].sort() : null,
				routine: t.routine
			};
			const old = t.id ? await getTask(db, fid, t.id) : null;
			let sortOrder = old?.sortOrder ?? 0;
			if (t.routine && (!old || old.routine !== t.routine)) {
				const [row] = await db
					.select({ m: max(tasks.sortOrder) })
					.from(tasks)
					.where(and(eq(tasks.familyId, fid), eq(tasks.routine, t.routine)));
				sortOrder = (row?.m ?? 0) + 1;
			}
			if (old) {
				await db.update(tasks).set({ ...fields, sortOrder }).where(inFamily(tasks, old.id));
				return { id: old.id };
			}
			const id = newId();
			await db.insert(tasks).values({ id, familyId: fid, ...fields, sortOrder, last: 0, lastBy: null, lastFor: {}, createdAt: Date.now() });
			return { id };
		}

		case 'task.delete':
			await db.delete(tasks).where(inFamily(tasks, o.id));
			return {};

		case 'task.complete': {
			const t = await getTask(db, fid, o.id);
			await assertMembers(db, fid, [o.memberId]);
			const now = Date.now();
			const [me, fam] = await Promise.all([
				db.query.members.findFirst({ where: inFamily(members, o.memberId) }),
				db.query.families.findFirst({ where: eq(families.id, fid) })
			]);
			const pts = awardPts(ptsFor(t), me?.kind, fam);
			const update = t.each
				? db
						.update(tasks)
						// atomic per-member update of the JSON map
						.set({ lastFor: sql`json_set(coalesce(${tasks.lastFor}, '{}'), ${'$."' + o.memberId + '"'}, ${now})` })
						.where(inFamily(tasks, t.id))
				: db.update(tasks).set({ last: now, lastBy: o.memberId }).where(inFamily(tasks, t.id));
			await db.batch([
				update,
				db.insert(logEntries).values({ id: o.logId, familyId: fid, taskId: t.id, name: t.name, memberId: o.memberId, at: now, pts })
			]);
			return { pts, at: now };
		}

		case 'task.undo': {
			const t = await getTask(db, fid, o.id);
			const update = o.prev.each
				? db
						.update(tasks)
						.set({ lastFor: sql`json_set(coalesce(${tasks.lastFor}, '{}'), ${'$."' + o.memberId + '"'}, ${o.prev.last})` })
						.where(inFamily(tasks, t.id))
				: db.update(tasks).set({ last: o.prev.last, lastBy: o.prev.lastBy }).where(inFamily(tasks, t.id));
			await db.batch([update, db.delete(logEntries).where(inFamily(logEntries, o.logId))]);
			return {};
		}

		case 'log.add':
			await assertMembers(db, fid, [o.memberId]);
			// ids like ring_<member>_<day> are deterministic so several open devices can't double-award
			await db
				.insert(logEntries)
				.values({
					id: o.id,
					familyId: fid,
					taskId: null,
					name: o.name,
					memberId: o.memberId,
					at: o.at ?? Date.now(),
					pts: o.pts,
					alarmKey: o.alarmKey ?? null,
					medKey: o.medKey ?? null,
					slotAt: o.slotAt ?? null,
					fixed: o.fixed ?? false
				})
				.onConflictDoNothing();
			return {};

		case 'task.tick': {
			const t = await getTask(db, fid, o.id);
			await assertMembers(db, fid, [o.memberId]);
			const [actorRow, fam, target] = await Promise.all([
				db.query.members.findFirst({ where: inFamily(members, actor.memberId) }),
				db.query.families.findFirst({ where: eq(families.id, fid) }),
				db.query.members.findFirst({ where: inFamily(members, o.memberId) })
			]);
			if (actorRow?.kind !== 'adult') error(403, 'Only grown-ups can tick things off for an earlier day');
			if (o.at > Date.now()) error(400, 'That day hasn’t happened yet');
			const pts = awardPts(ptsFor(t), target?.kind, fam);
			const path = '$."' + o.memberId + '"';
			const update = t.each
				? db
						.update(tasks)
						.set({ lastFor: sql`json_set(coalesce(${tasks.lastFor}, '{}'), ${path}, ${o.at})` })
						.where(and(inFamily(tasks, t.id), sql`coalesce(json_extract(${tasks.lastFor}, ${path}), 0) < ${o.at}`))
				: db
						.update(tasks)
						.set({ last: o.at, lastBy: o.memberId })
						.where(and(inFamily(tasks, t.id), lt(tasks.last, o.at)));
			await db.batch([
				update,
				db.insert(logEntries).values({ id: o.logId, familyId: fid, taskId: t.id, name: t.name, memberId: o.memberId, at: o.at, pts, fixed: true })
			]);
			return { pts };
		}

		case 'log.delete':
			await db.delete(logEntries).where(inFamily(logEntries, o.id));
			return {};

		case 'reward.save': {
			const r = o.reward;
			if (r.id) {
				const res = await db.update(rewards).set({ emoji: r.emoji, name: r.name, cost: r.cost }).where(inFamily(rewards, r.id)).returning({ id: rewards.id });
				if (!res.length) error(404, 'Treat not found');
				return { id: r.id };
			}
			const id = newId();
			await db.insert(rewards).values({ id, familyId: fid, emoji: r.emoji, name: r.name, cost: r.cost });
			return { id };
		}

		case 'reward.delete':
			await db.delete(rewards).where(inFamily(rewards, o.id));
			return {};

		case 'reward.redeem': {
			const r = await db.query.rewards.findFirst({ where: inFamily(rewards, o.rewardId) });
			if (!r) error(404, 'Treat not found');
			await assertMembers(db, fid, [o.memberId]);
			const bal = (await balancesFor(db, fid))[o.memberId] || 0;
			if (bal < r.cost) error(400, 'Not enough points');
			await db.insert(redemptions).values({ id: o.id, familyId: fid, memberId: o.memberId, name: r.name, emoji: r.emoji, cost: r.cost, at: Date.now() });
			return {};
		}

		case 'redemption.delete':
			await db.delete(redemptions).where(inFamily(redemptions, o.id));
			return {};

		case 'members.save': {
			const existing = await db.select().from(members).where(eq(members.familyId, fid));
			const byId = new Map(existing.map((m) => [m.id, m]));
			for (const m of o.members) if (m.id && !byId.has(m.id)) error(400, 'Unknown family member');
			const keep = o.members.map((m) => m.id).filter((x): x is string => !!x);
			const removed = existing.filter((m) => !keep.includes(m.id));
			if (removed.some((m) => m.userId)) error(400, 'People with their own login can’t be removed here');
			const now = Date.now();
			const stmts = o.members.map((m, i) =>
				m.id
					? db.update(members).set({ name: m.name, emoji: m.emoji, color: m.color, kind: m.kind, sort: i }).where(inFamily(members, m.id))
					: db.insert(members).values({ id: newId(), familyId: fid, userId: null, name: m.name, emoji: m.emoji, color: m.color || PERSON_COLORS[i % PERSON_COLORS.length], role: 'member', kind: m.kind, sort: i, createdAt: now })
			);
			if (removed.length) stmts.push(db.delete(members).where(and(eq(members.familyId, fid), inArray(members.id, removed.map((m) => m.id)))) as never);
			await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);
			return {};
		}

		case 'rooms.save': {
			const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.familyId, fid));
			const ids = new Set(existing.map((r) => r.id));
			for (const r of o.rooms) if (r.id && !ids.has(r.id)) error(400, 'Unknown room');
			const keep = o.rooms.map((r) => r.id).filter((x): x is string => !!x);
			const removed = existing.filter((r) => !keep.includes(r.id)).map((r) => r.id);
			if (removed.length) {
				const used = await db
					.select({ id: tasks.id })
					.from(tasks)
					.where(and(eq(tasks.familyId, fid), inArray(tasks.roomId, removed)))
					.limit(1);
				if (used.length) error(400, 'Rooms with tasks can’t be removed until their tasks are deleted');
			}
			const stmts = o.rooms.map((r, i) =>
				r.id
					? db.update(rooms).set({ name: r.name, emoji: r.emoji, color: r.color, sort: i }).where(inFamily(rooms, r.id))
					: db.insert(rooms).values({ id: newId(), familyId: fid, key: r.key ?? null, name: r.name, emoji: r.emoji, color: r.color, sort: i })
			);
			if (removed.length) stmts.push(db.delete(rooms).where(and(eq(rooms.familyId, fid), inArray(rooms.id, removed))) as never);
			if (stmts.length) await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);
			return {};
		}

		case 'member.profile':
			await db.update(members).set({ name: o.name, emoji: o.emoji, color: o.color }).where(inFamily(members, o.id));
			return {};

		case 'routine.reorder': {
			const found = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.familyId, fid), inArray(tasks.id, o.ids)));
			if (found.length !== o.ids.length) error(400, 'Unknown task');
			await db.batch(o.ids.map((tid, i) => db.update(tasks).set({ sortOrder: i + 1 }).where(inFamily(tasks, tid))) as never);
			return {};
		}

		case 'goals.save': {
			const { op: _op, ...fields } = o;
			await db.update(families).set(fields).where(eq(families.id, fid));
			return {};
		}

		case 'alarms.save':
			await assertMembers(db, fid, o.alarms.flatMap((a) => (a.who === 'all' ? [] : a.who)));
			await db.update(families).set({ alarms: o.alarms, extendCost: o.extendCost, extendMax: o.extendMax }).where(eq(families.id, fid));
			return {};

		case 'meds.save':
			await assertMembers(db, fid, o.meds.map((m) => m.who));
			await db.update(families).set({ meds: o.meds }).where(eq(families.id, fid));
			return {};

		case 'alarm.extend': {
			const fam = await db.query.families.findFirst({ where: eq(families.id, fid) });
			if (!fam) error(404, 'Family not found');
			await assertMembers(db, fid, [o.memberId]);
			if (((await balancesFor(db, fid))[o.memberId] || 0) < fam.extendCost) error(400, 'Not enough points');
			await db.insert(redemptions).values({
				id: o.id,
				familyId: fid,
				memberId: o.memberId,
				name: '10 more minutes',
				emoji: '⏰',
				cost: fam.extendCost,
				at: Date.now(),
				ext: true,
				alarmId: o.alarmId
			});
			return {};
		}

		case 'event.save': {
			const e = o.event;
			await assertMembers(db, fid, e.who === 'all' ? [] : e.who);
			const existing = await db.query.events.findFirst({ where: eq(events.id, e.id) });
			if (existing && existing.familyId !== fid) error(400, 'Unknown event');
			const fields = {
				kind: e.kind,
				title: e.title,
				date: e.date,
				time: e.time,
				who: e.who === 'all' || !e.who.length ? ('all' as const) : e.who,
				note: e.note,
				prep: e.repeat?.length ? 0 : e.prep,
				repeat: e.repeat?.length ? [...e.repeat].sort() : null,
				until: e.until
			};
			const stmts = [
				existing
					? db.update(events).set(fields).where(inFamily(events, e.id))
					: db.insert(events).values({ id: e.id, familyId: fid, ...fields, createdAt: Date.now() })
			];
			// a test with revision reminders gets a daily "Revise: …" homework task until the day
			const prepId = 'prep-' + e.id;
			if (e.kind === 'test' && fields.prep > 0 && !fields.repeat && o.prep) {
				const room =
					(await db.query.rooms.findFirst({ where: and(eq(rooms.familyId, fid), eq(rooms.key, 'homework')) })) ??
					(await db.query.rooms.findFirst({ where: eq(rooms.familyId, fid), orderBy: rooms.sort }));
				if (room) {
					const list = fields.who === 'all' ? null : fields.who;
					const single = list?.length === 1;
					const taskFields = {
						name: '📚 Revise: ' + e.title,
						roomId: room.id,
						every: 1,
						mins: 20,
						pts: 20,
						who: single ? list![0] : null,
						team: null,
						each: !single,
						only: single ? null : list,
						days: null,
						carry: false,
						once: false,
						routine: null,
						activeFrom: o.prep.from,
						activeUntil: o.prep.until,
						prepFor: e.id
					};
					const old = await db.query.tasks.findFirst({ where: inFamily(tasks, prepId) });
					stmts.push(
						(old
							? db.update(tasks).set(taskFields).where(inFamily(tasks, prepId))
							: db.insert(tasks).values({ id: prepId, familyId: fid, ...taskFields, sortOrder: 0, last: 0, lastBy: null, lastFor: {}, createdAt: Date.now() })) as never
					);
				}
			} else stmts.push(db.delete(tasks).where(inFamily(tasks, prepId)) as never);
			await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);
			return {};
		}

		case 'event.delete':
			await db.batch([db.delete(events).where(inFamily(events, o.id)), db.delete(tasks).where(inFamily(tasks, 'prep-' + o.id))]);
			return {};

		case 'shop.add': {
			await assertMembers(db, fid, [o.memberId]);
			await db.insert(shoppingItems).values(
				o.items.map((i) => ({ id: i.id, familyId: fid, text: i.text, aisle: i.aisle || 'other', memberId: o.memberId, createdAt: i.created, done: 0, cleared: 0 }))
			);
			return {};
		}

		case 'shop.set':
			await db.update(shoppingItems).set({ done: o.done, doneBy: o.done ? o.doneBy : null }).where(inFamily(shoppingItems, o.id));
			return {};

		case 'shop.delete':
			await db.delete(shoppingItems).where(inFamily(shoppingItems, o.id));
			return {};

		case 'shop.clear': {
			const now = Date.now();
			await db.batch([
				db.update(shoppingItems).set({ cleared: now }).where(and(eq(shoppingItems.familyId, fid), gt(shoppingItems.done, 0), eq(shoppingItems.cleared, 0))),
				db.delete(shoppingItems).where(and(eq(shoppingItems.familyId, fid), gt(shoppingItems.cleared, 0), lt(shoppingItems.cleared, now - 30 * DAY)))
			]);
			return {};
		}

		case 'handoff.add':
			await assertMembers(db, fid, [o.fromId, o.toId]);
			await db.insert(handoffs).values({ id: o.id, familyId: fid, fromId: o.fromId, toId: o.toId, text: o.text, cat: o.cat, done: 0, createdAt: o.created });
			return {};

		case 'handoff.set': {
			await db.batch([
				db.update(handoffs).set({ done: o.done }).where(inFamily(handoffs, o.id)),
				db.delete(handoffs).where(and(eq(handoffs.familyId, fid), gt(handoffs.done, 0), lt(handoffs.done, Date.now() - 7 * DAY)))
			]);
			return {};
		}

		case 'handoff.delete':
			await db.delete(handoffs).where(inFamily(handoffs, o.id));
			return {};

		case 'todo.save': {
			const t = o.todo;
			const existing = await db.query.todos.findFirst({ where: eq(todos.id, t.id) });
			if (existing && existing.familyId !== fid) error(400, 'Unknown task');
			if (existing) await assertTodoOwner(db, actor, existing.memberId);
			await assertTodoOwner(db, actor, t.memberId);
			const fields = { memberId: t.memberId, text: t.text, cat: t.cat, star: t.star, done: t.done };
			await db.batch([
				existing
					? db.update(todos).set(fields).where(inFamily(todos, t.id))
					: db.insert(todos).values({ id: t.id, familyId: fid, ...fields, createdAt: t.created }),
				// finished items roll off after a week
				db.delete(todos).where(and(eq(todos.familyId, fid), eq(todos.memberId, t.memberId), gt(todos.done, 0), lt(todos.done, Date.now() - 8 * DAY)))
			]);
			return {};
		}

		case 'todo.delete': {
			const existing = await db.query.todos.findFirst({ where: inFamily(todos, o.id) });
			if (!existing) return {};
			await assertTodoOwner(db, actor, existing.memberId);
			await db.delete(todos).where(inFamily(todos, o.id));
			return {};
		}

		case 'family.rename':
			await db.update(families).set({ name: o.name }).where(eq(families.id, fid));
			return {};

		case 'invite.rotate': {
			if (actor.role !== 'admin') error(403, 'Only admins can reset the invite code');
			const code = newInviteCode();
			await db.update(families).set({ inviteCode: code }).where(eq(families.id, fid));
			return { inviteCode: code };
		}
	}
}

