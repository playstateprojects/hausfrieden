import type { RoutineKey } from './constants.ts';

export interface Member {
	id: string;
	userId: string | null;
	name: string;
	emoji: string;
	color: string;
	role: 'admin' | 'member';
	sort: number;
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
}

export interface FamilyInfo {
	id: string;
	name: string;
	inviteCode: string;
	goal: number;
	goalReward: string;
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
