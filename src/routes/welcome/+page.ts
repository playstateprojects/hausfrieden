import { redirect } from '@sveltejs/kit';
import { getJson } from '#lib/client/api.ts';
import type { Me } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const { res, data } = await getJson<Me>('/api/me');
	if (res.status === 401) redirect(303, '/login');
	return { userName: data.user.name, hasFamily: data.families.length > 0 };
};
