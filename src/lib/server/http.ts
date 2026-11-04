import { error } from '@sveltejs/kit';
import type { z } from 'zod';

/** Parses a JSON request body with a zod schema, or throws a 400 with a readable message. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	const res = schema.safeParse(raw);
	if (!res.success) {
		const issue = res.error.issues[0];
		error(400, issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request');
	}
	return res.data;
}

/** Origins of the Capacitor webviews (iOS, Android) and local dev, which call the API cross-origin. */
export const NATIVE_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

export function corsHeaders(origin: string): Record<string, string> {
	return {
		'access-control-allow-origin': origin,
		// the better-auth client always fetches with credentials: 'include', which browsers only allow
		// when the response says so (the origin is echoed back from an allowlist, never '*')
		'access-control-allow-credentials': 'true',
		'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'access-control-allow-headers': 'content-type, authorization',
		// the bearer plugin returns the session token in this header on sign-in
		'access-control-expose-headers': 'set-auth-token',
		'access-control-max-age': '86400',
		vary: 'Origin'
	};
}
