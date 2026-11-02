<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';

	let { day }: { day: number } = $props();
	const app = getApp();
	const h = $derived(app.house);
	const rows = $derived(app.s.members.map((p) => ({ p, n: h.ptsBetween(p.id, day, day + 864e5) })));
</script>

{#if rows.some((r) => r.n)}
	<div class="chips" style="margin:6px 0 12px;align-items:center">
		<span style="font-size:13px;font-weight:800;color:var(--muted)">⭐ Points {day === h.startOfDay ? 'today' : 'this day'}:</span>
		{#each rows as { p, n } (p.id)}
			<span class="chip" style="padding:5px 10px;font-size:13px;background:#fff">{p.emoji} {n}</span>
		{/each}
	</div>
{/if}
