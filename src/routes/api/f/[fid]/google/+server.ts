import { error } from '@sveltejs/kit';
import { calendarAction } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { requireMembership } from '#lib/server/family.ts';
import { calendarsFor, configure, consentUrl, disconnect, getLink, googleConfigured, syncChunk } from '#lib/server/google.ts';
import { parseBody } from '#lib/server/http.ts';
import type { CalendarStatus } from '#lib/types.ts';
import type { RequestHandler } from './$types';

/*
 * The signed-in grown-up's own Google Calendar connection in this family (see #lib/server/google.ts).
 * Not an op on /api/f/[fid]: it is per login rather than family data, and it talks to Google.
 */

/** Connection status, plus the calendars to choose from once connected. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const db = getDb();
	const me = await requireMembership(db, params.fid, locals.user.id);
	const link = await getLink(db, params.fid, me.id);
	const calendars = link && googleConfigured() ? await calendarsFor(db, link) : [];
	// re-read: listing the calendars may have set or cleared lastError
	const now = link ? await getLink(db, params.fid, me.id) : null;
	const status: CalendarStatus = {
		available: googleConfigured() && me.kind === 'adult',
		link: now ? { email: now.email, calendarId: now.calendarId, calendarName: now.calendarName, onlyMine: now.onlyMine, lastError: now.lastError } : null,
		calendars
	};
	return Response.json(status, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request, params, locals, url }) => {
	if (!locals.user) error(401, 'Sign in first');
	const db = getDb();
	const me = await requireMembership(db, params.fid, locals.user.id);
	const body = await parseBody(request, calendarAction);
	if (body.action === 'disconnect') {
		await disconnect(db, params.fid, me.id);
		return Response.json({ ok: true });
	}
	if (!googleConfigured()) error(400, 'Google Calendar isn’t set up on this server');
	if (me.kind !== 'adult') error(403, 'Only grown-ups can connect a calendar');

	switch (body.action) {
		case 'start':
			return Response.json({ ok: true, url: await consentUrl(url.origin, { familyId: params.fid, memberId: me.id, native: body.native }) });
		case 'config':
			return Response.json({ ok: true, ...(await configure(db, params.fid, me.id, body)) });
		case 'sync':
			return Response.json({ ok: true, ...(await syncChunk(db, params.fid, me.id, body.offset, body.from)) });
	}
};
