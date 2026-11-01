<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import MedRow from './MedRow.svelte';

	const app = getApp();
	const rows = $derived(app.house.alarmPeople().flatMap((pid) => app.house.medSlotsToday(pid)).sort((a, b) => a.at - b.at));
</script>

{#if rows.length}
	<div class="sec-title" style="margin-top:6px">
		💊 Medicines today
		<small>
			<button onclick={() => (app.sheet = { kind: 'medlog' })} style="color:var(--accent);font-weight:800">📋 Log</button> ·
			<button onclick={() => (app.sheet = { kind: 'meds' })} style="color:var(--accent);font-weight:800">✏️ Edit</button> ·
			{rows.filter((x) => x.took).length}/{rows.length}
		</small>
	</div>
	{#each rows as x (x.key)}<MedRow {x} showWho />{/each}
{/if}
