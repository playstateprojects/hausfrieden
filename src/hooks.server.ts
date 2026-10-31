import { building } from '$app/env';
import { getAuth } from '#lib/server/auth.ts';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const auth = getAuth(event.url.origin);
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
};
