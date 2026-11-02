import { redirect } from '@sveltejs/kit';
import { api } from '#lib/client/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const next = url.searchParams.get('next');
	const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
	// already signed in? skip the form. (offline just shows the form)
	const res = await api('/api/me').catch(() => null);
	if (res?.ok) redirect(303, safeNext);
	return { next: safeNext };
};
