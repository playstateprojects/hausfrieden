<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { CATS, MONTHS, WD } from '#lib/constants.ts';
	import type { TodoCat } from '#lib/types.ts';
	import HandRow from '../lists/HandRow.svelte';
	import Shop from '../lists/Shop.svelte';
	import TodoRow from '../lists/TodoRow.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const shopN = $derived(app.s.shopping.filter((x) => !x.done && !x.cleared).length);

	const all = $derived(h.myTodos());
	const today = $derived(h.startOfDay);
	const cat = $derived(app.listCat);
	const inCat = (t: { cat: TodoCat }) => cat === 'all' || t.cat === cat;
	const hin = $derived(h.handIn().filter(inCat));
	const hinOpen = $derived(hin.filter((x) => !x.done));
	const hinDone = $derived(hin.filter((x) => x.done && x.done >= today));
	const hout = $derived(
		h
			.handOut()
			.filter((x) => !x.done || x.done >= today)
			.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.createdAt - b.createdAt)
	);
	const open = $derived(all.filter((t) => !t.done && inCat(t)).sort((a, b) => +b.star - +a.star || a.createdAt - b.createdAt));
	const doneT = $derived(all.filter((t) => t.done && t.done >= today && inCat(t)).sort((a, b) => b.done - a.done));
	const total = $derived(open.length + doneT.length + hinOpen.length + hinDone.length);
	const doneN = $derived(doneT.length + hinDone.length);
	const pct = $derived(total ? doneN / total : 0);
	const c = 2 * Math.PI * 30;
	const d = $derived(new Date(app.now));
	const cnt = (k: TodoCat) => all.filter((t) => !t.done && t.cat === k).length;
	const must = $derived(open.filter((t) => t.star));
	const rest = $derived(open.filter((t) => !t.star));
	const others = $derived(h.otherAdults());
	const fp = $derived(app.tdFor && app.tdFor !== app.me ? h.person(app.tdFor) : undefined);
	const byFrom = $derived.by(() => {
		const o: Record<string, typeof hinOpen> = {};
		for (const x of hinOpen) (o[x.fromId] ??= []).push(x);
		return Object.entries(o);
	});

	let text = $state('');
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const v = text;
		text = '';
		await app.addTodo(v);
	}
	function cycleFor() {
		const opts = [app.me!, ...others.map((p) => p.id)];
		const i = opts.indexOf(app.tdFor ?? app.me!);
		app.tdFor = opts[(i + 1) % opts.length];
	}
	function cycleCat() {
		app.tdCat = app.tdCat === 'work' ? 'personal' : 'work';
	}
</script>

<div class="seg" style="margin:0 0 14px">
	<button class:on={app.listTab !== 'shop'} onclick={() => (app.listTab = 'todo')}>📝 My list</button>
	<button class:on={app.listTab === 'shop'} onclick={() => (app.listTab = 'shop')}>🛒 Shopping{shopN ? ' ' + shopN : ''}</button>
</div>

