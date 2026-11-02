import { createAuthClient } from 'better-auth/svelte';
import { API_BASE, IS_NATIVE, getToken, setToken } from './api.ts';

// Web: same-origin, cookie session (better-auth's handler is mounted at /api/auth by hooks.server.ts).
// Native: cross-origin to the deployed app, so the session travels as a bearer token instead.
export const authClient = createAuthClient({
	baseURL: API_BASE || undefined,
	fetchOptions: IS_NATIVE
		? {
				auth: { type: 'Bearer', token: () => getToken() ?? '' },
				onSuccess: (ctx) => {
					const token = ctx.response.headers.get('set-auth-token');
					if (token) setToken(token);
				}
			}
		: {}
});

export async function signOut() {
	await authClient.signOut();
	setToken(null);
}
