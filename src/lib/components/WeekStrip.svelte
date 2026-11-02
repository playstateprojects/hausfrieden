<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { MONTHS, WD } from '#lib/constants.ts';
	import { addDays, isRep } from '#lib/logic.ts';
	import RingSvg from './RingSvg.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const sel = $derived(app.selDay);
	const today = $derived(h.startOfDay);
	const days = $derived.by(() => {
		const d0 = new Date(sel);
		d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
		d0.setHours(0, 0, 0, 0);
		return [...Array(7)].map((_, i) => addDays(d0.getTime(), i));
	});
	const m = $derived(new Date(sel));
</script>

<div class="week">
	<div class="wk-head">
		<button class="wk-arrow" onclick={() => app.shiftWeek(-7)} aria-label="Previous week">‹</button>
		<b>{MONTHS[m.getMonth()]} {m.getFullYear()}</b>
		{#if sel !== today}<button class="chip" style="padding:4px 10px;font-size:12.5px" onclick={() => app.goDay(today)}>Today</button>{/if}
		<button class="wk-arrow" onclick={() => app.shiftWeek(7)} aria-label="Next week">›</button>
		<button class="chip" style="padding:4px 10px;font-size:12.5px;margin-left:auto" onclick={() => (app.sheet = { kind: 'event', id: null, day: sel })}>+ Event</button>
	</div>
	<div class="wk-days">
		{#each days as d (d)}
			{@const pr = d <= today ? h.dayProgress(app.me!, d) : null}
			{@const ev = h.eventsOn(d).filter((e) => !isRep(e)).length}
			<button class="wk-day" class:sel={d === sel} class:today={d === today} onclick={() => app.goDay(d)}>
				<small>{WD[new Date(d).getDay()].slice(0, 2)}</small><b>{new Date(d).getDate()}</b>
				{#if pr !== null}<RingSvg p={pr} />{:else}<i class="ring-ph"></i>{/if}
				{#if ev}<span class="evdot">{ev > 1 ? ev : ''}</span>{/if}
			</button>
		{/each}
	</div>
</div>
