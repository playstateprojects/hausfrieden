import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { PERSON_COLORS } from '#lib/constants.ts';
import { joinFamily } from '#lib/schemas.ts';
import { getDb } from '#lib/server/db/index.ts';
import { families, members } from '#lib/server/db/schema.ts';
import { newId, unlinkedMembers } from '#lib/server/family.ts';
import { FAMILY_COOKIE, familyCookieOpts } from '#lib/server/http.ts';
import type { Actions, PageServerLoad } from './$types';

async function findFamily(code: string) {
	const db = getDb();
	const family = await db.query.families.findFirst({ where: eq(families.inviteCode, code.toUpperCase()) });
	if (!family) error(404, 'That invite code doesn’t match a family. Ask for a fresh link.');
	return { db, family };
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent('/join/' + params.code)}`);
	const { db, family } = await findFamily(params.code);
	const already = await db.query.members.findFirst({
		where: and(eq(members.familyId, family.id), eq(members.userId, locals.user.id))
	});
	if (already) {
		cookies.set(FAMILY_COOKIE, family.id, familyCookieOpts);
		redirect(303, '/');
	}
	return {
		family: { name: family.name },
		unlinked: await unlinkedMembers(db, family.id),
		userName: locals.user.name
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals, cookies }) => {
		if (!locals.user) redirect(303, '/login');
		const { db, family } = await findFamily(params.code);
		const form = Object.fromEntries(await request.formData());
		const parsed = joinFamily.safeParse({
			memberId: form.memberId || undefined,
			name: form.name || undefined,
			emoji: form.emoji || undefined
		});
		if (!parsed.success) return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		const input = parsed.data;

		if (input.memberId) {
			// claim an existing household member that has no login yet
			const res = await db
				.update(members)
				.set({ userId: locals.user.id })
				.where(and(eq(members.id, input.memberId), eq(members.familyId, family.id), isNull(members.userId)))
				.returning({ id: members.id });
			if (!res.length) return fail(400, { message: 'Someone already claimed that person. Pick another or add yourself.' });
		} else {
			if (!input.name) return fail(400, { message: 'Tell us your name' });
			const existing = await db.select({ id: members.id }).from(members).where(eq(members.familyId, family.id));
			await db.insert(members).values({
				id: newId(),
				familyId: family.id,
				userId: locals.user.id,
				name: input.name,
				emoji: input.emoji || '🙂',
				color: PERSON_COLORS[existing.length % PERSON_COLORS.length],
				role: 'member',
				sort: existing.length,
				createdAt: Date.now()
			});
		}
		cookies.set(FAMILY_COOKIE, family.id, familyCookieOpts);
		redirect(303, '/');
	}
};
