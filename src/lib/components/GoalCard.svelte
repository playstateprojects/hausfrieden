<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { DAY, MONTHS } from '#lib/constants.ts';

	const app = getApp();
	const h = $derived(app.house);
	const f = $derived(app.s.family);
	const goals = $derived(
		[
			f.goal && {
				label: 'This week',
				total: h.familyWeekPts(),
				goal: f.goal,
				reward: f.goalReward || 'a family treat',
				left: Math.round((h.weekStart + 7 * DAY - h.startOfDay) / DAY)
			},
			f.monthGoal && {
				label: MONTHS[new Date(app.now).getMonth()],
				total: h.familyMonthPts(),
				goal: f.monthGoal,
				reward: f.monthGoalReward || 'a family day out',
				left: h.daysLeftInMonth()
			}
		].filter((g): g is Exclude<typeof g, 0 | false> => !!g)
	);
</script>

{#if goals.length}
	<div class="card goal">
		<div class="row-between">
			<b>🤝 Family goals — everyone’s points count</b>
			<button onclick={() => (app.sheet = { kind: 'goal' })} style="color:#fff;opacity:.85;font-weight:800;font-size:13px">✏️ Change</button>
		</div>
		{#each goals as g (g.label)}
			{@const pct = Math.min(100, Math.round((g.total / g.goal) * 100))}
			<div style="margin-top:12px">
				<div class="row-between" style="font-size:14px">
					<span>{g.label}: <b>{g.reward}</b></span>
					<span style="font-weight:800;white-space:nowrap">{pct >= 100 ? '🎉 done!' : g.total + ' / ' + g.goal}</span>
				</div>
				<div class="bar" style="margin-top:6px"><i style="width:{pct}%"></i></div>
				<div style="font-size:12px;opacity:.8;margin-top:4px">
					{pct >= 100 ? 'Unlocked — enjoy it!' : `${g.goal - g.total} to go · ${g.left} day${g.left === 1 ? '' : 's'} left`}
				</div>
			</div>
		{/each}
	</div>
{/if}
