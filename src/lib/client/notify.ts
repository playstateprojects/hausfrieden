// OS-level alarm, medicine and calendar notifications for the Capacitor apps. In-app timers stop
// when the app is backgrounded, so the upcoming slots are handed to the OS as local notifications.
// There is no push: the queue is rebuilt from the latest data whenever the app is open.
import { Capacitor } from '@capacitor/core';
import { kindOf } from '#lib/constants.ts';
import { evWho, isRep, fromYmd, type House } from '#lib/logic.ts';
import { lsGet, lsSet } from './app.svelte.ts';

const CHANNEL = 'alarms';
/** iOS keeps at most 64 pending local notifications. */
const MAX = 60;
const DAYS_AHEAD = 14;
const MIN = 6e4;
const HOUR = 36e5;
/** Bundled from `static/`; iOS plays up to 30 s of it, which is the closest a notification gets to ringing. */
const IOS_ALARM_SOUND = 'alarm.wav';
/** Slots this close get follow-up rings until they are dealt with in the app. */
const NAG_WITHIN = 24 * HOUR;
const ALARM_NAGS = [5 * MIN, 10 * MIN];
const MED_NAGS = [10 * MIN, 30 * MIN];
/** Calendar: heads-up before timed events, a morning note for all-day ones, revision in the afternoon. */
const EVENT_LEAD = 30 * MIN;
const ALL_DAY_HOUR = 8;
const REVISE_HOUR = 16;

export const canNotify = () => Capacitor.isNativePlatform();

const plugin = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

/** Stable positive 31-bit id from a string, so a slot keeps its id between reschedules. */
const nid = (s: string) => {
	let h = 7;
	for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
	return (h & 0x7fffffff) || 1;
};

type Item = { id: number; at: number; title: string; body: string; /** Rings like an alarm (long sound, breaks through Focus). */ ring: boolean };

const atHour = (day: number, hh: number, mm = 0) => {
	const d = new Date(day);
	d.setHours(hh, mm, 0, 0);
	return d.getTime();
};

/**
 * When a slot should ring from now on: its own time, follow-ups while it is still unanswered,
 * and the end of a snooze set on this device. Nothing rings while it is snoozed.
 */
function ringTimes(at: number, now: number, nags: number[], windowMs: number, snoozedUntil: number): number[] {
	const times = [at, ...(at - now < NAG_WITHIN ? nags.map((n) => at + n) : [])].filter((t) => t > now && t >= snoozedUntil);
	if (snoozedUntil > now && snoozedUntil < at + windowMs && !times.includes(snoozedUntil)) times.push(snoozedUntil);
	return times;
}

