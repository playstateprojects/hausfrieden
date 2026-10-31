import { error } from '@sveltejs/kit';
import { op } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { requireMembership } from '#lib/server/family.ts';
import { parseBody } from '#lib/server/http.ts';
import { applyOp } from '#lib/server/ops.ts';
import type { RequestHandler } from './$types';

/** All mutations for a family: POST one op (see #lib/schemas.ts → `op`). */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const db = getDb();
	const me = await requireMembership(db, params.fid, locals.user.id);
	const body = await parseBody(request, op);
	const result = await applyOp(db, { familyId: params.fid, memberId: me.id, role: me.role }, body);
	return Response.json({ ok: true, ...result });
};