{#if app.listTab === 'shop'}
	<Shop />
{:else}
	<div class="list-head">
		<svg width="76" height="76" viewBox="0 0 76 76">
			<circle cx="38" cy="38" r="30" fill="none" stroke="#EFE7DA" stroke-width="8" />
			<circle
				cx="38"
				cy="38"
				r="30"
				fill="none"
				stroke={pct >= 1 && total ? 'var(--ok)' : 'var(--accent)'}
				stroke-width="8"
				stroke-linecap="round"
				stroke-dasharray="{(c * pct).toFixed(1)} {c.toFixed(1)}"
				transform="rotate(-90 38 38)"
				style="transition:stroke-dasharray .5s"
			/>
			<text x="38" y="43" text-anchor="middle" font-family="Fraunces,serif" font-weight="700" font-size="17" fill="var(--ink)">{total ? Math.round(pct * 100) + '%' : '—'}</text>
		</svg>
		<div>
			<h2 class="hello" style="margin:0">My list</h2>
			<p class="sub" style="margin:2px 0 0">
				{WD[d.getDay()]}
				{d.getDate()}. {MONTHS[d.getMonth()]} · {total ? (open.length + hinOpen.length ? `${doneN} of ${total} done` : 'All clear ✨') : 'Nothing yet'}
			</p>
		</div>
	</div>
	<form class="quick-add" onsubmit={submit}>
		<input bind:value={text} placeholder="Add something for today…" autocomplete="off" enterkeyhint="done" />
		{#if others.length}
			<button type="button" class="qa-cat" onclick={cycleFor} title="Who is it for?" style="background:{fp ? fp.color : '#F1EADF'};font-size:{fp ? 20 : 13}px;font-weight:800">{fp ? fp.emoji : 'Me'}</button>
		{/if}
		<button type="button" class="qa-cat" onclick={cycleCat} style="background:{CATS[app.tdCat][2]}">{CATS[app.tdCat][0]}</button>
		<button type="submit" class="qa-add" aria-label="Add">+</button>
	</form>
	{#if fp}<p class="sub" style="margin:6px 0 0">Adding to <b style="color:var(--ink)">{fp.name}’s</b> list — they’ll see it under “From {h.person(app.me)?.name}”.</p>{/if}
	<div class="seg" style="margin:12px 0 6px">
		{#each [['all', 'All'], ['work', '💼 Work' + (cnt('work') ? ' ' + cnt('work') : '')], ['personal', '🏡 Personal' + (cnt('personal') ? ' ' + cnt('personal') : '')]] as [k, l] (k)}
			<button class:on={cat === k} onclick={() => (app.listCat = k as 'all' | TodoCat)}>{l}</button>
		{/each}
	</div>
	{#if !total}
		<div class="empty" style="padding-top:30px"><div class="emoji">📝</div>Write down what’s rattling around your head.<br />Tap 💼/🏡 to switch work or personal, ☆ to make it a must-do.</div>
	{/if}
	{#each byFrom as [from, xs] (from)}
		<div class="sec-title">📨 From {h.person(from)?.name ?? 'Someone'} <small>{xs.length}</small></div>
		{#each xs as x (x.id)}<HandRow h={x} incoming />{/each}
	{/each}
	{#if must.length}
		<div class="sec-title">⭐ Must do today <small>{must.length}</small></div>
		{#each must as t (t.id)}<TodoRow {t} />{/each}
	{/if}
	{#if rest.length}
		<div class="sec-title">{must.length ? 'Everything else' : 'To do'} <small>{rest.length}</small></div>
		{#each rest as t (t.id)}<TodoRow {t} />{/each}
	{/if}
	{#if total && !open.length && !hinOpen.length}
		<div class="card center" style="background:var(--accent-soft)">
			<div style="font-size:40px">🎉</div>
			<b style="font-family:Fraunces,serif;font-size:20px">List cleared!</b>
			<p class="sub" style="margin:4px 0 0">Go do something nice for yourself.</p>
		</div>
	{/if}
	{#if doneT.length || hinDone.length}
		<details open={!open.length}>
			<summary class="sec-title">✅ Done today <small>{doneT.length + hinDone.length} ▾</small></summary>
			{#each hinDone as x (x.id)}<HandRow h={x} incoming />{/each}
			{#each doneT as t (t.id)}<TodoRow {t} />{/each}
		</details>
	{/if}
	{#if hout.length}
		<div class="sec-title">📤 You asked <small>{hout.filter((x) => x.done).length}/{hout.length} done</small></div>
		{#each hout as x (x.id)}<HandRow h={x} incoming={false} />{/each}
	{/if}
	<p class="note">🔒 Your own tasks are private. Tasks you send each other live in the shared family space. Unfinished items roll over to tomorrow.</p>
{/if}
