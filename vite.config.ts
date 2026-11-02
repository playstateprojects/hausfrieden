import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// `vite build` → Cloudflare Worker (web app + API).
// `vite build --mode native` → static SPA in build-native/ for Capacitor; it calls the deployed API
// (VITE_API_BASE from .env.native). Run it via `npm run cap:sync`.
export default defineConfig(({ mode }) => ({
	// the server code can't import the Workers runtime outside a Worker (it never runs in the app anyway)
	resolve:
		mode === 'native'
			? { alias: { 'cloudflare:workers': fileURLToPath(new URL('./native/cloudflare-workers.stub.ts', import.meta.url)) } }
			: undefined,
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter:
				mode === 'native'
					? adapterStatic({ pages: 'build-native', assets: 'build-native', fallback: 'index.html' })
					: adapterCloudflare()
		})
	]
}));
