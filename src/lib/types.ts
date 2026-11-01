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
	/** All-time points earned minus spent, per member id. */
	balances: Record<string, number>;
	/** The member linked to the signed-in user in this family. */
	myMemberId: string;
}
