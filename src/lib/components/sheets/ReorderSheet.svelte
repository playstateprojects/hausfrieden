<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ROUTINES, WD, type RoutineKey } from '#lib/constants.ts';
	import { hasDays } from '#lib/logic.ts';
	import Sheet from './Sheet.svelte';

	let { routine }: { routine: RoutineKey } = $props();
	const app = getApp();
	const h = app.house;
	// svelte-ignore state_referenced_locally
	const R = ROUTINES[routine];
	// svelte-ignore state_referenced_locally
	let list = $state(
		app.s.tasks
			.filter((t) => t.routine === routine)
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((t) => t.id)
	);

	function move(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
	}
	async function save() {
		const ids = [...list];
		app.sheet = null;
		ids.forEach((tid, i) => {
			const t = h.task(tid);
			if (t) t.sortOrder = i + 1;
		});
		if (await app.send({ op: 'routine.reorder', ids })) app.showToast('New order saved');
	}
</script>

<Sheet>
	<h3>{R.emoji} {R.label}</h3>
	<p class="sub">Use the arrows to change the order of the steps.</p>
	{#each list as tid, i (tid)}
		{@const t = h.task(tid)}
		{#if t}
			<div class="task" style="padding:8px 10px">
				<b style="width:22px;text-align:center;color:var(--muted)">{i + 1}</b>
				<div class="t-body">
					<div class="t-name">{t.name}</div>
					<div class="t-meta">{h.whoLabel(t)}{hasDays(t) ? ' · ' + t.days.map((d) => WD[d]).join(' ') : ''}</div>
				</div>
				<button class="x" style="height:40px;{i === 0 ? 'opacity:.3' : ''}" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Move up">↑</button>
				<button class="x" style="height:40px;{i === list.length - 1 ? 'opacity:.3' : ''}" disabled={i === list.length - 1} onclick={() => move(i, 1)} aria-label="Move down">↓</button>
			</div>
		{/if}
	{/each}
	<div class="gap mt">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save order</button>
	</div>
</Sheet>
