import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { and, asc, eq } from 'drizzle-orm';
import { kindOf } from '#lib/constants.ts';
import type { DB } from './db/index.ts';
import { calendarLinks, events, members } from './db/schema.ts';

/*
 * Google Calendar: a one-way push of family events into each connected grown-up's calendar.
 *
 * - Our own OAuth flow (not better-auth's social login), so it also works from the native apps:
 *   the app asks for a consent URL, opens it in the system browser, and Google comes back to
 *   /api/google/callback with a signed `state` that says which member started it.
 * - Each family event maps to one Google event with a deterministic id (see `googleId`), so there
 *   is no mapping table: saving is PATCH-or-insert, deleting is DELETE.
 */

const SCOPES = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
];
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Events per sync request. Each needs up to 3 Google calls; Workers allow 50 subrequests on the free plan. */
const CHUNK = 10;

export type CalendarLink = typeof calendarLinks.$inferSelect;
type EventRow = typeof events.$inferSelect;

export const googleConfigured = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const redirectUri = (origin: string) => `${origin}/api/google/callback`;

/* ---------- small crypto helpers (keys derive from BETTER_AUTH_SECRET; rotating it disconnects calendars) ---------- */

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function deriveKey(use: 'state' | 'token') {
	const raw = await crypto.subtle.digest('SHA-256', enc.encode(`hausfrieden:google:${use}:${env.BETTER_AUTH_SECRET}`));
	return use === 'state'
		? crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
		: crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(text: string) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey('token'), enc.encode(text));
	return `${b64u(iv)}.${b64u(ct)}`;
}
async function unseal(sealed: string) {
	const [iv, ct] = sealed.split('.');
	const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await deriveKey('token'), unb64u(ct));
	return new TextDecoder().decode(pt);
}

/* ---------- OAuth ---------- */

export type OAuthState = { familyId: string; memberId: string; native: boolean };

/** The Google consent screen for this member. `state` is signed and good for 15 minutes. */
export async function consentUrl(origin: string, s: OAuthState) {
	const payload = b64u(enc.encode(JSON.stringify({ ...s, exp: Date.now() + 15 * 60_000 })));
	const sig = await crypto.subtle.sign('HMAC', await deriveKey('state'), enc.encode(payload));
	const q = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri(origin),
		response_type: 'code',
		scope: SCOPES.join(' '),
		// offline + consent: always get a refresh token, also when reconnecting
		access_type: 'offline',
		prompt: 'consent',
		state: `${payload}.${b64u(sig)}`
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function readState(state: string | null): Promise<OAuthState | null> {
	try {
		const [payload, sig] = (state ?? '').split('.');
		if (!payload || !sig) return null;
		const ok = await crypto.subtle.verify('HMAC', await deriveKey('state'), unb64u(sig), enc.encode(payload));
		if (!ok) return null;
		const s = JSON.parse(new TextDecoder().decode(unb64u(payload))) as OAuthState & { exp: number };
		return s.exp > Date.now() ? { familyId: s.familyId, memberId: s.memberId, native: !!s.native } : null;
	} catch {
		return null;
	}
}

class GoogleError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function tokenRequest(params: Record<string, string>) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params })
	});
	const data = (await res.json().catch(() => ({}))) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		scope?: string;
		error?: string;
	};
	if (!res.ok || !data.access_token) {
		throw new GoogleError(
			res.status,
			data.error === 'invalid_grant' ? 'Google access was removed. Disconnect and connect again.' : 'Google sign-in failed. Try again.'
		);
	}
	return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

// access tokens live about an hour; keep them per isolate rather than in the database
const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(link: CalendarLink) {
	const hit = tokenCache.get(link.memberId);
	if (hit && hit.exp > Date.now() + 60_000) return hit.token;
	const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: await unseal(link.refreshToken) });
	tokenCache.set(link.memberId, { token: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 });
	return t.access_token;
}

async function gfetch(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
	return fetch(API + path, {
		method: init.method ?? 'GET',
		headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
		// POST bodies must not carry the nulls that PATCH uses to clear fields
		body: init.body ? JSON.stringify(init.body, init.method === 'POST' ? (_k, v) => (v === null ? undefined : v) : undefined) : undefined
	});
}

