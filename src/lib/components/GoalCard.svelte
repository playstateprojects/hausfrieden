<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	const app = getApp();
	const goal = $derived(app.s.family.goal);
	const total = $derived(app.house.familyWeekPts());
	const pct = $derived(goal ? Math.min(100, Math.round((total / goal) * 100)) : 0);
</script>

{#if goal}
	<div class="card goal">
		<div class="row-between"><b>🏆 Family goal this week</b><span style="font-weight:800">{total} / {goal}</span></div>
		<div class="bar" style="margin:10px 0 8px"><i style="width:{pct}%"></i></div>
		<div style="font-size:14px;opacity:.95">
			{pct >= 100 ? '🎉 You did it! Time for: ' : 'Together you unlock: '}<b>{app.s.family.goalReward || 'a family treat'}</b>
		</div>
	</div>
{/if}
