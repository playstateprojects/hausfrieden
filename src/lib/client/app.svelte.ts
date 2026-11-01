import { invalidate } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { CHEERS, MILESTONES, ROUTINE_BONUS, ROUTINES, WD, type RoutineKey } from '#lib/constants.ts';
import { House, type MedSlot, type Scope } from '#lib/logic.ts';
import type { Op } from '#lib/schemas.ts';
import type { FamilyState } from '#lib/types.ts';
import { burst, chime, unlockAudio } from './fx.ts';

export type View = 'today' | 'rooms' | 'focus' | 'treats' | 'family';
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
	| { kind: 'medlog' };

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
	sheet: Sheet | null = $state(null);
	toast: { msg: string; btn?: string; act?: () => void; key: number } | null = $state(null);

	house = $derived(new House(this.s, this.me ?? '', this.now));

	private undoInfo: Undo | null = null;
	private pending = 0;
	private toastTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(data: { state: FamilyState; families: { id: string; name: string }[]; user: AppState['user'] }) {
		this.replace(data);
		this.scope = lsGet('hf_scope') === 'all' ? 'all' : 'me';
	}

	get familyId() {
		return this.s.family.id;
	}

	/** Called whenever fresh server data arrives. */
	replace(data: { state: FamilyState; families: { id: string; name: string }[]; user: AppState['user'] }) {
		const switched = !this.s || this.s.family.id !== data.state.family.id;
		this.s = data.state;
		this.families = data.families;
		this.user = data.user;
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

	refresh() {
		if (this.pending === 0) return invalidate('app:family');
	}

	/** Sends one op to the server, then re-syncs. Returns the JSON result, or null on failure. */
	async send<T = Record<string, unknown>>(op: Op): Promise<(T & { ok: true }) | null> {
		this.pending++;
		try {
			const res = await fetch(`/api/f/${this.familyId}`, {
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
			if (this.pending === 0) await invalidate('app:family');
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
		this.s.log.unshift({ id: logId, taskId: id, name: t.name, memberId: me, at: now, pts, alarmKey: null, medKey: null, slotAt: null });
		this.s.balances[me] = (this.s.balances[me] || 0) + pts;
		burst();

		const ops: Op[] = [{ op: 'task.complete', id, memberId: me, logId }];
		const bonus = (name: string, bpts: number, at: number) => {
			const bonusId = uid();
			this.s.log.unshift({ id: bonusId, taskId: null, name, memberId: me, at, pts: bpts, alarmKey: null, medKey: null, slotAt: null });
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
		await this.send({ op: 'task.undo', id: u.taskId, memberId: u.memberId, logId: u.logId, prev: u.prev });
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
		this.s.log.unshift({ id, taskId: null, name, memberId: by, at, pts, alarmKey: key, medKey: null, slotAt: null });
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
		this.s.log.unshift({ id, taskId: null, name, memberId: x.pid, at, pts: 0, alarmKey: null, medKey: key, slotAt: x.at });
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
