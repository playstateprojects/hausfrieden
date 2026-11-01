<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';

	let { force = false }: { force?: boolean } = $props();
	const app = getApp();
	const c = $derived(app.house.lastChampion());
	const names = $derived(c?.winners.map((w) => w.p.name) ?? []);
</script>

{#if c && (force || new Date(app.now).getDate() <= 7)}
	<div class="card" style="background:linear-gradient(135deg,#FFE7A8,#FFD27A);text-align:center">
		<div style="font-size:40px">🏆</div>
		<b style="font-family:Fraunces,serif;font-size:21px">{c.month} champion{names.length > 1 ? 's' : ''}: {names.join(' & ')}!</b>
		<div class="sub" style="margin:6px 0 0;color:#6B4A0E">
			{c.n} points · {names.length > 1 ? 'they win' : 'wins'}: <b>{app.s.family.monthPrize || 'the big treat'}</b>
		</div>
	</div>
{/if}
