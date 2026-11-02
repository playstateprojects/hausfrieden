import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { joinFamily as joinInput } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { members } from '#lib/server/db/schema.ts';
import { familyByCode, joinFamily, unlinkedMembers } from '#lib/server/family.ts';
import { parseBody } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** What the join screen needs: the family name and who can still be claimed. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const db = getDb();
	const family = await familyByCode(db, params.code);
	const already = await db.query.members.findFirst({
		where: and(eq(members.familyId, family.id), eq(members.userId, locals.user.id))
	});
	if (already) return Response.json({ already: true, familyId: family.id });
	return Response.json({
		already: false,
		family: { name: family.name },
		unlinked: await unlinkedMembers(db, family.id),
		userName: locals.user.name
	});
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const db = getDb();
	const family = await familyByCode(db, params.code);
	const input = await parseBody(request, joinInput);
	await joinFamily(db, family.id, locals.user.id, input);
	return Response.json({ ok: true, familyId: family.id });
};
