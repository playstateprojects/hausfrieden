<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { WD } from '#lib/constants.ts';
	import MedRow from '../MedRow.svelte';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	const h = $derived(app.house);
	let who = $state('all');
	let days = $state(14);

	const ids = $derived(h.alarmPeople().filter((pid) => app.s.family.meds.some((m) => m.who === pid)));
	const sel = $derived(who === 'all' ? ids : ids.filter((i) => i === who));
	const groups = $derived(
		Array.from({ length: days }, (_, n) => {
			const day = h.dayN(n);
			return { n, day, slots: sel.flatMap((pid) => h.medSlotsOn(pid, day)).sort((a, b) => a.at - b.at || a.pid.localeCompare(b.pid)) };
		}).filter((g) => g.slots.length)
	);
	const due = $derived(groups.flatMap((g) => g.slots).filter((x) => x.at <= app.now));
	const taken = $derived(due.filter((x) => x.took).length);
	const label = (n: number, day: number) => {
		const d = new Date(day);
		return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
	};
</script>

<Sheet>
	<h3>📋 Medicine log</h3>
	<div class="chips">
		{#each [['all', 'Everyone'], ...ids.map((id) => [id, (h.person(id)?.emoji ?? '') + ' ' + (h.person(id)?.name ?? '')])] as [v, l] (v)}
			<button type="button" class="chip" class:on={who === v} onclick={() => (who = v)}>{l}</button>
		{/each}
	</div>
	<div class="chips mt">
		{#each [7, 14, 30] as d (d)}<button type="button" class="chip" class:on={days === d} onclick={() => (days = d)}>{d} days</button>{/each}
	</div>
	{#if due.length}
		<div class="card mt" style="text-align:center;background:var(--accent-soft)">
			<b style="font-family:Fraunces,serif;font-size:26px;color:var(--accent)">{taken} of {due.length}</b>
			<div class="sub" style="margin:2px 0 0">doses ticked off so far in the last {days} days</div>
		</div>
	{/if}
	{#each groups as g (g.n)}
		<div class="sec-title" style="font-size:16px;margin:14px 0 8px">{label(g.n, g.day)} <small>{g.slots.filter((x) => x.took).length}/{g.slots.length}</small></div>
		{#each g.slots as x (x.key)}<MedRow {x} showWho={who === 'all' && sel.length > 1} />{/each}
	{:else}
		<div class="empty">No medicine reminders yet.</div>
	{/each}
	<p class="sub mt">Forgot to tick one? Tap its circle — it’s recorded for the right day. Tap a ticked one to untick it.</p>
	<button class="btn ghost block mt" onclick={() => (app.sheet = null)}>Close</button>
</Sheet>
