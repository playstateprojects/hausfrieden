import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from 'cloudflare:workers';
import { getDb, schema } from './db/index.ts';
import { sendEmail } from './email.ts';
import { NATIVE_ORIGINS } from './http.ts';
import { hashPassword, verifyPassword } from './password.ts';

function build(baseURL: string) {
	return betterAuth({
		appName: 'Hausfrieden',
		baseURL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: NATIVE_ORIGINS,
		database: drizzleAdapter(getDb(), {
			provider: 'sqlite',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification
			}
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			sendResetPassword: async ({ user, url }) => {
				await sendEmail(user.email, 'Reset your Hausfrieden password', `Reset your password:\n\n${url}`);
			},
			password: {
				hash: hashPassword,
				verify: ({ hash, password }) => verifyPassword(hash, password)
			}
		},
		emailVerification: {
			sendOnSignUp: true,
			sendVerificationEmail: async ({ user, url }) => {
				await sendEmail(user.email, 'Verify your Hausfrieden email', `Confirm your email address:\n\n${url}`);
			}
		},
		session: {
			expiresIn: 60 * 60 * 24 * 90, // 90 days — it's a family app on shared devices
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		},
		// bearer: the native apps send the session token as `Authorization: Bearer …` instead of a cookie
		// sveltekitCookies must be last
		plugins: [bearer(), sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof build>;

// One instance per origin, so production and Pages preview URLs both work.
const cache = new Map<string, Auth>();
export function getAuth(origin: string): Auth {
	let auth = cache.get(origin);
	if (!auth) {
		auth = build(origin);
		cache.set(origin, auth);
	}
	return auth;
}
