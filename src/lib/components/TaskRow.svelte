<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import type { Task } from '#lib/types.ts';

	let { t, noRoom = false }: { t: Task; noRoom?: boolean } = $props();
	const app = getApp();

	const h = $derived(app.house);
	const done = $derived(h.doneRecently(t));
	const st = $derived(h.status(t));
	const r = $derived(h.roomOf(t.roomId));
</script>

<div class="task" class:done>
	<button class="check" onclick={() => !done && app.complete(t.id)} aria-label="Mark done">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
	</button>
	<button class="t-body" style="text-align:left" onclick={() => (app.sheet = { kind: 'task', id: t.id })}>
		<div class="t-name">{t.name}</div>
		<div class="t-meta">
			{#if !noRoom}<span>{r.emoji} {r.name}</span>·{/if}
			<span>{t.mins}m</span>·<span>{h.whoLabel(t)}</span>·<span class="pts">+{h.myPts(t)}</span>
		</div>
	</button>
	{#if done}
		<span class="pill ok">done ✓</span>
	{:else}
		<span class="pill {st[0]}">{st[1]}</span>
	{/if}
</div>
