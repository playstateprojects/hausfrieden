<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ago } from '#lib/logic.ts';
	import Avatar from '../Avatar.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const rows = $derived(app.s.members.map((p) => ({ p, w: h.weekPts(p.id), s: h.streak(p.id) })));
	const max = $derived(Math.max(1, ...rows.map((r) => r.w)));
	type FeedItem = { k: 'log' | 'spent'; id: string; memberId: string; name: string; at: number; pts?: number; emoji?: string };
	const feed = $derived(
		[
			...app.s.log.map((l): FeedItem => ({ ...l, k: 'log' })),
			...app.s.redemptions.map((x): FeedItem => ({ ...x, k: 'spent' }))
		]
			.sort((a, b) => b.at - a.at)
			.slice(0, 25)
	);
	let confirming = $state<string | null>(null);

	async function del(e: FeedItem) {
		if (confirming !== e.id) {
			confirming = e.id;
			return;
		}
		confirming = null;
		if (e.k === 'log') {
			app.s.log = app.s.log.filter((l) => l.id !== e.id);
			await app.send({ op: 'log.delete', id: e.id });
		} else {
			app.s.redemptions = app.s.redemptions.filter((l) => l.id !== e.id);
			await app.send({ op: 'redemption.delete', id: e.id });
		}
	}
</script>

<h2 class="hello">Family</h2>
<p class="sub">Points this week (resets Monday).</p>
<div class="card">
	{#each rows as { p, w, s } (p.id)}
		<div class="lb-row">
			<Avatar {p} />
			<div style="flex:1">
				<div class="row-between" style="font-weight:700;font-size:14.5px;margin-bottom:5px">
					<span>{p.name}</span><span style="color:var(--muted);font-size:12.5px">{s ? '🔥 ' + s + '-day streak' : ''}</span>
				</div>
				<div class="bar"><i style="width:{Math.round((w / max) * 100)}%;background:var(--warm)"></i></div>
			</div>
			<span class="n">{w}</span>
		</div>
	{/each}
</div>
<div class="gap"><button class="btn warm" onclick={() => (app.sheet = { kind: 'bonus' })}>⭐ Give bonus points</button></div>

<div class="sec-title">Recent activity</div>
<div class="card feed">
	{#each feed as e (e.k + e.id)}
		{@const p = h.person(e.memberId)}
		<div>
			{#if p}<span class="mini-av" style="background:{p.color}">{p.emoji}</span>{/if}
			<span>
				{#if e.k === 'spent'}{p?.name ?? 'Someone'} got {e.emoji} <b>{e.name}</b>
				{:else}{p?.name ?? 'Someone'}: {e.name} <span class="pts">+{e.pts}</span>{/if}
			</span>
			<time>{ago(e.at, app.now)}</time>
			<button
				onclick={() => del(e)}
				aria-label="Remove"
				style="padding:0 4px;{confirming === e.id ? 'color:var(--due);font-weight:800;font-size:12px' : 'color:var(--muted)'}"
				>{confirming === e.id ? 'remove?' : '×'}</button
			>
		</div>
	{:else}
		<div class="empty" style="border:0">Nothing yet. Tick something off!</div>
	{/each}
</div>

<div class="sec-title">Settings</div>
<div class="gap">
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'people' })}>Household</button>
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'goal' })}>Family goal</button>
</div>
<div class="gap mt">
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'home' })}>Invite, homes & account</button>
</div>
<p class="note">☁️ Synced — everyone in {app.s.family.name} sees the same list.</p>
