import { createAuthClient } from 'better-auth/svelte';

// Same-origin: better-auth's handler is mounted at /api/auth by hooks.server.ts.
export const authClient = createAuthClient();
