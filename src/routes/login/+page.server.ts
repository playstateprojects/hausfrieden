import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const next = url.searchParams.get('next');
	const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
	if (locals.user) redirect(303, safeNext);
	return { next: safeNext };
};
