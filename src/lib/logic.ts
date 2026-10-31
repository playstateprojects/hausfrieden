// Scheduling, points and assignment logic — ported 1:1 from the original artifact.
// Pure functions over a FamilyState snapshot, a "me" member id and a clock.
import { DAY, ROUTINES, WD, type RoutineKey } from './constants.ts';
import type { FamilyState, Member, Room, Task } from './types.ts';

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
const dayKey = (ms: number) => {
	const d = new Date(ms);
	return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
};

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

	/** >= 1 means due. Day-scheduled tasks are due on their day (and, with carry, until done). */
	ratio = (t: Task, pid?: string): number => {
		const l = this.lastFor(t, pid),
			now = this.now;
		if (hasDays(t)) {
			const lo = this.lastOcc(t);
			if (l < lo && (lo === this.startOfDay || t.carry)) return 1 + daysBetween(lo, now) / 7 + (t.carry ? 0 : 0.01);
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
		const all = this.tasks.filter((t) => !t.routine);
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

	routineBonusName = (key: RoutineKey) => ROUTINES[key].label + ' complete';
}
