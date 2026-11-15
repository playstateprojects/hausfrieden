<script lang="ts">
	import { IS_NATIVE, api } from '#lib/client/api.ts';
	import { getApp } from '#lib/client/app.svelte.ts';
	import { EMOJIS, SWATCHES } from '#lib/constants.ts';
	import type { CalendarStatus } from '#lib/types.ts';
	import Sheet from './Sheet.svelte';

	let { id }: { id: string } = $props();
	const app = getApp();
	const h = app.house;
	// svelte-ignore state_referenced_locally
	const p = h.person(id)!;
	// svelte-ignore state_referenced_locally
	const pid = id;
	let name = $state(p.name);
	let emoji = $state(p.emoji);
	let custom = $state('');
	let color = $state(p.color);
	const s = h.streak(pid);

	/* ---------- Google Calendar: only on your own profile (the login), and only for grown-ups ---------- */
	const canSync = pid === app.s.myMemberId && p.kind === 'adult';
	const gpath = `/api/f/${app.familyId}/google`;
	/** Set while the Google consent screen is open, so the first sync runs once we're back and connected. */
	const PENDING = 'hf_gcal_pending';
	let cal = $state<CalendarStatus | null>(null);
	let busy = $state('');

	async function gpost<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
		const res = await api(gpath, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
		const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
		if (!res.ok || !data) throw new Error(data?.message ?? 'Couldn’t reach the server.');
		return data;
	}
	async function loadCal() {
		try {
			const res = await api(gpath);
			if (res.ok) cal = await res.json();
		} catch {
			/* offline: leave the section as it is */
		}
		if (cal?.link && localStorage.getItem(PENDING)) {
			localStorage.removeItem(PENDING);
			await syncCal();
		}
	}
	async function connectCal() {
		busy = 'Opening Google…';
		try {
			const { url } = await gpost<{ url: string }>({ action: 'start', native: IS_NATIVE });
			localStorage.setItem(PENDING, '1');
			// in the apps this opens the system browser (Google refuses to sign in inside a webview)
			location.href = url;
			if (IS_NATIVE) busy = '';
		} catch (e) {
			busy = '';
			app.showToast((e as Error).message);
		}
	}
	/** Pushes every upcoming event, a chunk per request. `from` = the calendar they were in before. */
	async function syncCal(from?: string) {
		busy = 'Syncing…';
		try {
			let offset: number | null = 0;
			while (offset !== null) offset = (await gpost<{ next: number | null }>({ action: 'sync', offset, from })).next;
			app.showToast('📅 Google Calendar is up to date');
		} catch (e) {
			app.showToast((e as Error).message);
		}
		busy = '';
		await loadCal();
	}
	async function configCal(change: { calendarId?: string; onlyMine?: boolean }) {
		const link = cal?.link;
		if (!link || busy) return;
		busy = 'Saving…';
		try {
			const { from } = await gpost<{ from: string }>({ action: 'config', calendarId: link.calendarId, onlyMine: link.onlyMine, ...change });
			await syncCal(from);
		} catch (e) {
			busy = '';
			app.showToast((e as Error).message);
			await loadCal();
		}
	}
	async function disconnectCal() {
		busy = 'Disconnecting…';
		try {
			await gpost({ action: 'disconnect' });
			app.showToast('Google Calendar disconnected');
		} catch (e) {
			app.showToast((e as Error).message);
		}
		busy = '';
		await loadCal();
	}
	$effect(() => {
		if (!canSync) return;
		loadCal();
		// coming back from the consent screen in the system browser (native)
		const onVis = () => {
			if (document.visibilityState === 'visible' && !busy) loadCal();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	});

	async function save() {
		const nm = name.trim();
		if (!nm) return;
		const em = custom.trim() || emoji;
		app.sheet = null;
		Object.assign(p, { name: nm, emoji: em, color });
		if (await app.send({ op: 'member.profile', id: pid, name: nm, emoji: em, color })) app.showToast('Looking good!');
	}
</script>

<Sheet>
	<div class="center">
		<div style="display:inline-grid;place-items:center;width:84px;height:84px;border-radius:50%;font-size:44px;background:{color}">{custom.trim() || emoji}</div>
		<p class="sub" style="margin:8px 0 0">{s ? `🔥 ${s}-day streak · ` : ''}{h.balance(pid)} points to spend</p>
	</div>
	<label class="field mt"><span>Name</span><input bind:value={name} /></label>
	<div class="field">
		<span>Pick your emoji</span>
		<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
			{#each EMOJIS as e (e)}
				<button type="button" onclick={() => (emoji = e)} style="font-size:24px;padding:6px 0;border-radius:10px;{e === emoji && !custom.trim() ? 'background:var(--accent-soft)' : ''}">{e}</button>
			{/each}
		</div>
		<input bind:value={custom} placeholder="…or type/paste any emoji" maxlength="4" style="margin-top:8px" />
	</div>
	<div class="field">
		<span>Colour</span>
		<div class="chips">
			{#each SWATCHES as c (c)}
				<button type="button" aria-label={c} onclick={() => (color = c)} style="width:34px;height:34px;border-radius:50%;background:{c};border:3px solid {c === color ? 'var(--accent)' : 'transparent'}"></button>
			{/each}
		</div>
	</div>
	{#if canSync && cal?.available}
		{@const link = cal.link}
		<div class="field">
			<span>📅 Google Calendar</span>
			{#if !link}
				<p class="sub" style="margin:0 0 10px">Put the family’s events in your Google Calendar. New and changed events are added automatically.</p>
				<button type="button" class="btn ghost block" disabled={!!busy} onclick={connectCal}>{busy || 'Connect Google Calendar'}</button>
			{:else}
				<p class="sub" style="margin:0 0 10px">Connected as <b>{link.email}</b>. Events are copied to:</p>
				<select value={link.calendarId} disabled={!!busy} onchange={(e) => configCal({ calendarId: e.currentTarget.value })}>
					{#each cal.calendars.some((c) => c.id === link.calendarId) ? cal.calendars : [{ id: link.calendarId, name: link.calendarName }, ...cal.calendars] as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
				<div class="chips" style="margin-top:10px">
					<button type="button" class="chip" class:on={!link.onlyMine} disabled={!!busy} onclick={() => link.onlyMine && configCal({ onlyMine: false })}>All family events</button>
					<button type="button" class="chip" class:on={link.onlyMine} disabled={!!busy} onclick={() => !link.onlyMine && configCal({ onlyMine: true })}>Only mine</button>
				</div>
				{#if link.lastError && !busy}<p class="err" style="margin:10px 0 0">Last sync failed: {link.lastError}</p>{/if}
				<div class="gap" style="margin-top:10px">
					<button type="button" class="btn ghost" disabled={!!busy} onclick={() => syncCal()}>{busy || 'Sync now'}</button>
					<button type="button" class="btn danger" disabled={!!busy} onclick={disconnectCal}>Disconnect</button>
				</div>
				<p class="sub" style="margin:8px 0 0;font-size:13px">One way: changes made in Google aren’t copied back. Disconnecting leaves the events in your calendar.</p>
			{/if}
		</div>
	{/if}
	<div class="gap">
		<button class="btn ghost" onclick={() => { app.sheet = null; app.pickMe(null); }}>Switch person</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
