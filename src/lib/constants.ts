export const DAY = 864e5;

export const ROOM_COLORS = ['#F8D2B4', '#C3E4D7', '#CCD9F6', '#F6DD98', '#EBC8E3', '#D4E7AF', '#F6C0B8', '#DAD2F4', '#BEE4EE'];
export const PERSON_COLORS = ['#FDE2C4', '#D6ECE4', '#E6DDF8', '#FBD9E6', '#DCEBF8', '#F7EFC2'];

export const FREQ: [number, string][] = [
	[1, 'Every day'],
	[2, 'Every 2 days'],
	[3, 'Every 3 days'],
	[7, 'Weekly'],
	[14, 'Every 2 weeks'],
	[30, 'Monthly'],
	[90, 'Every 3 months']
];
export const MINS = [2, 5, 10, 15, 20, 30, 45];

export const CHEERS = ['One less thing!', 'Future-you says thanks.', 'Tiny wins count.', 'Look at you go.', 'Done beats perfect.', 'The house noticed.', 'Nice. Keep the momentum?'];
export const TIPS = [
	'Start with whatever is right in front of you.',
	'Put on one song and race it.',
	'Done is better than perfect.',
	'Pick things up, don’t organise them yet.',
	'Bin, dishwasher, laundry, put away — in that order.',
	'Set the timer. Stop when it rings. Really.',
	'Work round the room clockwise.'
];

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type RoutineKey = 'morning' | 'evening';
export const ROUTINES: Record<RoutineKey, { label: string; emoji: string; show: (h: number) => boolean }> = {
	morning: { label: 'Morning routine', emoji: '☀️', show: (h) => h < 14 },
	evening: { label: 'Evening routine', emoji: '🌙', show: (h) => h >= 15 }
};
export const ROUTINE_BONUS = 10;

export const DAYPRESETS: [string, string][] = [
	['d:6', 'Every Saturday'],
	['d:0', 'Every Sunday'],
	['d:1,2,3,4,5', 'School days (Mon–Fri)'],
	['d:0,1,2,3,4', 'School nights (Sun–Thu)'],
	['d:0,6', 'Weekends'],
	['d:custom', 'Pick days…']
];

/** How far back the client receives log/redemption history (balances are computed over all of it). */
export const HISTORY_DAYS = 60;
