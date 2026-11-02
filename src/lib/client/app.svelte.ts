import { goto } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { CHEERS, DAY, MILESTONES, RING_BONUS, ROUTINE_BONUS, ROUTINES, WD, type RoutineKey } from '#lib/constants.ts';
import { addDays, House, ptsFor, ymd, type MedSlot, type Scope } from '#lib/logic.ts';
import { aisleInfo, aisleOf, AISLE_ORDER } from '#lib/shop.ts';
import type { Op } from '#lib/schemas.ts';
import type { FamilyEvent, FamilyState, SessionUser, Todo, TodoCat } from '#lib/types.ts';
import { api } from './api.ts';
import { burst, chime, pop, unlockAudio } from './fx.ts';

export type View = 'today' | 'rooms' | 'focus' | 'treats' | 'list' | 'family';
export type Sheet =
	| { kind: 'task'; id: string | null; roomId?: string | null }
	| { kind: 'reward'; id: string | null }
	| { kind: 'redeem'; id: string }
	| { kind: 'bonus' }
	| { kind: 'people' }
	| { kind: 'rooms' }
	| { kind: 'goal' }
	| { kind: 'home' }
	| { kind: 'profile'; id: string }
	| { kind: 'reorder'; key: RoutineKey }
	| { kind: 'alarms' }
	| { kind: 'meds' }
	| { kind: 'medlog' }
	| { kind: 'event'; id: string | null; day?: number }
	| { kind: 'todo'; id: string };

/** What the server sends for the active family (see GET /api/bootstrap). */
export type AppData = { state: FamilyState; families: { id: string; name: string }[]; user: SessionUser };

type Undo = {
	taskId: string;
	logId: string;
	memberId: string;
	prev: { each: true; last: number } | { each: false; last: number; lastBy: string | null };
};

export const lsGet = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};
export const lsSet = (k: string, v: string) => {
	try {
		localStorage.setItem(k, v);
	} catch {
		/* private mode */
	}
};
export const uid = () => crypto.randomUUID();
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Client state for one family: server data (with optimistic edits) plus UI state. */
export class AppState {
	s: FamilyState = $state()!;
	families: { id: string; name: string }[] = $state([]);
	user: { id: string; name: string; email: string } = $state()!;

	now = $state(Date.now());
	/** Who is using this device right now (a member id), or null to show the picker. */
	me: string | null = $state(null);
	view: View = $state('today');
	scope: Scope = $state('me');
	time: number | null = $state(null);
	room: string | null = $state(null);
	one = $state(0);
	oneOpen = $state(false);
	guide: RoutineKey | null = $state(null);
	gskip: string[] = $state([]);
	sprint: string[] = $state([]);
	focus = $state({ total: 900, left: 900, running: false, end: 0 });
	/** Day picked in the week strip (local midnight); only counts once `dayPicked`. */
	day: number | null = $state(null);
	dayPicked = $state(false);
	/** Whose list the past-day view shows (defaults to me). */
	dayWho: string | null = $state(null);
	listTab: 'todo' | 'shop' = $state('todo');
	/** Adding to another grown-up's list instead of mine. */
	tdFor: string | null = $state(null);
	listCat: 'all' | TodoCat = $state('all');
	tdCat: TodoCat = $state('work');
	justDone: string | null = $state(null);
	focusTodo: string | null = $state(null);
	sheet: Sheet | null = $state(null);
	toast: { msg: string; btn?: string; act?: () => void; key: number } | null = $state(null);

	house = $derived(new House(this.s, this.me ?? '', this.now));
	/** The day on screen: the picked one, else today. */
	selDay = $derived(this.dayPicked && this.day ? this.day : this.house.startOfDay);

	private undoInfo: Undo | null = null;
	private pending = 0;
	private toastTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(data: AppData) {
		this.replace(data);
		this.scope = lsGet('hf_scope') === 'all' ? 'all' : 'me';
	}

	get familyId() {
		return this.s.family.id;
	}

	/** Called whenever fresh server data arrives. */
	replace(data: AppData) {
		const switched = !this.s || this.s.family.id !== data.state.family.id;
		this.s = data.state;
		this.families = data.families;
		this.user = data.user;
		lsSet('hf_family', data.state.family.id);
		if (switched) {
			const stored = lsGet('hf_me:' + data.state.family.id);
			this.me = stored ?? data.state.myMemberId;
		}
		if (this.me && !this.s.members.some((m) => m.id === this.me)) this.me = this.s.myMemberId;
	}

