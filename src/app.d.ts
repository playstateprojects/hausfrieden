// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Auth } from '#lib/server/auth.ts';

type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

declare global {
	interface ImportMetaEnv {
		/** Set only for the native build (.env.native): the deployed web app that serves the API. */
		readonly VITE_API_BASE?: string;
	}

	namespace App {
		interface Locals {
			user: SessionData['user'] | null;
			session: SessionData['session'] | null;
		}
	}
}

export {};
