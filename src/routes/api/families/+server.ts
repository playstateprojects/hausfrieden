import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { createFamily, id } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { createFamily as create, requireMembership } from '#lib/server/family.ts';
import { FAMILY_COOKIE, familyCookieOpts, parseBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** Create a new family (the signed-in user becomes its admin) and switch to it. */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) error(401, 'Sign in first');
	const input = await parseBody(request, createFamily);
	const familyId = await create(getDb(), locals.user.id, input);
	cookies.set(FAMILY_COOKIE, familyId, familyCookieOpts);
	return Response.json({ ok: true, familyId });
};

/** Switch the active family. */
export const PUT: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { familyId } = await parseBody(request, z.object({ familyId: id }));
	await requireMembership(getDb(), familyId, locals.user.id);
	cookies.set(FAMILY_COOKIE, familyId, familyCookieOpts);
	return Response.json({ ok: true });
};
