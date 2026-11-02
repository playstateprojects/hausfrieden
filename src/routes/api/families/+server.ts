import { error } from '@sveltejs/kit';
import { createFamily } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { createFamily as create } from '#lib/server/family.ts';
import { parseBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** Create a new family; the signed-in user becomes its admin. The client remembers which family is active. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const input = await parseBody(request, createFamily);
	const familyId = await create(getDb(), locals.user.id, input);
	return Response.json({ ok: true, familyId });
};
