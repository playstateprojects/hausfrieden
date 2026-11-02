// Native (Capacitor) builds only: SvelteKit still bundles src/**/server code, which imports
// `cloudflare:workers`. That code never runs inside the app (the API lives on the deployed Worker),
// so this stub just lets the bundle resolve. See vite.config.ts.
export const env = {} as Record<string, never>;
