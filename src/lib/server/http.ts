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

export const FAMILY_COOKIE = 'hf_family';
export const familyCookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 365 };