async function fail(res: Response): Promise<never> {
	const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
	throw new GoogleError(res.status, data?.error?.message ?? `Google Calendar error ${res.status}`);
}

type GCalendar = { id: string; summary: string; summaryOverride?: string; timeZone?: string; primary?: boolean };

/** Calendars the account can add events to, primary first. */
async function writableCalendars(token: string) {
	const res = await gfetch(token, '/users/me/calendarList?minAccessRole=writer&maxResults=250');
	if (!res.ok) await fail(res);
	const { items = [] } = (await res.json()) as { items?: GCalendar[] };
	return items
		.sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
		.map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary, timeZone: c.timeZone ?? 'UTC', primary: !!c.primary }));
}

/** Finishes the OAuth flow: swaps the code for tokens and stores the link, pointing at the primary calendar. */
export async function connect(db: DB, origin: string, s: OAuthState, code: string) {
	const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) });
	const granted = (t.scope ?? '').split(' ');
	if (!t.refresh_token || !SCOPES.every((x) => granted.includes(x))) {
		throw new GoogleError(400, 'Hausfrieden needs both calendar permissions. Connect again and leave them ticked.');
	}
	const cals = await writableCalendars(t.access_token);
	const primary = cals.find((c) => c.primary) ?? cals[0];
	if (!primary) throw new GoogleError(400, 'That Google account has no calendar to write to.');

	const m = await db.query.members.findFirst({ where: and(eq(members.id, s.memberId), eq(members.familyId, s.familyId)) });
	if (!m || !m.userId || m.kind !== 'adult') throw new GoogleError(403, 'Only grown-ups with their own login can connect a calendar.');

	const fields = {
		email: primary.id,
		refreshToken: await seal(t.refresh_token),
		calendarId: primary.id,
		calendarName: primary.name,
		timeZone: primary.timeZone,
		lastError: null
	};
	await db
		.insert(calendarLinks)
		.values({ memberId: m.id, familyId: s.familyId, ...fields, onlyMine: false, createdAt: Date.now() })
		.onConflictDoUpdate({ target: calendarLinks.memberId, set: fields });
	tokenCache.set(m.id, { token: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 });
}

/* ---------- family event → Google event ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (ymd: string) => Date.parse(ymd + 'T00:00:00Z');
const addDays = (ymd: string, n: number) => new Date(utc(ymd) + n * 86_400_000).toISOString().slice(0, 10);
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** The UTC instant of a wall-clock time in a zone. */
function zonedToUtc(ymd: string, hms: string, timeZone: string) {
	const guess = Date.parse(`${ymd}T${hms}Z`);
	try {
		const p = Object.fromEntries(
			new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
				.formatToParts(guess)
				.map((x) => [x.type, x.value])
		);
		return guess - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - guess);
	} catch {
		return guess;
	}
}

