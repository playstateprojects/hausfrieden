import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { familiesForUser } from '#lib/server/family.ts';
import type { RequestHandler } from './$types';

/** Who is signed in, and which families they belong to. 401 when signed out. */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { id, name, email } = locals.user;
	const mine = await familiesForUser(getDb(), id);
	return Response.json(
		{ user: { id, name, email }, families: mine.map(({ id, name }) => ({ id, name })) },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
