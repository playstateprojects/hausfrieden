<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { MONTHS } from '#lib/constants.ts';
	import { ago } from '#lib/logic.ts';
	import Avatar from '../Avatar.svelte';
	import ChampionCard from '../ChampionCard.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const rows = $derived(
		app.s.members.map((p) => ({ p, w: h.monthPts(p.id), s: h.streak(p.id) })).sort((a, b) => b.w - a.w)
	);
	const max = $derived(Math.max(1, ...rows.map((r) => r.w)));
	const lead = $derived(rows[0] && rows[0].w > 0 ? rows[0].w : -1);
	const f = $derived(app.s.family);
	const dl = $derived(h.daysLeftInMonth());
	const firstRace = $derived(
		f.champStart > h.monthStart(0)
			? `The first race starts ${MONTHS[new Date(f.champStart).getMonth()]} 1st — this month is a practice round.`
			: `${dl} day${dl === 1 ? '' : 's'} left. Most points on the last day wins.`
	);
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
<ChampionCard force />
<div class="card" style="background:var(--warm-soft)">
	<div class="row-between">
		<b>🏆 {MONTHS[new Date(app.now).getMonth()]} race</b>
		<button onclick={() => (app.sheet = { kind: 'goal' })} style="color:var(--accent);font-weight:800;font-size:13px">✏️ Change prize</button>
	</div>
	<p class="sub" style="margin:6px 0 0">The winner gets: <b style="color:var(--ink)">{f.monthPrize || 'the big treat'}</b><br />{firstRace}</p>
</div>
<div class="card">
	{#each rows as { p, w, s } (p.id)}
		<div class="lb-row">
			<Avatar {p} />
			<div style="flex:1">
				<div class="row-between" style="font-weight:700;font-size:14.5px;margin-bottom:5px">
					<span>{w === lead ? '👑 ' : ''}{p.name}</span><span style="color:var(--muted);font-size:12.5px">{s ? '🔥 ' + s + '-day streak' : ''}</span>
				</div>
				<div class="bar"><i style="width:{Math.round((w / max) * 100)}%;background:var(--warm)"></i></div>
			</div>
			<span class="n">{w}</span>
		</div>
	{/each}
	{#if f.adultRate < 1 && app.s.members.some((p) => p.kind === 'adult')}
		<p class="sub" style="margin:10px 0 0;font-size:13px">
			⚖️ Fair play: grown-ups earn {f.adultRate === 0.5 ? 'half' : Math.round(f.adultRate * 100) + '% of'} the points (max {f.adultCap} a task), so everyone has a real chance.
		</p>
	{/if}
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
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'goal' })}>Goals & prizes</button>
</div>
<div class="gap mt">
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'alarms' })}>⏰ Alarms</button>
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'meds' })}>💊 Medicines</button>
</div>
<button class="btn ghost block mt" onclick={() => (app.sheet = { kind: 'medlog' })}>📋 Medicine log</button>
{#if h.isAdult(app.me!)}
	<button class="btn ghost block mt" onclick={() => app.openFix()}>🕓 Fix yesterday in the calendar</button>
{/if}
<div class="gap mt">
	<button class="btn ghost" onclick={() => (app.sheet = { kind: 'home' })}>Invite, homes & account</button>
</div>
<p class="note">☁️ Synced — everyone in {app.s.family.name} sees the same list.</p>