/** Google event ids are base32hex; hashing also keeps client-chosen ids from colliding with anything. */
async function googleId(eventId: string) {
	const hash = await crypto.subtle.digest('SHA-256', enc.encode('hausfrieden:' + eventId));
	return 'hf' + Array.from(new Uint8Array(hash).slice(0, 20), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The first day the event actually happens: a weekly event starts on its first matching weekday. */
function firstDay(e: EventRow) {
	if (!e.repeat?.length) return e.date;
	for (let i = 0; i < 7; i++) {
		const d = addDays(e.date, i);
		if (e.repeat.includes(new Date(utc(d)).getUTCDay())) return d;
	}
	return e.date;
}

/** Null when the event has no occurrences (a repeat that ends before it starts). */
export function toGoogleEvent(e: EventRow, names: Map<string, string>, timeZone: string) {
	const first = firstDay(e);
	const rep = !!e.repeat?.length;
	if (rep && e.until && e.until < first) return null;

	let start, end;
	if (e.time) {
		// the app has no end time; an hour is the calendar default
		const endAt = new Date(Date.parse(`${first}T${e.time}:00Z`) + 3_600_000).toISOString().slice(0, 19);
		start = { dateTime: `${first}T${e.time}:00`, timeZone, date: null };
		end = { dateTime: endAt, timeZone, date: null };
	} else {
		start = { date: first, dateTime: null, timeZone: null };
		end = { date: addDays(first, 1), dateTime: null, timeZone: null };
	}

	let recurrence: string[] | null = null;
	if (rep) {
		let rule = `RRULE:FREQ=WEEKLY;BYDAY=${e.repeat!.map((d) => BYDAY[d]).join(',')}`;
		if (e.until) {
			// all-day rules end on a date; timed ones need the end of that day as a UTC instant
			const d = new Date(zonedToUtc(e.until, '23:59:59', timeZone));
			rule += e.time
				? `;UNTIL=${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
				: `;UNTIL=${e.until.replace(/-/g, '')}`;
		}
		recurrence = [rule];
	}

	const who = e.who === 'all' ? [] : e.who.map((id) => names.get(id)).filter(Boolean);
	return {
		summary: `${kindOf(e.kind)[1]} ${e.title}`,
		description: [e.note, who.length ? `For ${who.join(', ')}` : '', 'From Hausfrieden'].filter(Boolean).join('\n'),
		start,
		end,
		recurrence,
		// restores it if it was deleted in Google
		status: 'confirmed'
	};
}

const wants = (link: CalendarLink, e: EventRow) => !link.onlyMine || e.who === 'all' || e.who.includes(link.memberId);

/** Still to come (with a day of slack for time zones)? Finished events aren't pushed when syncing everything. */
function upcoming(e: EventRow) {
	const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
	return e.repeat?.length ? !e.until || e.until >= today : e.date >= today;
}

/** Makes one calendar match one family event (`e` is null once it has been deleted). */
async function reconcile(token: string, link: CalendarLink, eventId: string, e: EventRow | null | undefined, names: Map<string, string>) {
	const path = `/calendars/${encodeURIComponent(link.calendarId)}/events`;
	const gid = await googleId(eventId);
	const body = e && wants(link, e) ? toGoogleEvent(e, names, link.timeZone) : null;
	if (!body) {
		const res = await gfetch(token, `${path}/${gid}?sendUpdates=none`, { method: 'DELETE' });
		if (!res.ok && res.status !== 404 && res.status !== 410) await fail(res);
		return;
	}
	// PATCH leaves alone what people changed in Google (reminders, colour, location…)
	let res = await gfetch(token, `${path}/${gid}?sendUpdates=none`, { method: 'PATCH', body });
	if (res.status === 404) {
		res = await gfetch(token, `${path}?sendUpdates=none`, { method: 'POST', body: { id: gid, ...body } });
		// another device saved the same event at the same moment
		if (res.status === 409) res = await gfetch(token, `${path}/${gid}?sendUpdates=none`, { method: 'PATCH', body });
	}
	if (!res.ok) await fail(res);
}

/** Runs `fn` with a fresh access token and records on the link whether it worked. */
async function withLink<T>(db: DB, link: CalendarLink, fn: (token: string) => Promise<T>): Promise<T> {
	const where = and(eq(calendarLinks.memberId, link.memberId), eq(calendarLinks.familyId, link.familyId));
	try {
		const out = await fn(await accessToken(link));
		if (link.lastError) await db.update(calendarLinks).set({ lastError: null }).where(where);
		return out;
	} catch (err) {
		const msg = (err instanceof GoogleError ? err.message : 'Couldn’t reach Google Calendar.').slice(0, 200);
		console.error('google calendar:', link.memberId, err);
		tokenCache.delete(link.memberId);
		await db.update(calendarLinks).set({ lastError: msg }).where(where).catch(() => {});
		throw new GoogleError(err instanceof GoogleError ? err.status : 502, msg);
	}
}

const memberNames = async (db: DB, familyId: string) =>
	new Map((await db.select({ id: members.id, name: members.name }).from(members).where(eq(members.familyId, familyId))).map((m) => [m.id, m.name]));

/**
 * Pushes one saved or deleted family event to every connected grown-up's calendar.
 * Runs after the response (waitUntil) and never throws; failures show up as `lastError` in the profile sheet.
 */
export async function pushEvent(db: DB, familyId: string, eventId: string) {
	try {
		if (!googleConfigured()) return;
		const links = await db
			.select({ link: calendarLinks })
			.from(calendarLinks)
			.innerJoin(members, eq(members.id, calendarLinks.memberId))
			.where(and(eq(calendarLinks.familyId, familyId), eq(members.kind, 'adult')));
		if (!links.length) return;
		const [e, names] = await Promise.all([
			db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.familyId, familyId)) }),
			memberNames(db, familyId)
		]);
		await Promise.allSettled(links.map(({ link }) => withLink(db, link, (token) => reconcile(token, link, eventId, e, names))));
	} catch (err) {
		console.error('google calendar push failed', err);
	}
}

export async function getLink(db: DB, familyId: string, memberId: string) {
	return db.query.calendarLinks.findFirst({ where: and(eq(calendarLinks.memberId, memberId), eq(calendarLinks.familyId, familyId)) });
}

async function requireLink(db: DB, familyId: string, memberId: string) {
	const link = await getLink(db, familyId, memberId);
	if (!link) error(400, 'Connect Google Calendar first');
	return link;
}

/** For the profile sheet. A failed calendar listing just comes back empty, with the reason in `lastError`. */
export async function calendarsFor(db: DB, link: CalendarLink) {
	try {
		return (await withLink(db, link, writableCalendars)).map(({ id, name }) => ({ id, name }));
	} catch {
		return [];
	}
}

/** Changes the target calendar and filter. Returns the calendar used before, so the client can move events across. */
export async function configure(db: DB, familyId: string, memberId: string, input: { calendarId: string; onlyMine: boolean }) {
	const link = await requireLink(db, familyId, memberId);
	const cal = (await run(db, link, writableCalendars)).find((c) => c.id === input.calendarId);
	if (!cal) error(400, 'Pick a calendar you can add events to');
	await db
		.update(calendarLinks)
		.set({ calendarId: cal.id, calendarName: cal.name, timeZone: cal.timeZone, onlyMine: input.onlyMine })
		.where(and(eq(calendarLinks.memberId, memberId), eq(calendarLinks.familyId, familyId)));
	return { from: link.calendarId };
}

/**
 * Pushes one chunk of the family's events to this member's calendar. `from` is the calendar they were
 * pushed to before a switch: events found there are moved rather than duplicated.
 */
export async function syncChunk(db: DB, familyId: string, memberId: string, offset: number, from?: string) {
	const link = await requireLink(db, familyId, memberId);
	const [all, names] = await Promise.all([
		db.select().from(events).where(eq(events.familyId, familyId)).orderBy(asc(events.createdAt), asc(events.id)),
		memberNames(db, familyId)
	]);
	const chunk = all.slice(offset, offset + CHUNK);
	await run(db, link, async (token) => {
		const results = await Promise.allSettled(
			chunk.map(async (e) => {
				let moved = false;
				if (from && from !== link.calendarId) {
					const q = new URLSearchParams({ destination: link.calendarId, sendUpdates: 'none' });
					const res = await gfetch(token, `/calendars/${encodeURIComponent(from)}/events/${await googleId(e.id)}/move?${q}`, { method: 'POST' });
					moved = res.ok;
				}
				if (moved || upcoming(e)) await reconcile(token, link, e.id, e, names);
			})
		);
		const bad = results.find((r) => r.status === 'rejected');
		if (bad) throw bad.reason;
	});
	return { next: offset + CHUNK < all.length ? offset + CHUNK : null };
}

/** Removes the connection. Events already in the calendar stay there. */
export async function disconnect(db: DB, familyId: string, memberId: string) {
	const link = await getLink(db, familyId, memberId);
	if (!link) return;
	try {
		const token = await unseal(link.refreshToken);
		await fetch('https://oauth2.googleapis.com/revoke', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ token })
		});
	} catch {
		/* already revoked or unreachable: forget it locally anyway */
	}
	tokenCache.delete(memberId);
	await db.delete(calendarLinks).where(and(eq(calendarLinks.memberId, memberId), eq(calendarLinks.familyId, familyId)));
}

/** `withLink`, with failures turned into an HTTP error the client can show. */
async function run<T>(db: DB, link: CalendarLink, fn: (token: string) => Promise<T>): Promise<T> {
	try {
		return await withLink(db, link, fn);
	} catch (err) {
		error(502, err instanceof Error ? err.message : 'Couldn’t reach Google Calendar.');
	}
}

export { GoogleError };
