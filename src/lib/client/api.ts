import { error } from '@sveltejs/kit';

/**
 * Where the API lives. Empty on the web (same origin, cookie session). The native build sets
 * VITE_API_BASE (see .env.native) to the deployed web app, and authenticates with a bearer token.
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
export const IS_NATIVE = API_BASE !== '';

const TOKEN_KEY = 'hf_token';
export const getToken = () => {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
};
export const setToken = (t: string | null) => {
	try {
		if (t) localStorage.setItem(TOKEN_KEY, t);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		/* private mode */
	}
};

export function api(path: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	const token = IS_NATIVE ? getToken() : null;
	if (token) headers.set('authorization', `Bearer ${token}`);
	return fetch(API_BASE + path, { ...init, headers });
}

/** For `load` functions: GET JSON, turning a network failure into a friendly error page. */
export async function getJson<T = any>(path: string): Promise<{ res: Response; data: T }> {
	let res: Response;
	try {
		res = await api(path);
	} catch {
		error(503, 'Can’t reach Hausfrieden. Check your connection and try again.');
	}
	const data = (await res.json().catch(() => null)) as T;
	return { res, data };
}
