<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { kindOf } from '#lib/constants.ts';
	import { addDays, evWho, isRep } from '#lib/logic.ts';
	import type { FamilyEvent } from '#lib/types.ts';
	import EventCard from './EventCard.svelte';

	let { day, withUpcoming = false }: { day: number; withUpcoming?: boolean } = $props();
	const app = getApp();
	const h = $derived(app.house);
	const evs = $derived(h.eventsOn(day));
	const up = $derived.by(() => {
		if (!withUpcoming) return [];
		const out: [number, FamilyEvent][] = [];
		for (let i = 1; i <= 14; i++) {
			const d = addDays(day, i);
			h.eventsOn(d).filter((e) => !isRep(e)).forEach((e) => out.push([d, e]));
		}
		return out.slice(0, 4);
	});
</script>

{#if evs.length}
	<div class="sec-title" style="margin-top:4px">
		📅 {day === h.startOfDay ? 'Today' : 'This day'}
		<small><button onclick={() => (app.sheet = { kind: 'event', id: null, day })} style="color:var(--accent);font-weight:800">+ Add</button></small>
	</div>
	{#each evs as e (e.id)}<EventCard {e} />{/each}
{/if}
{#if up.length}
	<div class="card" style="padding:12px 14px">
		<b style="font-size:14px">🔜 Coming up</b>
		{#each up as [d, e] (e.id + d)}
			{@const k = kindOf(e.kind)}
			{@const n = Math.round((d - day) / 864e5)}
			{@const w = evWho(e)}
			<button class="row-between" style="width:100%;text-align:left;margin-top:8px;font-size:14px" onclick={() => app.goDay(d)}>
				<span>{k[1]} {e.title}{w === 'all' ? '' : ' · ' + w.map((id) => h.person(id)?.name).filter(Boolean).join(', ')}</span>
				<span class="pill {n <= 2 ? 'due' : 'soon'}">{n === 1 ? 'tomorrow' : 'in ' + n + ' days'}</span>
			</button>
		{/each}
	</div>
{/if}
