import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { familiesForUser } from '#lib/server/family.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const mine = await familiesForUser(getDb(), locals.user.id);
	return { userName: locals.user.name, hasFamily: mine.length > 0 };
};
