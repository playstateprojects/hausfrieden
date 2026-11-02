import { redirect } from '@sveltejs/kit';
import { getJson } from '#lib/client/api.ts';
import { lsGet } from '#lib/client/app.svelte.ts';
import type { Bootstrap, FamilyState } from '#lib/types.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	const { res, data } = await getJson<Bootstrap>(`/api/bootstrap?family=${encodeURIComponent(lsGet('hf_family') ?? '')}`);
	if (res.status === 401) redirect(303, '/login');
	if (!data?.state) redirect(303, '/welcome');
	// later refreshes happen inside AppState (so a flaky connection never replaces the screen with an error)
	return { user: data.user, families: data.families, state: data.state as FamilyState };
};
