import type { RoutineKey } from './constants.ts';

export interface Member {
	id: string;
	userId: string | null;
	name: string;
	emoji: string;
	color: string;
	role: 'admin' | 'member';
	kind: 'adult' | 'kid';
	sort: number;
}

export interface Alarm {
	id: string;
	emoji: string;
	label: string;
	note: string;
	/** HH:MM */
	time: string;
	/** Weekdays (0 = Sunday); empty means every day. */
	days: number[];
	/** Member ids, or 'all' to ring on every device. */
	who: string[] | 'all';
	pts: number;
	/** Can be pushed back 10 minutes for points. */
	extend: boolean;
	on: boolean;
}

export interface Med {
	id: string;
	/** Start of the day it was created; earlier days don't show it. */
	created: number;
	who: string;
	label: string;
	note: string;
	times: string[];
	days: number[];
	on: boolean;
}

export interface Room {
	id: string;
	key: string | null;
	name: string;
	emoji: string;
	color: string;
	sort: number;
}

export interface Task {
	id: string;
	roomId: string;
	name: string;
	every: number;
	mins: number;
	pts: number | null;
	who: string | null;
	team: string[] | null;
	each: boolean;
	only: string[] | null;
	days: number[] | null;
	carry: boolean;
	once: boolean;
	routine: RoutineKey | null;
	/** Shows only from this day up to (not including) `activeUntil`; epoch ms. */
	activeFrom: number | null;
	activeUntil: number | null;
	/** Calendar event this revision task was generated from. */
	prepFor: string | null;
	sortOrder: number;
	last: number;
	lastBy: string | null;
	lastFor: Record<string, number>;
	createdAt: number;
}

export interface LogEntry {
	id: string;
	taskId: string | null;
	name: string;
	memberId: string;
	at: number;
	pts: number;
	alarmKey: string | null;
	medKey: string | null;
	slotAt: number | null;
	/** Ticked off later for a past day. */
	fixed: boolean;
}

export interface Reward {
	id: string;
	emoji: string;
	name: string;
	cost: number;
}

export interface Redemption {
	id: string;
	memberId: string;
	name: string;
	emoji: string;
	cost: number;
	at: number;
	ext: boolean;
	alarmId: string | null;
}

export const EVENT_KINDS = ['test', 'sport', 'appt', 'school', 'bday', 'fun', 'other'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface FamilyEvent {
	id: string;
	kind: EventKind;
	title: string;
	/** YYYY-MM-DD; the first day for repeating events. */
	date: string;
	time: string;
	who: string[] | 'all';
	note: string;
	prep: number;
	repeat: number[] | null;
	until: string | null;
	createdAt: number;
}

export interface ShopItem {
	id: string;
	text: string;
	aisle: string;
	memberId: string | null;
	createdAt: number;
	/** When it went in the basket; 0 if still to get. */
	done: number;
	doneBy: string | null;
	/** When the basket was cleared; 0 if not. */
	cleared: number;
}

export type TodoCat = 'work' | 'personal';

/** A to-do one grown-up sends another. */
export interface Handoff {
	id: string;
	fromId: string;
	toId: string;
	text: string;
	cat: TodoCat;
	done: number;
	createdAt: number;
}

/** A private to-do (never sent to anyone but its owner's devices). */
export interface Todo {
	id: string;
	memberId: string;
	text: string;
	cat: TodoCat;
	star: boolean;
	done: number;
	createdAt: number;
}

export interface FamilyInfo {
	id: string;
	name: string;
	inviteCode: string;
	goal: number;
	goalReward: string;
	monthGoal: number;
	monthGoalReward: string;
	monthPrize: string;
	adultRate: number;
	adultCap: number;
	budget: 'free' | 'low' | 'mid' | 'splurge';
	champStart: number;
	extendCost: number;
	extendMax: number;
	alarms: Alarm[];
	meds: Med[];
}

export interface FamilyState {
	family: FamilyInfo;
	members: Member[];
	rooms: Room[];
	tasks: Task[];
	log: LogEntry[];
	rewards: Reward[];
	redemptions: Redemption[];
	events: FamilyEvent[];
	shopping: ShopItem[];
	handoffs: Handoff[];
	/** Private to-dos: yours, plus those of people who share a device (no login of their own). */
	todos: Todo[];
	/** All-time points earned minus spent, per member id. */
	balances: Record<string, number>;
	/** The member linked to the signed-in user in this family. */
	myMemberId: string;
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
}

/** GET /api/me */
export interface Me {
	user: SessionUser;
	families: { id: string; name: string }[];
}

/** GET /api/bootstrap — `state` is null until the user belongs to a family. */
export interface Bootstrap extends Me {
	state: FamilyState | null;
}