	get busy() {
		return this.pending > 0;
	}

	pickMe(id: string | null) {
		this.me = id;
		if (id) lsSet('hf_me:' + this.familyId, id);
		this.one = 0;
		this.gskip = [];
	}
	setScope(s: Scope) {
		this.scope = s;
		lsSet('hf_scope', s);
	}
	nav(v: View) {
		this.view = v;
		this.room = null;
		this.oneOpen = false;
		this.guide = null;
		if (v === 'today') {
			this.day = null;
			this.dayPicked = false;
		}
		scrollTo(0, 0);
	}

	goDay(day: number) {
		this.day = day;
		this.dayPicked = day !== this.house.startOfDay;
		this.guide = null;
		this.oneOpen = false;
		if (!this.dayWho || day >= this.house.startOfDay) this.dayWho = this.me;
	}
	shiftWeek(n: number) {
		this.day = addDays(this.selDay, n);
		this.dayPicked = this.day !== this.house.startOfDay;
		this.guide = null;
	}
	/** Jump to yesterday for the first kid, so a grown-up can tick off what got missed. */
	openFix() {
		const kid = this.s.members.find((p) => p.kind !== 'adult');
		this.view = 'today';
		this.day = this.house.dayN(1);
		this.dayPicked = true;
		this.dayWho = (kid ?? this.house.person(this.me))?.id ?? this.me;
		this.guide = null;
		scrollTo(0, 0);
	}

