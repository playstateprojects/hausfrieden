import { error, redirect } from '@sveltejs/kit';
import { getJson } from '#lib/client/api.ts';
import { lsSet } from '#lib/client/app.svelte.ts';
import type { PageLoad } from './$types';

type Join =
	| { already: true; familyId: string }
	| { already: false; family: { name: string }; unlinked: { id: string; name: string; emoji: string; color: string }[]; userName: string };

export const load: PageLoad = async ({ params }) => {
	const { res, data } = await getJson<Join & { message?: string }>(`/api/join/${encodeURIComponent(params.code)}`);
	if (res.status === 401) redirect(303, `/login?next=${encodeURIComponent('/join/' + params.code)}`);
	if (!res.ok) error(res.status as 404, data?.message ?? 'Couldn’t open that invite');
	if (data.already) {
		lsSet('hf_family', data.familyId);
		redirect(303, '/');
	}
	return data;
};
