// The ready-made household plan from the original artifact.
// Members are referenced by index: 0 and 1 are grown-ups, 2 and 3 are kids.
import { DAY, ROOM_COLORS, type RoutineKey } from './constants.ts';

export interface StarterRoom {
	key: string;
	name: string;
	emoji: string;
	color: string;
}
export interface StarterTask {
	name: string;
	roomKey: string;
	every: number;
	mins: number;
	pts: number | null;
	/** member index, or null for anyone */
	who: number | null;
	team: number[] | null;
	each: boolean;
	only: number[] | null;
	days: number[] | null;
	carry: boolean;
	routine: RoutineKey | null;
	sortOrder: number;
	last: number;
}
export interface StarterReward {
	emoji: string;
	name: string;
	cost: number;
}

type Spec = {
	n: string;
	r: string;
	m: number;
	e?: number;
	w?: number | null | 'anyone';
	each?: 1;
	only?: number[] | null;
	team?: number[] | null;
	days?: number[];
	carry?: 1;
	pts?: number;
	rt?: RoutineKey;
	o?: number;
};

export function starterPlan(people: { name: string }[], now: number, startOfDay: number) {
	const has = (i: number) => i < people.length;
	const A1 = has(0) ? 0 : 'anyone',
		A2 = has(1) ? 1 : 'anyone',
		K1 = has(2) ? 2 : null,
		K2 = has(3) ? 3 : null;
	const KIDS = [K1, K2].filter((k): k is number => k !== null);

	const R: [string, string, string][] = [
		['routines', 'Routines', '🌅'],
		['kitchen', 'Kitchen', '🍳'],
		['living', 'Living room', '🛋️'],
		['bath', 'Bathroom', '🛁'],
		['bed', 'Our bedroom', '🛏️'],
		['kid1', K1 !== null ? people[2].name + '’s room' : 'Kids’ room', '🧸'],
		['kid2', K2 !== null ? people[3].name + '’s room' : 'Kids’ room 2', '🌈'],
		['hall', 'Hallway', '🚪'],
		['laundry', 'Laundry', '🧺'],
		['desk', 'Desks & papers', '🗂️'],
		['homework', 'Homework', '📚'],
		['kindness', 'Kindness', '💛']
	];
	const rooms: StarterRoom[] = R.filter(
		([k]) => !(k === 'kid2' && K2 === null) && !(k === 'kid1' && K1 === null) && !(k === 'homework' && !KIDS.length)
	).map(([key, name, emoji], i) => ({ key, name, emoji, color: ROOM_COLORS[i % ROOM_COLORS.length] }));

	const SAT = [6],
		SCHOOL = [1, 2, 3, 4, 5],
		NIGHTS = [0, 1, 2, 3, 4];
	const kidsOnly = KIDS.length ? KIDS : null;
	const BOTH = has(1) ? [0, 1] : null;
	const anyK2 = K2 ?? 'anyone',
		anyK1 = K1 ?? 'anyone';

	const T: Spec[] = [
		{ n: 'Have a shower', r: 'routines', m: 10, each: 1, rt: 'morning', o: 1, pts: 8 },
		{ n: 'Get dressed & pyjamas away', r: 'routines', m: 5, each: 1, rt: 'morning', o: 2, pts: 5 },
		{ n: 'Open your curtains', r: 'routines', m: 1, each: 1, rt: 'morning', o: 3, pts: 3 },
		{ n: 'Make your bed', r: 'routines', m: 2, each: 1, rt: 'morning', o: 4, pts: 4 },
		{ n: 'Make your own breakfast', r: 'routines', m: 10, each: 1, only: kidsOnly, rt: 'morning', o: 5, pts: 10 },
		{ n: 'Make your own lunch box', r: 'routines', m: 10, each: 1, only: kidsOnly, days: SCHOOL, rt: 'morning', o: 6, pts: 10 },
		{ n: 'Unpack your school bag (letters to a grown-up!)', r: 'routines', m: 3, each: 1, only: kidsOnly, days: SCHOOL, rt: 'afternoon', o: 1, pts: 4 },
		{ n: 'Lunch box into the dishwasher', r: 'routines', m: 2, each: 1, only: kidsOnly, days: SCHOOL, rt: 'afternoon', o: 2, pts: 4 },
		{ n: 'Have a snack & clear up after yourself', r: 'routines', m: 5, each: 1, only: kidsOnly, rt: 'afternoon', o: 3, pts: 4 },
		{ n: '10-minute room reset', r: 'routines', m: 10, each: 1, only: kidsOnly, rt: 'afternoon', o: 4, pts: 8 },
		{ n: 'Pack your school bag for tomorrow', r: 'routines', m: 5, each: 1, only: kidsOnly, days: NIGHTS, rt: 'evening', o: 1, pts: 6 },
		{ n: 'Lay out clothes for tomorrow', r: 'routines', m: 3, each: 1, only: kidsOnly, days: NIGHTS, rt: 'evening', o: 2, pts: 4 },
		{ n: 'Dirty clothes in the wash basket', r: 'routines', m: 2, each: 1, rt: 'evening', o: 3, pts: 3 },
		{ n: 'Your plate & cup in the dishwasher', r: 'kitchen', m: 2, each: 1, pts: 5 },
		{ n: 'Pack your own stuff away (bag, shoes, jacket)', r: 'hall', m: 3, each: 1 },
		{ n: 'Unstack the dishwasher', r: 'kitchen', m: 8, team: KIDS.length ? KIDS : null, pts: 20 },
		{ n: 'Clear & wipe the kitchen counters', r: 'kitchen', m: 10, w: A1 },
		{ n: 'Run the dishwasher', r: 'kitchen', m: 2, w: A2 },
		{ n: 'Set the table for dinner', r: 'kitchen', m: 5, w: anyK2 },
		{ n: 'Clear the table after dinner', r: 'kitchen', m: 5, w: anyK1 },
		{ n: 'Wipe the stove & sink', r: 'kitchen', e: 3, m: 5, w: A2 },
		{ n: 'Take out the bins & recycling', r: 'kitchen', e: 3, m: 5, w: anyK1 },
		{ n: 'Clear out the fridge', r: 'kitchen', e: 7, m: 15, w: A2 },
		{ n: 'Plan meals & shopping list', r: 'kitchen', e: 7, m: 15, w: A1 },
		{ n: 'Cook dinner', r: 'kitchen', m: 45, team: BOTH, pts: 40 },
		{ n: '10-thing pick-up', r: 'living', m: 5 },
		{ n: 'Fold blankets & plump cushions', r: 'living', m: 3, w: anyK2 },
		{ n: 'Clear the coffee table', r: 'living', m: 3 },
		{ n: 'Wipe sink & mirror', r: 'bath', e: 3, m: 5 },
		{ n: 'Clothes off the floor', r: 'bed', e: 2, m: 5 },
		{ n: 'Change the sheets', r: 'bed', e: 14, m: 15, team: BOTH },
		{ n: 'Put toys back in their homes', r: 'kid2', m: 10, w: K2 },
		{ n: 'Change your sheets (with help)', r: 'kid1', e: 14, m: 15, w: K1 },
		{ n: 'Put on a wash', r: 'laundry', e: 2, m: 5, w: A2 },
		{ n: 'Hang up / dry the washing', r: 'laundry', e: 2, m: 10 },
		{ n: 'Fold & put away laundry', r: 'laundry', e: 2, m: 15, w: A1 },
		{ n: 'Put your clean clothes away', r: 'laundry', e: 3, m: 5, each: 1 },
		{ n: 'Sort the post & papers', r: 'desk', e: 3, m: 10, w: A1 },
		{ n: 'Clear your desk', r: 'desk', e: 3, m: 5, w: A2 },
		// Saturday deep clean
		{ n: 'Deep clean the bathroom', r: 'bath', m: 45, w: A1, days: SAT, carry: 1 },
		{ n: 'Whole-flat tidy', r: 'living', m: 20, w: A1, days: SAT, carry: 1 },
		{ n: 'Vacuum the whole flat', r: 'living', m: 30, w: A1, days: SAT, carry: 1 },
		{ n: 'Dust all surfaces', r: 'living', m: 20, w: A1, days: SAT, carry: 1 },
		{ n: 'Mop the floors', r: 'kitchen', m: 20, w: A1, days: SAT, carry: 1 },
		{ n: 'Tidy our bedroom', r: 'bed', m: 15, team: BOTH, days: SAT, carry: 1 },
		{ n: '💛 Do something nice for someone', r: 'kindness', m: 5, each: 1, pts: 10 },
		{ n: 'Fresh towels', r: 'bath', m: 5, w: anyK2, days: SAT, carry: 1 },
		{ n: 'Tidy your room', r: 'kid1', m: 20, w: K1, days: SAT, carry: 1, pts: 25 },
		{ n: 'Vacuum your room', r: 'kid1', m: 10, w: K1, days: SAT, carry: 1, pts: 15 },
		{ n: 'Tidy your room', r: 'kid2', m: 20, w: K2, days: SAT, carry: 1, pts: 25 },
		{ n: 'Vacuum your room (with help)', r: 'kid2', m: 10, w: K2, days: SAT, carry: 1, pts: 15 },
		// Homework (daily)
		{ n: 'Maths – 10 minutes', r: 'homework', m: 10, w: K2, pts: 15 },
		{ n: 'Reading – 10 minutes', r: 'homework', m: 10, w: K2, pts: 15 },
		{ n: 'German reading – 15 minutes', r: 'homework', m: 15, w: K1, pts: 20 },
		{ n: 'Klassenarbeit revision or Anton – 30 minutes', r: 'homework', m: 30, w: K1, pts: 35 }
	];

	const tasks: StarterTask[] = T.filter((t) => rooms.some((r) => r.key === t.r) && t.w !== null).map((t, i) => {
		const every = t.e || 1;
		const o: StarterTask = {
			name: t.n,
			roomKey: t.r,
			every,
			mins: t.m,
			pts: t.pts ?? null,
			who: typeof t.w === 'number' ? t.w : null,
			team: t.team ?? null,
			each: !!t.each,
			only: t.each ? (t.only ?? null) : null,
			days: null,
			carry: false,
			routine: t.rt ?? null,
			sortOrder: t.o ?? 0,
			last: 0
		};
		if (t.days) {
			o.days = t.days;
			o.carry = !!t.carry;
			o.every = 7;
		}
		if (t.each) o.who = null;
		else if (!t.days && t.r !== 'homework') {
			// stagger so day one isn't overwhelming
			const frac = 0.35 + ((i * 37) % 80) / 100;
			o.last = Math.min(Math.round(now - every * DAY * frac), startOfDay - 36e5);
		}
		return o;
	});

	const rewards: StarterReward[] = (
		[
			['🍬', 'Sweet treat', 60],
			['📱', '30 min extra screen time', 80],
			['🎬', 'Pick the Friday film', 100],
			['😴', 'Skip one chore', 120],
			['🍦', 'Ice cream outing', 150],
			['☕', 'Lie-in & coffee in bed', 150],
			['🥞', 'Pancake breakfast of your choice', 200],
			['🩳', 'Pyjama day', 300]
		] as const
	).map(([emoji, name, cost]) => ({ emoji, name, cost }));

	return { rooms, tasks, rewards };
}

export const BASIC_ROOMS: StarterRoom[] = [
	{ key: 'kitchen', name: 'Kitchen', emoji: '🍳', color: ROOM_COLORS[0] },
	{ key: 'living', name: 'Living room', emoji: '🛋️', color: ROOM_COLORS[1] },
	{ key: 'bath', name: 'Bathroom', emoji: '🛁', color: ROOM_COLORS[2] }
];
