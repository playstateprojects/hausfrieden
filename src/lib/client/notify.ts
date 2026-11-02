// OS-level alarm and medicine notifications for the Capacitor apps. In-app timers stop when the
// app is backgrounded, so the upcoming slots are handed to the OS as local notifications instead.
import { Capacitor } from '@capacitor/core';
import type { House } from '#lib/logic.ts';
import { lsGet, lsSet } from './app.svelte.ts';

const CHANNEL = 'alarms';
/** iOS keeps at most 64 pending local notifications. */
const MAX = 60;
const DAYS_AHEAD = 4;

export const canNotify = () => Capacitor.isNativePlatform();

const plugin = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

/** Stable positive 31-bit id from a string, so a slot keeps its id between reschedules. */
const nid = (s: string) => {
	let h = 7;
	for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
	return (h & 0x7fffffff) || 1;
};

type Item = { id: number; at: number; title: string; body: string };

function upcoming(h: House, now: number): Item[] {
	const items: Item[] = [];
	for (let n = 0; n < DAYS_AHEAD; n++) {
		const d = new Date(h.startOfDay);
		d.setDate(d.getDate() + n);
		const day = d.getTime();
		for (const s of h.alarmSlotsOn(day)) {
			if (s.ack) continue;
			const lab = s.a.label || 'Alarm',
				who = s.t === 'all' || s.t === h.me ? '' : (h.person(s.t)?.name ?? '') + ': ',
				emoji = s.a.emoji || '⏰';
			if (s.a.extend && s.at - 5 * 6e4 > now)
				items.push({ id: nid('w' + s.key + s.at), at: s.at - 5 * 6e4, title: `${emoji} 5 minutes until ${lab.toLowerCase()}`, body: who.replace(/: $/, '') });
			if (s.at > now) items.push({ id: nid('a' + s.key + s.at), at: s.at, title: `${emoji} ${who}${lab}`, body: s.a.note || `It’s time` });
		}
		for (const pid of h.alarmPeople())
			for (const s of h.medSlotsOn(pid, day)) {
				if (s.took || s.at <= now) continue;
				const mine = pid === h.me;
				items.push({
					id: nid('m' + s.key),
					at: s.at,
					title: `💊 ${mine ? 'Medicine time' : (h.person(pid)?.name ?? '') + '’s medicine'}`,
					body: [s.m.label, s.m.note].filter(Boolean).join(' · ')
				});
			}
	}
	return items.sort((a, b) => a.at - b.at).slice(0, MAX);
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
		await LN.schedule({
			notifications: items.map((i) => ({
				id: i.id,
				title: i.title,
				body: i.body,
				channelId: CHANNEL,
				schedule: { at: new Date(i.at), allowWhileIdle: true }
			}))
		});
	} catch {
		/* the in-app overlay still works */
	}
}
