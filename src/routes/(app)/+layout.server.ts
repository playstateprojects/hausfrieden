import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { familiesForUser, loadFamilyState } from '#lib/server/family.ts';
import { FAMILY_COOKIE } from '#lib/server/http.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('app:family');
	if (!locals.user) redirect(303, '/login');

	const db = getDb();
	const mine = await familiesForUser(db, locals.user.id);
	if (!mine.length) redirect(303, '/welcome');

	const wanted = cookies.get(FAMILY_COOKIE);
	const current = mine.find((f) => f.id === wanted) ?? mine[0];

	return {
		user: { id: locals.user.id, name: locals.user.name, email: locals.user.email },
		families: mine.map(({ id, name }) => ({ id, name })),
		state: await loadFamilyState(db, current.id, current.memberId)
	};
};
