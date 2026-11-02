import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { familiesForUser, loadFamilyState } from '#lib/server/family.ts';
import type { RequestHandler } from './$types';

/**
 * Everything the app needs to render: the user, their families, and the full state of one family.
 * `?family=<id>` picks which one (the client remembers it); falls back to the first.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { id, name, email } = locals.user;
	const db = getDb();
	const mine = await familiesForUser(db, id);
	const head = { user: { id, name, email }, families: mine.map((f) => ({ id: f.id, name: f.name })) };
	const noStore = { 'cache-control': 'no-store' };
	if (!mine.length) return Response.json({ ...head, state: null }, { headers: noStore });

	const wanted = url.searchParams.get('family');
	const current = mine.find((f) => f.id === wanted) ?? mine[0];
	return Response.json({ ...head, state: await loadFamilyState(db, current.id, current.memberId) }, { headers: noStore });
};
