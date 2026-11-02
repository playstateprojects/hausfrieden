// Scheduling, points and assignment logic — ported 1:1 from the original artifact.
// Pure functions over a FamilyState snapshot, a "me" member id and a clock.
import { DAY, MILESTONES, MONTHS, ROUTINES, WD, type RoutineKey } from './constants.ts';
import type { Alarm, FamilyEvent, FamilyState, LogEntry, Med, Member, Room, Task } from './types.ts';

export type Status = ['due' | 'soon' | 'ok', string];
export type Scope = 'me' | 'all';

export const sod = (ms: number) => {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};
export const daysBetween = (a: number, b: number) => Math.round((sod(b) - sod(a)) / DAY);
export const hasDays = (t: Task): t is Task & { days: number[] } => Array.isArray(t.days) && t.days.length > 0;
export const ptsFor = (t: Pick<Task, 'pts' | 'mins'>) => (t.pts && t.pts > 0 ? t.pts : 5 + (t.mins || 0));
export const dayKey = (ms: number) => {
	const d = new Date(ms);
	return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
};

export const ymd = (ms: number) => {
	const d = new Date(ms);
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const fromYmd = (s: string) => {
	const [y, m, d] = String(s).split('-').map(Number);
	return new Date(y, m - 1, d).getTime();
};
export const addDays = (ms: number, n: number) => {
	const d = new Date(ms);
	d.setDate(d.getDate() + n);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};
export const inWindow = (t: Pick<Task, 'activeFrom' | 'activeUntil'>, day: number) =>
	(!t.activeFrom || day >= t.activeFrom) && (!t.activeUntil || day < t.activeUntil);
export const evWho = (e: FamilyEvent): string[] | 'all' => (e.who === 'all' || !Array.isArray(e.who) || !e.who.length ? 'all' : e.who);
export const isRep = (e: FamilyEvent) => Array.isArray(e.repeat) && e.repeat.length > 0;

export function ago(ms: number, now = Date.now()) {
	const m = Math.round((now - ms) / 6e4);
	if (m < 1) return 'now';
	if (m < 60) return m + 'm';
	const h = Math.round(m / 60);
	if (h < 24) return h + 'h';
	return Math.round(h / 24) + 'd';
}

const OTHER_ROOM: Room = { id: '', key: null, name: 'Other', emoji: '📦', color: '#EEE', sort: 0 };

export class House {
	readonly tasks: Task[];
	constructor(
		readonly s: FamilyState,
		readonly me: string,
		readonly now: number
	) {
		this.tasks = s.tasks;
	}

	get startOfDay() {
		return sod(this.now);
	}
	get weekStart() {
		const d = new Date(this.now);
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
		return d.getTime();
	}

	person = (id: string | null | undefined): Member | undefined => this.s.members.find((p) => p.id === id);
	roomOf = (id: string): Room => this.s.rooms.find((r) => r.id === id) ?? OTHER_ROOM;
	task = (id: string) => this.tasks.find((t) => t.id === id);
	names = (ids: string[]) => ids.map((id) => this.person(id)?.name).filter((n): n is string => !!n);

	private lastOcc(t: Task & { days: number[] }) {
		const d = new Date(this.now);
		d.setHours(0, 0, 0, 0);
		for (let i = 0; i < 8; i++) {
			if (t.days.includes(d.getDay())) return d.getTime();
			d.setDate(d.getDate() - 1);
		}
		return 0;
	}
	private nextOcc(t: Task & { days: number[] }) {
		const d = new Date(this.now);
		d.setHours(0, 0, 0, 0);
		for (let i = 0; i < 8; i++) {
			d.setDate(d.getDate() + 1);
			if (t.days.includes(d.getDay())) return d.getTime();
		}
		return this.now + 7 * DAY;
	}
	onToday = (t: Task) => !hasDays(t) || t.days.includes(new Date(this.now).getDay());

	lastFor(t: Task, pid?: string) {
		if (t.each) return t.lastFor?.[pid || this.me] || 0;
		return t.last || 0;
	}

	/** >= 1 means due. Day-scheduled tasks are due on their day only; missed days are ticked off from the calendar. */
	ratio = (t: Task, pid?: string): number => {
		const l = this.lastFor(t, pid),
			now = this.now;
		if (t.once) return l ? -1 : 9;
		if (hasDays(t)) {
			const lo = this.lastOcc(t);
			if (l < lo && lo === this.startOfDay) return 1.01;
			const from = Math.max(l ? sod(l) : 0, lo),
				nx = this.nextOcc(t);
			return Math.min(0.99, Math.max(0, (now - from) / Math.max(DAY, nx - from)));
		}
		if (!l) return 9;
		const every = t.every || 7,
			ds = daysBetween(l, now);
		return ds / every + ((now - l) / DAY - ds) * 0.001;
	};

	status = (t: Task): Status => {
		const r = this.ratio(t),
			l = this.lastFor(t);
		if (t.once) return l ? ['ok', 'done ✓'] : ['due', 'one-off'];
		if (hasDays(t)) {
			if (r >= 1) {
				const lo = this.lastOcc(t);
				return ['due', lo === this.startOfDay ? 'today' : 'since ' + WD[new Date(lo).getDay()]];
			}
			const nx = this.nextOcc(t),
				dd = daysBetween(this.now, nx);
			return [dd <= 1 ? 'soon' : 'ok', dd <= 1 ? 'tomorrow' : WD[new Date(nx).getDay()]];
		}
		if (r >= 1) {
			if (!l) return ['due', 'to do'];
			const over = daysBetween(l, this.now) - t.every;
			return ['due', over >= 1 ? over + 'd overdue' : 'today'];
		}
		const left = t.every - daysBetween(l, this.now);
		return [r >= 0.75 ? 'soon' : 'ok', left <= 1 ? 'tomorrow' : 'in ' + left + 'd'];
	};

	doneRecently = (t: Task) => {
		const l = this.lastFor(t);
		return !!l && l >= this.startOfDay;
	};

	forMe = (t: Task, pid?: string) => {
		pid = pid || this.me;
		if (t.each) return !t.only || !t.only.length || t.only.includes(pid);
		if (Array.isArray(t.team) && t.team.length) return t.team.includes(pid);
		return !t.who || t.who === pid;
	};

	whoLabel = (t: Task) => {
		if (t.each) return t.only && t.only.length ? '👥 each: ' + this.names(t.only).join(', ') : '👥 everyone';
		if (Array.isArray(t.team) && t.team.length) return this.names(t.team).join(' or ');
		const p = this.person(t.who);
		return p ? p.emoji + ' ' + p.name : 'anyone';
	};

	/** Everyday list — excludes routine steps (they have their own guided card). */
	scoped = (scope: Scope) => {
		const all = this.tasks.filter((t) => !t.routine && inWindow(t, this.startOfDay));
		if (scope === 'all') return all.filter((t) => !t.each || this.forMe(t));
		return all.filter((t) => this.forMe(t));
	};

	routineSteps = (name: RoutineKey, pid?: string) =>
		this.tasks
			.filter((t) => t.routine === name && this.forMe(t, pid) && this.onToday(t))
			.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

	buildSprint = (min: number, scope: Scope) => {
		const pool = this.scoped(scope)
			.filter((t) => !this.doneRecently(t))
			.sort((a, b) => this.ratio(b) - this.ratio(a))
			.filter((t) => this.ratio(t) >= 0.6);
		const out: Task[] = [];
		let left = min;
		for (const t of pool) {
			const m = t.mins || 5;
			if (m <= left) {
				out.push(t);
				left -= m;
			}
			if (left < 2) break;
		}
		return out;
	};

	streak = (pid: string) => {
		const days = new Set(this.s.log.filter((l) => l.memberId === pid).map((l) => dayKey(l.at)));
		let n = 0;
		const d = new Date(this.now);
		if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
		while (days.has(dayKey(d.getTime()))) {
			n++;
			d.setDate(d.getDate() - 1);
		}
		return n;
	};

	balance = (pid: string) => Math.max(0, this.s.balances[pid] || 0);
	weekPts = (pid: string) => {
		const ws = this.weekStart;
		return this.s.log.filter((l) => l.memberId === pid && l.at >= ws).reduce((s, l) => s + (l.pts || 0), 0);
	};
	familyWeekPts = () => this.s.members.reduce((a, p) => a + this.weekPts(p.id), 0);


	/* ---------- fair play, months and the race ---------- */

	isAdult = (pid: string) => this.person(pid)?.kind === 'adult';
	/** Grown-ups earn a fraction of task points (capped) so kids can win the monthly race. */
	award = (raw: number, pid: string) => {
		if (!this.isAdult(pid)) return raw;
		const { adultRate: rate, adultCap: cap } = this.s.family;
		if (rate >= 1) return raw;
		return Math.max(1, Math.min(cap, Math.round(raw * rate)));
	};
	myPts = (t: Pick<Task, 'pts' | 'mins'>) => this.award(ptsFor(t), this.me);

	monthStart = (off = 0) => {
		const d = new Date(this.now);
		d.setHours(0, 0, 0, 0);
		d.setDate(1);
		d.setMonth(d.getMonth() + off);
		return d.getTime();
	};
	daysLeftInMonth = () => Math.round((this.monthStart(1) - this.startOfDay) / DAY);
	ptsBetween = (pid: string, a: number, b: number) =>
		this.s.log.filter((l) => l.memberId === pid && l.at >= a && l.at < b).reduce((s, l) => s + (l.pts || 0), 0);
	monthPts = (pid: string) => this.ptsBetween(pid, this.monthStart(0), Infinity);
	familyMonthPts = () => this.s.members.reduce((a, p) => a + this.monthPts(p.id), 0);

	/** Winner(s) of the previous month, only for months after the race began. */
	lastChampion = () => {
		const a = this.monthStart(-1),
			b = this.monthStart(0);
		if (a < this.s.family.champStart) return null;
		const rows = this.s.members
			.map((p) => ({ p, n: this.ptsBetween(p.id, a, b) }))
			.filter((r) => r.n > 0)
			.sort((x, y) => y.n - x.n);
		if (!rows.length) return null;
		return { month: MONTHS[new Date(a).getMonth()], winners: rows.filter((r) => r.n === rows[0].n), n: rows[0].n };
	};

	nextMilestone = (n: number) => Object.keys(MILESTONES).map(Number).find((m) => m > n);
	didToday = (pid: string) => this.s.log.some((l) => l.memberId === pid && l.at >= this.startOfDay);

	/* ---------- alarms ---------- */

	/** Members whose reminders this device shows: yourself, plus every kid if you're a grown-up. */
	alarmPeople = () =>
		!this.me ? [] : this.s.members.filter((p) => p.id === this.me || (this.isAdult(this.me) && !this.isAdult(p.id))).map((p) => p.id);
	private visibleHere = (t: string) => !!this.me && (t === 'all' || t === this.me || (this.isAdult(this.me) && !this.isAdult(t)));
	extToday = (pid: string, alarmId: string) =>
		this.s.redemptions.filter((x) => x.memberId === pid && x.ext && x.alarmId === alarmId && x.at >= this.startOfDay).length;

	alarmSlots = (): AlarmSlot[] => this.alarmSlotsOn(this.startOfDay);

	/** Alarm slots on one day (local midnight); extensions only exist for today. */
	alarmSlotsOn = (day: number): AlarmSlot[] => {
		const wd = new Date(day).getDay(),
			dk = dayKey(day),
			out: AlarmSlot[] = [];
		const logByAlarm = new Map<string, LogEntry>();
		for (const l of this.s.log) if (l.alarmKey) logByAlarm.set(l.alarmKey, l);
		for (const a of this.s.family.alarms) {
			if (!a.on || !/^\d\d:\d\d$/.test(a.time || '')) continue;
			if (a.days.length && !a.days.includes(wd)) continue;
			const [hh, mm] = a.time.split(':').map(Number),
				d = new Date(day);
			d.setHours(hh, mm, 0, 0);
			const targets = a.who === 'all' || !a.who.length ? ['all'] : a.who;
			for (const t of targets) {
				if (!this.visibleHere(t)) continue;
				const ext = a.extend && t !== 'all' && day === this.startOfDay ? this.extToday(t, a.id) : 0,
					key = a.id + '_' + t + '_' + dk;
				out.push({ a, t, base: d.getTime(), at: d.getTime() + ext * 6e5, ext, key, ack: logByAlarm.get(key) });
			}
		}
		return out.sort((x, y) => x.at - y.at);
	};

	/* ---------- medicines ---------- */

	medSlotsOn = (pid: string, day: number): MedSlot[] => {
		const wd = new Date(day).getDay(),
			dk = dayKey(day),
			out: MedSlot[] = [];
		for (const m of this.s.family.meds) {
			if (!m.on || m.who !== pid) continue;
			if (m.created && day < sod(m.created)) continue;
			if (m.days.length && !m.days.includes(wd)) continue;
			for (const t of m.times) {
				if (!/^\d\d:\d\d$/.test(t)) continue;
				const [hh, mi] = t.split(':').map(Number),
					d = new Date(day);
				d.setHours(hh, mi, 0, 0);
				const key = m.id + '_' + t.replace(':', '') + '_' + dk;
				out.push({ m, pid, time: t, at: d.getTime(), key, took: this.s.log.find((l) => l.medKey === key) });
			}
		}
		return out.sort((a, b) => a.at - b.at);
	};
	medSlotsToday = (pid: string) => this.medSlotsOn(pid, this.startOfDay);
	dayN = (n: number) => {
		const d = new Date(this.now);
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - n);
		return d.getTime();
	};
	findMedSlot = (key: string) => {
		for (let n = 0; n < 31; n++) for (const p of this.s.members) for (const x of this.medSlotsOn(p.id, this.dayN(n))) if (x.key === key) return x;
		return null;
	};

	/* ---------- calendar, days and the daily ring ---------- */

	isHw = (t: Task) => this.roomOf(t.roomId).key === 'homework';

	/** Kids only see events that include them; grown-ups see everything. */
	seesEvent = (e: FamilyEvent) => {
		if (!this.me || this.isAdult(this.me)) return true;
		const w = evWho(e);
		return w === 'all' || w.includes(this.me);
	};
	eventsOn = (day: number) =>
		this.s.events
			.filter((e) =>
				isRep(e)
					? e.repeat!.includes(new Date(day).getDay()) && day >= fromYmd(e.date) && (!e.until || day <= fromYmd(e.until))
					: e.date === ymd(day)
			)
			.filter(this.seesEvent)
			.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

	// completion lookup by "who|task|day", rebuilt whenever the log changes
	private li: Map<string, LogEntry> | null = null;
	private liSrc: LogEntry[] | null = null;
	private liLen = -1;
	private liTop: string | undefined;
	private logIdx() {
		const log = this.s.log;
		if (!this.li || this.liSrc !== log || this.liLen !== log.length || this.liTop !== log[0]?.id) {
			this.li = new Map();
			for (const l of log) if (l.taskId) this.li.set(l.memberId + '|' + l.taskId + '|' + dayKey(l.at), l);
			this.liSrc = log;
			this.liLen = log.length;
			this.liTop = log[0]?.id;
		}
		return this.li;
	}
	doneOn = (t: Task, pid: string, day: number) => this.logIdx().get(pid + '|' + t.id + '|' + dayKey(day));

	tasksForDay = (pid: string, day: number) => {
		const wd = new Date(day).getDay();
		return this.tasks.filter((t) => {
			if (!this.forMe(t, pid) || !inWindow(t, day)) return false;
			if (hasDays(t) && !t.days.includes(wd)) return false;
			const l = this.lastFor(t, pid);
			if (t.once && l && l < day) return false;
			if (t.createdAt && day < sod(t.createdAt) && !this.doneOn(t, pid, day)) return false;
			return true;
		});
	};

	/** The day ring counts a person's own daily commitments: routines, homework, daily jobs and that day's scheduled jobs. */
	ringTasks = (pid: string, day: number) =>
		this.tasksForDay(pid, day).filter(
			(t) =>
				!t.once &&
				(t.each || t.who === pid || (Array.isArray(t.team) && t.team.includes(pid))) &&
				(t.routine || this.isHw(t) || hasDays(t) || t.activeFrom || +t.every === 1)
		);
	ringDone = (t: Task, pid: string, day: number) => {
		if (Array.isArray(t.team) && t.team.length && !t.each) return t.team.some((id) => !!this.doneOn(t, id, day));
		return !!this.doneOn(t, pid, day);
	};
	/** 0..1, or null when the person has nothing in their ring that day. */
	dayProgress = (pid: string, day: number) => {
		const list = this.ringTasks(pid, day);
		if (!list.length) return null;
		return list.filter((t) => this.ringDone(t, pid, day)).length / list.length;
	};

	/* ---------- private list and tasks for each other ---------- */

	myTodos = () => this.s.todos.filter((t) => t.memberId === this.me);
	otherAdults = () => this.s.members.filter((p) => p.kind === 'adult' && p.id !== this.me);
	handIn = () => this.s.handoffs.filter((x) => x.toId === this.me);
	handOut = () => this.s.handoffs.filter((x) => x.fromId === this.me);

	routineBonusName = (key: RoutineKey) => ROUTINES[key].label + ' complete';
}

export interface AlarmSlot {
	a: Alarm;
	/** Member id, or 'all'. */
	t: string;
	base: number;
	at: number;
	ext: number;
	key: string;
	ack: LogEntry | undefined;
}
export interface MedSlot {
	m: Med;
	pid: string;
	time: string;
	at: number;
	key: string;
	took: LogEntry | undefined;
}
