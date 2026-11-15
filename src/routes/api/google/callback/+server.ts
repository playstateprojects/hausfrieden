import { getDb } from '#lib/server/db/index.ts';
import { GoogleError, connect, googleConfigured, readState } from '#lib/server/google.ts';
import type { RequestHandler } from './$types';

/**
 * Where Google sends people back after the consent screen. There is no session here when the flow
 * started in a native app (it runs in the system browser), so the signed `state` says who it is for.
 */
export const GET: RequestHandler = async ({ url }) => {
	const state = await readState(url.searchParams.get('state'));
	let problem = '';
	if (!googleConfigured() || !state) problem = 'That link has expired. Go back to Hausfrieden and try again.';
	else if (url.searchParams.get('error')) problem = 'Google Calendar wasn’t connected.';
	else {
		try {
			await connect(getDb(), url.origin, state, url.searchParams.get('code') ?? '');
		} catch (err) {
			console.error('google calendar connect failed', err);
			problem = err instanceof GoogleError ? err.message : 'Couldn’t connect Google Calendar. Try again.';
		}
	}

	// the web app picks the result up from the query string; the native app is in another window
	if (state && !state.native) {
		return new Response(null, { status: 303, headers: { location: problem ? `/?gcal=${encodeURIComponent(problem)}` : '/?gcal=ok' } });
	}
	const esc = (s: string) => s.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hausfrieden</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF6EE;color:#2A2833;font:17px/1.5 system-ui,sans-serif;text-align:center">
<div style="padding:24px;max-width:340px"><div style="font-size:56px">${problem ? '😕' : '📅'}</div>
<h1 style="font-size:22px;margin:8px 0">${problem ? 'Not connected' : 'Google Calendar connected'}</h1>
<p style="margin:0;color:#7C7686">${esc(problem || 'You can close this page and go back to the Hausfrieden app.')}</p></div></body></html>`;
	return new Response(html, { status: problem ? 400 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};