	showToast(msg: string, btn?: string, act?: () => void) {
		this.toast = { msg, btn, act, key: Date.now() };
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => (this.toast = null), btn ? 6000 : 2600);
	}
	hideToast() {
		this.toast = null;
	}

	/** Re-fetches the family (polling, tab focus, after a save). A failed fetch keeps what's on screen. */
	async refresh(familyId = this.familyId) {
		if (this.pending > 0) return;
		try {
			const res = await api(`/api/bootstrap?family=${encodeURIComponent(familyId)}`);
			if (res.status === 401) return void goto('/login');
			if (!res.ok) return;
			const data = (await res.json()) as AppData | { state: null };
			// a save started while we were fetching: its own refresh will follow
			if (this.pending > 0 || !data.state) return;
			this.replace(data as AppData);
		} catch {
			/* offline: keep the current data */
		}
	}

	async switchFamily(id: string) {
		this.sheet = null;
		await this.refresh(id);
	}

	/** Sends one op to the server, then re-syncs. Returns the JSON result, or null on failure. */
	async send<T = Record<string, unknown>>(op: Op): Promise<(T & { ok: true }) | null> {
		this.pending++;
		try {
			const res = await api(`/api/f/${this.familyId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(op)
			});
			const body = (await res.json().catch(() => null)) as (T & { ok: true; message?: string }) | null;
			if (!res.ok) {
				this.showToast(body?.message ?? 'Couldn’t save — check your connection.');
				return null;
			}
			return body;
		} catch {
			this.showToast('Couldn’t save — check your connection.');
			return null;
		} finally {
			this.pending--;
			if (this.pending === 0) await this.refresh();
		}
	}

	/* ---------- actions ---------- */

	async complete(id: string) {
		const me = this.me;
		const t = this.s.tasks.find((x) => x.id === id);
		if (!t || !me) return;
		const now = Date.now();
		this.now = now;
		const h = this.house;
		const logId = uid(),
			pts = h.myPts(t);
		const hadToday = h.didToday(me),
			newStreak = hadToday ? h.streak(me) : h.streak(me) + 1;
		this.undoInfo = {
			taskId: id,
			logId,
			memberId: me,
			prev: t.each ? { each: true, last: t.lastFor?.[me] || 0 } : { each: false, last: t.last || 0, lastBy: t.lastBy }
		};

		// optimistic
		if (t.each) t.lastFor = { ...t.lastFor, [me]: now };
		else {
			t.last = now;
			t.lastBy = me;
		}
		this.s.log.unshift({ id: logId, taskId: id, name: t.name, memberId: me, at: now, pts, alarmKey: null, medKey: null, slotAt: null, fixed: false });
		this.s.balances[me] = (this.s.balances[me] || 0) + pts;
		burst();

		const ops: Op[] = [{ op: 'task.complete', id, memberId: me, logId }];
		const bonus = (name: string, bpts: number, at: number) => {
			const bonusId = uid();
			this.s.log.unshift({ id: bonusId, taskId: null, name, memberId: me, at, pts: bpts, alarmKey: null, medKey: null, slotAt: null, fixed: false });
			this.s.balances[me] += bpts;
			ops.push({ op: 'log.add', id: bonusId, memberId: me, name, pts: bpts, at });
		};
		const finish = async () => {
			this.undoInfo = null;
			await Promise.all(ops.map((o) => this.send(o)));
		};

		const streakName = `🔥 ${newStreak}-day streak!`;
		if (!hadToday && MILESTONES[newStreak] && !this.s.log.some((l) => l.memberId === me && l.name === streakName)) {
			const bpts = h.award(MILESTONES[newStreak], me);
			bonus(streakName, bpts, now + 2);
			setTimeout(() => burst(200), 350);
			this.showToast(`🔥 ${newStreak}-day streak! +${bpts} bonus points`);
			return finish();
		}

		if (t.routine && ROUTINES[t.routine]) {
			const R = ROUTINES[t.routine],
				bonusName = h.routineBonusName(t.routine);
			const steps = h.routineSteps(t.routine);
			const allDone = steps.length > 0 && steps.every((s) => h.doneRecently(s));
			const already = this.s.log.some((l) => l.memberId === me && l.name === bonusName && l.at >= h.startOfDay);
			if (allDone && !already) {
				const bpts = h.award(ROUTINE_BONUS, me);
				bonus(bonusName, bpts, now + 1);
				setTimeout(() => burst(160), 350);
				this.showToast(`${R.emoji} ${R.label} done! +${pts} and +${bpts} bonus`);
				return finish();
			}
		}
		this.showToast(`+${pts} pts · ${CHEERS[Math.floor(Math.random() * CHEERS.length)]}`, 'Undo', () => this.undo());
		await this.send(ops[0]);
	}

	async undo() {
		const u = this.undoInfo;
		if (!u) return;
		this.undoInfo = null;
		this.hideToast();
		const t = this.s.tasks.find((x) => x.id === u.taskId);
		if (t) {
			if (u.prev.each) t.lastFor = { ...t.lastFor, [u.memberId]: u.prev.last };
			else {
				t.last = u.prev.last;
				t.lastBy = u.prev.lastBy;
			}
		}
		const entry = this.s.log.find((l) => l.id === u.logId);
		if (entry) this.s.balances[u.memberId] -= entry.pts;
		this.s.log = this.s.log.filter((l) => l.id !== u.logId);
		await Promise.all([
			this.send({ op: 'task.undo', id: u.taskId, memberId: u.memberId, logId: u.logId, prev: u.prev }),
			this.unRing(this.house.startOfDay)
		]);
	}

	/* ---------- alarms & medicines ---------- */

	async ackAlarm(key: string) {
		const x = this.house.alarmSlots().find((q) => q.key === key);
		if (!x || x.ack) return;
		const h = this.house,
			by = x.t === 'all' ? this.me! : x.t,
			pts = x.a.pts ? h.award(x.a.pts, by) : 0,
			id = uid(),
			at = Date.now(),
			name = `${x.a.emoji || '⏰'} ${x.a.label} ✓`;
		this.s.log.unshift({ id, taskId: null, name, memberId: by, at, pts, alarmKey: key, medKey: null, slotAt: null, fixed: false });
		this.s.balances[by] = (this.s.balances[by] || 0) + pts;
		if (pts) burst(120);
		if (x.a.extend && by === this.me && h.routineSteps('evening').some((s) => !h.doneRecently(s))) {
			this.view = 'today';
			this.guide = 'evening';
			this.gskip = [];
		} else this.showToast(pts ? `+${pts} pts — nicely done` : '👍 Great');
		await this.send({ op: 'log.add', id, memberId: by, name, pts, at, alarmKey: key });
	}

	async extendAlarm(key: string) {
		const x = this.house.alarmSlots().find((q) => q.key === key);
		const { extendCost: cost, extendMax: max } = this.s.family;
		if (!x || x.t === 'all' || x.ext >= max || this.house.balance(x.t) < cost) return;
		this.s.redemptions.unshift({ id: uid(), memberId: x.t, name: '10 more minutes', emoji: '⏰', cost, at: Date.now(), ext: true, alarmId: x.a.id });
		this.s.balances[x.t] -= cost;
		this.showToast(`⏰ 10 more minutes — now ${hhmm(x.at + 6e5)}`);
		await this.send({ op: 'alarm.extend', id: uid(), memberId: x.t, alarmId: x.a.id });
	}

	async medTaken(key: string) {
		const x = this.house.findMedSlot(key);
		if (!x || x.took) return;
		const late = this.house.startOfDay > x.at,
			id = uid(),
			at = Date.now(),
			name = '💊 ' + (x.m.label || 'Medicine') + ' taken' + (late ? ` (${WD[new Date(x.at).getDay()]} ${x.time})` : '');
		this.s.log.unshift({ id, taskId: null, name, memberId: x.pid, at, pts: 0, alarmKey: null, medKey: key, slotAt: x.at, fixed: false });
		this.showToast('💊 Ticked off');
		await this.send({ op: 'log.add', id, memberId: x.pid, name, pts: 0, at, medKey: key, slotAt: x.at });
	}

	async medUntick(slot: MedSlot) {
		if (!slot.took) return;
		const lid = slot.took.id;
		this.s.log = this.s.log.filter((l) => l.id !== lid);
		this.showToast('Unticked');
		await this.send({ op: 'log.delete', id: lid });
	}

	/* ---------- calendar days: ticking off the past, and the daily ring ---------- */

	/** A grown-up ticks a task off for an earlier day; it counts for that day. */
	async tickPast(pid: string, day: number, id: string) {
		const h = this.house,
			t = this.s.tasks.find((x) => x.id === id);
		if (!t || h.doneOn(t, pid, day)) return;
		const at = day + 19 * 36e5 + Math.floor(Math.random() * 6e4),
			logId = uid(),
			pts = h.award(ptsFor(t), pid);
		this.s.log.unshift({ id: logId, taskId: id, name: t.name, memberId: pid, at, pts, alarmKey: null, medKey: null, slotAt: null, fixed: true });
		this.s.balances[pid] = (this.s.balances[pid] || 0) + pts;
		const ops: Op[] = [{ op: 'task.tick', id, memberId: pid, logId, at }];
		if (t.routine && ROUTINES[t.routine]) {
			const bonusName = h.routineBonusName(t.routine);
			const steps = h.tasksForDay(pid, day).filter((x) => x.routine === t.routine);
			const already = this.s.log.some((l) => l.memberId === pid && l.name === bonusName && l.at >= day && l.at < day + DAY);
			if (steps.every((x) => h.doneOn(x, pid, day)) && !already) {
				const bid = uid(),
					bpts = h.award(ROUTINE_BONUS, pid);
				this.s.log.unshift({ id: bid, taskId: null, name: bonusName, memberId: pid, at: at + 1, pts: bpts, alarmKey: null, medKey: null, slotAt: null, fixed: true });
				this.s.balances[pid] += bpts;
				ops.push({ op: 'log.add', id: bid, memberId: pid, name: bonusName, pts: bpts, at: at + 1, fixed: true });
			}
		}
		await Promise.all(ops.map((o) => this.send(o)));
	}

	async untickPast(pid: string, day: number, id: string) {
		const t = this.s.tasks.find((x) => x.id === id),
			l = t && this.house.doneOn(t, pid, day);
		if (!l) return;
		this.s.log = this.s.log.filter((x) => x.id !== l.id);
		this.s.balances[pid] = (this.s.balances[pid] || 0) - l.pts;
		await Promise.all([this.send({ op: 'log.delete', id: l.id }), this.unRing(day)]);
	}

	private ringKey = (pid: string, day: number) => 'ring_' + pid + '_' + ymd(day);
	private ringBusy = new Set<string>();

	/** Awards the daily-ring bonus once everything in someone's ring is ticked. The id is fixed per person and day, so open devices can't double-award. */
	async checkRings() {
		if (!this.me || this.pending > 0) return;
		const h = this.house,
			today = h.startOfDay,
			days = [today];
		if (this.dayPicked && this.day && this.day < today) days.push(this.day);
		for (const day of days)
			for (const p of this.s.members) {
				const id = this.ringKey(p.id, day);
				if (this.ringBusy.has(id) || this.s.log.some((l) => l.id === id)) continue;
				if (h.dayProgress(p.id, day) !== 1) continue;
				this.ringBusy.add(id); // kept after a failure too, so a rejected award isn't retried in a loop
				const pts = h.award(RING_BONUS, p.id),
					at = day === today ? Date.now() : day + 20 * 36e5,
					name = '⭕ Day ring closed!';
				this.s.log.unshift({ id, taskId: null, name, memberId: p.id, at, pts, alarmKey: null, medKey: null, slotAt: null, fixed: false });
				this.s.balances[p.id] = (this.s.balances[p.id] || 0) + pts;
				if (p.id === this.me) {
					burst(220);
					this.showToast(`⭕ Ring closed for ${day === today ? 'today' : 'that day'}! +${pts} bonus`);
				}
				if (await this.send({ op: 'log.add', id, memberId: p.id, name, pts, at })) this.ringBusy.delete(id);
			}
	}

	/** Takes back ring bonuses for a day if something was unticked. */
	async unRing(day: number) {
		const h = this.house;
		for (const p of this.s.members) {
			const id = this.ringKey(p.id, day),
				l = this.s.log.find((x) => x.id === id);
			if (!l || h.dayProgress(p.id, day) === 1) continue;
			this.s.log = this.s.log.filter((x) => x.id !== id);
			this.s.balances[p.id] = (this.s.balances[p.id] || 0) - l.pts;
			await this.send({ op: 'log.delete', id });
		}
	}

	/* ---------- events ---------- */

	async saveEvent(e: Omit<FamilyEvent, 'createdAt'>) {
		const withPrep = e.kind === 'test' && e.prep > 0 && !e.repeat?.length;
		const from = addDays(new Date(e.date + 'T00:00').getTime(), -e.prep),
			until = new Date(e.date + 'T00:00').getTime();
		return this.send({ op: 'event.save', event: e, prep: withPrep ? { from, until } : null });
	}
	async deleteEvent(id: string) {
		this.s.events = this.s.events.filter((e) => e.id !== id);
		this.s.tasks = this.s.tasks.filter((t) => t.id !== 'prep-' + id);
		return this.send({ op: 'event.delete', id });
	}

	/* ---------- my list (private) and tasks for each other ---------- */

	private popped(id: string) {
		pop();
		this.justDone = id;
		setTimeout(() => (this.justDone = null), 600);
	}

	async addTodo(text: string) {
		const me = this.me;
		text = text.trim();
		if (!me || !text) return;
		const created = Date.now();
		if (this.tdFor && this.tdFor !== me && this.house.person(this.tdFor)) {
			const toId = this.tdFor;
			this.s.handoffs.push({ id: uid(), fromId: me, toId, text, cat: this.tdCat, done: 0, createdAt: created });
			const h = this.s.handoffs[this.s.handoffs.length - 1];
			this.showToast(`📨 Sent to ${this.house.person(toId)?.name}`);
			await this.send({ op: 'handoff.add', id: h.id, fromId: me, toId, text, cat: this.tdCat, created });
			return;
		}
		const todo: Todo = { id: uid(), memberId: me, text, cat: this.tdCat, star: false, done: 0, createdAt: created };
		this.s.todos.push(todo);
		await this.send({ op: 'todo.save', todo: this.todoOp(todo) });
	}
	private todoOp = (t: Todo) => ({ id: t.id, memberId: t.memberId, text: t.text, cat: t.cat, star: t.star, done: t.done, created: t.createdAt });

	async patchTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'cat' | 'star' | 'done'>>) {
		const t = this.s.todos.find((x) => x.id === id);
		if (!t) return;
		Object.assign(t, patch);
		await this.send({ op: 'todo.save', todo: this.todoOp(t) });
	}
	async doneTodo(id: string) {
		const t = this.s.todos.find((x) => x.id === id);
		if (!t) return;
		this.popped(id);
		const left = this.house.myTodos().filter((x) => !x.done && x.id !== id).length + this.house.handIn().filter((x) => !x.done).length;
		if (!left) {
			burst(220);
			this.showToast('🎉 List cleared!');
		} else burst(40);
		await this.patchTodo(id, { done: Date.now() });
	}
	async deleteTodo(id: string) {
		this.s.todos = this.s.todos.filter((t) => t.id !== id);
		await this.send({ op: 'todo.delete', id });
	}
	async setHandDone(id: string, done: number) {
		const x = this.s.handoffs.find((q) => q.id === id);
		if (!x) return;
		if (done) {
			this.popped(id);
			burst(40);
			this.showToast(`✓ ${this.house.person(x.fromId)?.name ?? 'They'} will see it’s done`);
		}
		x.done = done;
		await this.send({ op: 'handoff.set', id, done });
	}
	async deleteHand(id: string) {
		this.s.handoffs = this.s.handoffs.filter((x) => x.id !== id);
		await this.send({ op: 'handoff.delete', id });
	}

	/* ---------- shopping ---------- */

	async addShop(raw: string) {
		const me = this.me;
		if (!me) return;
		const have = new Set(this.s.shopping.filter((x) => !x.cleared).map((x) => x.text.toLowerCase()));
		const texts = raw.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
		const base = Date.now(),
			items = [];
		for (const text of texts) {
			if (have.has(text.toLowerCase())) continue;
			have.add(text.toLowerCase());
			items.push({ id: uid(), text, aisle: aisleOf(text), created: base + items.length });
		}
		if (!items.length) return;
		for (const i of items) this.s.shopping.push({ ...i, memberId: me, createdAt: i.created, done: 0, doneBy: null, cleared: 0 });
		if (texts.length > 1) this.showToast(`🛒 ${items.length} added`);
		await this.send({ op: 'shop.add', memberId: me, items });
	}
	async shopAgain(text: string) {
		await this.addShop(text);
	}
	async setShopDone(id: string, done: number) {
		const x = this.s.shopping.find((q) => q.id === id);
		if (!x) return;
		if (done) pop();
		x.done = done;
		x.doneBy = done ? this.me : null;
		await this.send({ op: 'shop.set', id, done, doneBy: done ? this.me : null });
	}
	async deleteShop(id: string) {
		this.s.shopping = this.s.shopping.filter((x) => x.id !== id);
		await this.send({ op: 'shop.delete', id });
	}
	async clearBasket() {
		const now = Date.now();
		for (const x of this.s.shopping) if (x.done && !x.cleared) x.cleared = now;
		this.showToast('🧺 Basket cleared');
		await this.send({ op: 'shop.clear' });
	}
	async copyShopping() {
		const open = this.s.shopping.filter((x) => !x.done && !x.cleared);
		const groups = AISLE_ORDER.map((id) => [id, open.filter((x) => (x.aisle || aisleOf(x.text)) === id)] as const).filter((g) => g[1].length);
		const txt =
			'🛒 Shopping list\n' +
			groups
				.map(([id, xs]) => {
					const a = aisleInfo(id);
					return `\n${a[1]} ${a[2]}\n` + xs.map((x) => '• ' + x.text).join('\n');
				})
				.join('\n');
		try {
			await navigator.clipboard.writeText(txt);
			this.showToast('📋 Copied — paste it into WhatsApp');
			return null;
		} catch {
			return txt;
		}
	}

	/* ---------- focus timer ---------- */
	private tick: ReturnType<typeof setInterval> | undefined;

	startFocus() {
		unlockAudio();
		const f = this.focus;
		if (f.left <= 0) f.left = f.total;
		f.end = Date.now() + f.left * 1000;
		f.running = true;
		clearInterval(this.tick);
		this.tick = setInterval(() => {
			if (!this.focus.running) return clearInterval(this.tick);
			this.focus.left = Math.max(0, Math.round((this.focus.end - Date.now()) / 1000));
			if (this.focus.left <= 0) {
				this.focus.running = false;
				clearInterval(this.tick);
				chime();
				burst(140);
				this.showToast('Time! Stop and look how much you did 🎉');
			}
		}, 250);
	}
	pauseFocus() {
		this.focus.running = false;
		this.focus.left = Math.max(0, Math.round((this.focus.end - Date.now()) / 1000));
	}
	resetFocus(total = this.focus.total) {
		this.focus = { total, left: total, running: false, end: 0 };
	}
	/** Focus on one item from My list. */
	focusOnTodo(id: string) {
		this.focusTodo = id;
		this.sprint = [];
		this.resetFocus(25 * 60);
		this.view = 'focus';
		scrollTo(0, 0);
	}
	startSprint() {
		if (!this.time) return;
		this.sprint = this.house.buildSprint(this.time, this.scope).map((t) => t.id);
		this.resetFocus(this.time * 60);
		this.view = 'focus';
		this.startFocus();
	}

	destroy() {
		clearInterval(this.tick);
		clearTimeout(this.toastTimer);
	}
}

const KEY = Symbol('hausfrieden');
export const setApp = (a: AppState) => setContext(KEY, a);
export const getApp = () => getContext<AppState>(KEY);
