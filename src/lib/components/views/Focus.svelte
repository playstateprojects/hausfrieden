<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { CATS, TIPS } from '#lib/constants.ts';
	import type { Task } from '#lib/types.ts';
	import TaskRow from '../TaskRow.svelte';

	const app = getApp();
	const f = $derived(app.focus);
	const sprint = $derived(app.sprint.map((id) => app.house.task(id)).filter((t): t is Task => !!t));
	const clock = $derived(String(Math.floor(f.left / 60)).padStart(2, '0') + ':' + String(f.left % 60).padStart(2, '0'));
	const sub = $derived(f.running ? 'go go go' : f.left === 0 ? 'time’s up!' : f.left < f.total ? 'paused' : 'ready');
	const ft = $derived.by(() => {
		const t = app.focusTodo ? app.s.todos.find((x) => x.id === app.focusTodo) : undefined;
		return t && !t.done ? t : null;
	});
	const tip = $derived(TIPS[Math.floor(app.now / 36e5) % TIPS.length]);
</script>

<h2 class="hello">Focus timer</h2>
<p class="sub">Set it, start it, stop when it rings.</p>
{#if ft}
	{@const c = CATS[ft.cat] ?? CATS.work}
	<div class="card row-between" style="background:{c[2]}">
		<span style="font-weight:800">{c[0]} {ft.text}</span>
		<button class="chip on" onclick={() => app.doneTodo(ft.id)}>✓ Done</button>
	</div>
{/if}
<div class="chips" style="justify-content:center">
	{#each [5, 10, 15, 25] as m (m)}
		<button class="chip" class:on={f.total === m * 60} onclick={() => !f.running && app.resetFocus(m * 60)}>{m} min</button>
	{/each}
</div>
<div class="ring-wrap">
	<svg width="230" height="230" viewBox="0 0 200 200">
		<circle cx="100" cy="100" r="88" fill="none" stroke="#EFE7DA" stroke-width="12" />
		<circle
			cx="100"
			cy="100"
			r="88"
			fill="none"
			stroke="var(--accent)"
			stroke-width="12"
			stroke-linecap="round"
			transform="rotate(-90 100 100)"
			stroke-dasharray="552.9"
			stroke-dashoffset={552.9 * (1 - f.left / f.total)}
		/>
	</svg>
	<div class="clock"><b>{clock}</b><span>{sub}</span></div>
</div>
<div class="gap">
	{#if f.running}
		<button class="btn ghost" onclick={() => app.pauseFocus()}>Pause</button>
	{:else}
		<button class="btn" onclick={() => app.startFocus()}>{f.left < f.total && f.left > 0 ? 'Resume' : '▶ Start'}</button>
	{/if}
	<button class="btn ghost" onclick={() => app.resetFocus()}>Reset</button>
</div>
<div class="tip">💡 {tip}</div>
{#if sprint.length}
	<div class="sec-title">This sprint <small>{sprint.filter(app.house.doneRecently).length}/{sprint.length} done</small></div>
	{#each sprint as t (t.id)}<TaskRow {t} />{/each}
{:else}
	<p class="note">Tip: pick a time on the Today tab to build a sprint list for this timer.</p>
{/if}
