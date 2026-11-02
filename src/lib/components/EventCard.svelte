<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { kindOf, WD } from '#lib/constants.ts';
	import { evWho, isRep } from '#lib/logic.ts';
	import type { FamilyEvent } from '#lib/types.ts';

	let { e }: { e: FamilyEvent } = $props();
	const app = getApp();
	const k = $derived(kindOf(e.kind));
	const w = $derived(evWho(e));
	const who = $derived(
		w === 'all'
			? '👨‍👩‍👧‍👦 Everyone'
			: w
					.map((id) => app.house.person(id))
					.filter((p) => !!p)
					.map((p) => p.emoji + ' ' + p.name)
					.join(', ')
	);
</script>

<button class="ev" style="background:{k[3]}" onclick={() => (app.sheet = { kind: 'event', id: e.id })}>
	<span class="ev-emo">{k[1]}</span>
	<span style="flex:1;min-width:0"><b>{e.title}</b><small>{e.time ? e.time + ' · ' : ''}{who}{e.note ? ' · ' + e.note : ''}</small></span>
	{#if isRep(e)}
		<span class="pill" style="background:rgba(255,255,255,.7)">🔁 {[1, 2, 3, 4, 5, 6, 0].filter((d) => e.repeat!.includes(d)).map((d) => WD[d]).join(' & ')}</span>
	{:else if e.kind === 'test' && e.prep}
		<span class="pill" style="background:rgba(255,255,255,.7)">📚 {e.prep}d revision</span>
	{/if}
</button>
