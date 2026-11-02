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

export type RoutineKey = 'morning' | 'afternoon' | 'evening';
export const ROUTINES: Record<RoutineKey, { label: string; emoji: string; show: (h: number) => boolean; bg: string }> = {
	morning: { label: 'Morning routine', emoji: '☀️', show: (h) => h < 12, bg: '#FFF4DC' },
	afternoon: { label: 'Afternoon routine', emoji: '🎒', show: (h) => h >= 12 && h < 17, bg: '#E3F1EA' },
	evening: { label: 'Evening routine', emoji: '🌙', show: (h) => h >= 17, bg: '#E9E6F7' }
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
export const HISTORY_DAYS = 70;

export const MILESTONES: Record<number, number> = { 3: 20, 7: 50, 14: 100, 21: 150, 30: 200, 50: 300, 100: 500 };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const EMOJIS = ['🌻','🎨','📷','🦄','🦊','🐼','🐸','🐙','🦖','🐝','🦋','🐢','🐬','🦁','🐯','🐨','🐵','🐧','🦉','🐳','🐶','🐱','🐰','🐻','🌈','⭐','🔥','⚡','🌙','☀️','🍕','🍩','🍓','🥑','🌮','🧁','🎸','🎧','🎮','⚽','🏀','🛹','🚀','🎈','👑','💎','🌵','🍄','🌸','🪐','🤖','👾','🧙','🧜','🥷','🦸','🏰','🎭','📚','🧩'];
export const SWATCHES = ['#FDE2C4','#D6ECE4','#E6DDF8','#FBD9E6','#DCEBF8','#F7EFC2','#FFD6CC','#CDEFD9','#E8E0D0','#D9D3F7','#FFE3A3','#C9E7F2'];

/** [emoji, label, time, canExtend, points, days] */
export const ALARM_PRESETS: [string, string, string, boolean, number, number[]][] = [
	['⏰', 'Wake up', '06:30', false, 0, [1, 2, 3, 4, 5]],
	['👟', 'Leave the house', '07:30', false, 0, [1, 2, 3, 4, 5]],
	['🌙', 'Screens off', '19:30', true, 5, [0, 1, 2, 3, 4]],
	['🛏️', 'Bedtime', '20:00', false, 5, [0, 1, 2, 3, 4]],
	['🔔', 'Custom alarm', '12:00', false, 0, []]
];

export type Budget = 'free' | 'low' | 'mid' | 'splurge';
export const BUDGETS: [Budget, string][] = [['free', '🌱 Free'], ['low', '💶 Low-cost'], ['mid', '🎟️ Treat'], ['splurge', '✨ Splurge']];
const BRANK: Record<Budget, number> = { free: 0, low: 1, mid: 2, splurge: 3 };

/** [emoji, label, budget, cost?] */
type Idea = [string, string, Budget, number?];
export const IDEAS: Record<'weekly' | 'monthly' | 'champion' | 'treats', Idea[]> = {
	weekly: [
		['🎲','Board-game night','free'],['🏕️','Living-room camp-out','free'],['🍿','Film night with home popcorn','free'],['👩‍🍳','Kids choose & cook dinner','free'],['🪩','Kitchen dance party','free'],['🧁','Bake something together','free'],['🧺','Park picnic','free'],
		['🍕','Pizza & film night','low'],['🍦','Ice cream walk','low'],['🥞','Pancake breakfast out','low'],['🥡','Takeaway night','low'],
		['🎳','Bowling','mid'],['🎬','Cinema trip','mid'],['🏊','Swimming pool afternoon','mid'],
		['🤸','Trampoline park','splurge'],['🔐','Escape room','splurge']
	],
	monthly: [
		['🌲','Forest or lake day with a picnic','free'],['🏛️','Free museum day','free'],['🚲','Bike-ride adventure','free'],['📚','Library & hot chocolate morning','free'],['🛷','Sledging or beach day','free'],
		['🦁','Zoo or animal park','low'],['🧗','Climbing hall','low'],['🍟','Swimming then chips','low'],
		['🎬','Cinema & dinner','mid'],['🌳','High-ropes or adventure park','mid'],['🍽️','Family dinner out','mid'],
		['🎢','Theme park day','splurge'],['🏨','Overnight trip','splurge'],['🎭','Theatre or concert','splurge']
	],
	champion: [
		['📺','Choose the family film','free'],['🍝','Choose what we cook for dinner','free'],['🌙','Stay up 30 minutes later','free'],['😴','A day off chores','free'],['👑','Be boss of Saturday’s plan','free'],['🚗','DJ in the car for a week','free'],
		['🥡','Choose a takeaway','low'],['🥐','Bakery breakfast of your choice','low'],['📖','Pick a book or comic','low'],
		['🍽️','Choose where we go for family dinner','mid'],['🎬','Cinema trip with a friend','mid'],
		['🗺️','Choose a day trip','splurge'],['🎟️','Pick a concert or event','splurge']
	],
	treats: [
		['🌙','Stay up 15 minutes later','free',40],['🎵','Pick the music in the car','free',30],['📖','An extra bedtime story','free',30],['😴','Skip one chore','free',120],['🩳','Pyjama day','free',300],
		['🍬','Sweet treat','low',60],['🗞️','Comic or magazine','low',150],['🥞','Pancake breakfast','low',200],
		['🧸','Small toy','mid',400],['🎮','Game or app credit','mid',500]
	]
};
/** Ideas up to the given budget, most expensive first. */
export const ideasFor = (kind: keyof typeof IDEAS, b: Budget) =>
	IDEAS[kind].filter((i) => BRANK[i[2]] <= BRANK[b]).sort((x, y) => BRANK[y[2]] - BRANK[x[2]]);

/** [kind, emoji, label, background] */
export const EVENT_KIND_INFO: [string, string, string, string][] = [
	['test', '📝', 'Test', '#FBE3DE'],
	['sport', '⚽', 'Sport', '#D6ECE4'],
	['appt', '🩺', 'Appointment', '#DCEBF8'],
	['school', '🏫', 'School', '#E3F1EA'],
	['bday', '🎂', 'Birthday', '#FDE2C4'],
	['fun', '🎉', 'Fun', '#F6EFC2'],
	['other', '📌', 'Other', '#EEE8F7']
];
export const kindOf = (k: string) => EVENT_KIND_INFO.find((x) => x[0] === k) ?? EVENT_KIND_INFO[5];

/** Private/shared to-do categories: [emoji, label, background, accent]. */
export const CATS: Record<'work' | 'personal', [string, string, string, string]> = {
	work: ['💼', 'Work', '#DCEBF8', '#3B6EA8'],
	personal: ['🏡', 'Personal', '#DDEFE9', '#2F7D6D']
};

export const RING_BONUS = 20;