function upcoming(h: House, now: number): Item[] {
	const items: Item[] = [];
	for (let n = 0; n < DAYS_AHEAD; n++) {
		const d = new Date(h.startOfDay);
		d.setDate(d.getDate() + n);
		const day = d.getTime();

		for (const s of h.alarmSlotsOn(day)) {
			if (s.ack || lsGet('hf_ahide_' + s.key + '_' + s.at)) continue;
			const lab = s.a.label || 'Alarm',
				who = s.t === 'all' || s.t === h.me ? '' : (h.person(s.t)?.name ?? '') + ': ',
				emoji = s.a.emoji || '⏰';
			if (s.a.extend && s.at - 5 * MIN > now)
				items.push({ id: nid('w' + s.key + s.at), at: s.at - 5 * MIN, title: `${emoji} 5 minutes until ${lab.toLowerCase()}`, body: who.replace(/: $/, ''), ring: false });
			for (const t of ringTimes(s.at, now, ALARM_NAGS, HOUR, +(lsGet('hf_asnz_' + s.key) || 0)))
				items.push({ id: nid('a' + s.key + t), at: t, title: `${emoji} ${who}${lab}`, body: t === s.at ? s.a.note || 'It’s time' : 'Still ringing — open Hausfrieden to stop it', ring: true });
		}

		for (const pid of h.alarmPeople())
			for (const s of h.medSlotsOn(pid, day)) {
				if (s.took || lsGet('hf_medhide_' + s.key)) continue;
				const mine = pid === h.me,
					what = [s.m.label, s.m.note].filter(Boolean).join(' · ');
				for (const t of ringTimes(s.at, now, MED_NAGS, 3 * HOUR, +(lsGet('hf_medsnz_' + s.key) || 0)))
					items.push({
						id: nid('m' + s.key + t),
						at: t,
						title: `💊 ${mine ? 'Medicine time' : (h.person(pid)?.name ?? '') + '’s medicine'}`,
						body: t === s.at ? what : [what, 'not ticked off yet'].filter(Boolean).join(' · '),
						ring: true
					});
			}

		for (const e of h.eventsOn(day)) {
			const timed = /^\d\d:\d\d$/.test(e.time || ''),
				[hh, mm] = timed ? e.time.split(':').map(Number) : [ALL_DAY_HOUR, 0],
				start = atHour(day, hh, mm),
				at = timed ? start - EVENT_LEAD : start,
				w = evWho(e),
				names = w === 'all' ? '' : w.filter((id) => id !== h.me).map((id) => h.person(id)?.name).filter(Boolean).join(', ');
			if (at <= now) continue;
			items.push({
				id: nid('e' + e.id + day),
				at,
				title: `${kindOf(e.kind)[1]} ${e.title}${timed ? ' at ' + e.time : ' today'}`,
				body: [names, e.note].filter(Boolean).join(' · '),
				ring: false
			});
		}

		// revision days before a test, for the people sitting it (the homework task itself is added server-side)
		for (const e of h.s.events) {
			if (e.kind !== 'test' || !e.prep || isRep(e)) continue;
			const w = evWho(e);
			if (w !== 'all' && !w.includes(h.me)) continue;
			const test = fromYmd(e.date),
				left = Math.round((test - day) / 864e5),
				at = atHour(day, REVISE_HOUR);
			if (left < 1 || left > e.prep || at <= now) continue;
			items.push({ id: nid('r' + e.id + day), at, title: `📚 Revise: ${e.title}`, body: left === 1 ? 'The test is tomorrow' : `The test is in ${left} days`, ring: false });
		}
	}

	items.sort((a, b) => a.at - b.at);
	const out = items.slice(0, MAX - 1);
	// the queue is finite and only refilled while the app is open, so say when it is about to run dry
	if (out.some((i) => i.ring)) {
		const end = items.length > out.length ? out[out.length - 1].at + MIN : atHour(h.startOfDay + DAYS_AHEAD * 864e5, 9);
		out.push({ id: nid('keepalive'), at: end, title: '⏰ Open Hausfrieden to keep your alarms ringing', body: 'Alarms and reminders are only queued a couple of weeks ahead.', ring: false });
	}
	return out;
}

let ready: Promise<boolean> | null = null;

/** Asks for notification permission (once per run) and makes sure the Android channel exists. */
export function setupNotifications() {
	return (ready ??= (async () => {
		try {
			const LN = await plugin();
			let p = await LN.checkPermissions();
			if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LN.requestPermissions();
			if (p.display !== 'granted') return false;
			if (Capacitor.getPlatform() === 'android') {
				await LN.createChannel({ id: CHANNEL, name: 'Alarms & medicine', description: 'Alarm and medicine reminders', importance: 5, visibility: 1, vibration: true });
				// Android 12+ needs "Alarms & reminders" access for on-the-minute delivery; ask once
				const ex = await LN.checkExactNotificationSetting();
				if (ex.exact_alarm === 'denied' && !lsGet('hf_exact_asked')) {
					lsSet('hf_exact_asked', '1');
					await LN.changeExactNotificationSetting();
				}
			}
			return true;
		} catch {
			return false;
		}
	})());
}

let lastSig = '';

/** Replaces everything pending with the slots coming up for the people on this device. */
export async function scheduleNotifications(h: House) {
	if (!canNotify() || !h.me) return;
	if (!(await setupNotifications())) return;
	try {
		const LN = await plugin();
		const items = upcoming(h, Date.now());
		// polling replaces state every few seconds; only touch the OS when something changed
		if (JSON.stringify(items) === lastSig) return;
		const { notifications } = await LN.getPending();
		if (notifications.length) await LN.cancel({ notifications: notifications.map((x) => ({ id: x.id })) });
		lastSig = JSON.stringify(items);
		if (!items.length) return;
		const ios = Capacitor.getPlatform() === 'ios';
		await LN.schedule({
			notifications: items.map((i) => ({
				id: i.id,
				title: i.title,
				body: i.body,
				channelId: CHANNEL,
				schedule: { at: new Date(i.at), allowWhileIdle: true },
				// iOS is silent unless a sound is named; an unknown name plays the system default.
				// Android takes its sound from the channel.
				...(ios ? { sound: i.ring ? IOS_ALARM_SOUND : 'default', interruptionLevel: i.ring ? ('timeSensitive' as const) : ('active' as const) } : {})
			}))
		});
	} catch {
		/* the in-app overlay still works */
	}
}
