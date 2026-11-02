import { building } from '$app/env';
import { getAuth } from '#lib/server/auth.ts';
import { NATIVE_ORIGINS, corsHeaders } from '#lib/server/http.ts';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	// The Capacitor apps are served from their own origin and call this API cross-origin.
	const origin = event.request.headers.get('origin');
	const cors = !!origin && NATIVE_ORIGINS.includes(origin) && event.url.pathname.startsWith('/api/');
	if (cors && event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(origin) });
	}

	const auth = getAuth(event.url.origin);
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	const res = await svelteKitHandler({ event, resolve, auth, building });
	if (!cors) return res;
	const out = new Response(res.body, res);
	for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v);
	return out;
};
