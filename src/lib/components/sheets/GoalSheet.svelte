<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { BUDGETS } from '#lib/constants.ts';
	import IdeaChips from '../IdeaChips.svelte';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	const f = app.s.family;
	let budget = $state(f.budget);
	let goal = $state(f.goal || 0);
	let what = $state(f.goalReward || '');
	let monthGoal = $state(f.monthGoal || 0);
	let monthWhat = $state(f.monthGoalReward || '');
	let prize = $state(f.monthPrize || '');
	let rate = $state(f.adultRate);

	async function save() {
		const fields = {
			goal: Math.max(0, Math.round(Number(goal) || 0)),
			goalReward: what.trim(),
			monthGoal: Math.max(0, Math.round(Number(monthGoal) || 0)),
			monthGoalReward: monthWhat.trim(),
			monthPrize: prize.trim(),
			adultRate: rate,
			budget
		};
		app.sheet = null;
		Object.assign(app.s.family, fields);
		await app.send({ op: 'goals.save', ...fields });
	}
</script>

<Sheet>
	<h3>🏆 Goals & prizes</h3>
	<div class="field">
		<span>What suits your family right now?</span>
		<div class="chips">
			{#each BUDGETS as [v, l] (v)}<button type="button" class="chip" class:on={budget === v} onclick={() => (budget = v)}>{l}</button>{/each}
		</div>
		<p class="sub" style="margin:6px 0 0">This only changes the ideas we suggest. Free ideas are always included — the best treats are often time together.</p>
	</div>
	<div class="field">
		<span>🤝 Weekly family treat</span>
		<input bind:value={what} placeholder="Type your own or tap an idea" />
		<IdeaChips kind="weekly" {budget} pick={(i) => (what = i.label)} />
		<label class="row-between mt" style="font-size:14px;color:var(--muted);font-weight:700">
			Points needed, all together<input type="number" inputmode="numeric" step="50" bind:value={goal} style="width:110px" />
		</label>
	</div>
	<div class="field">
		<span>🤝 Monthly family treat</span>
		<input bind:value={monthWhat} placeholder="Type your own or tap an idea" />
		<IdeaChips kind="monthly" {budget} pick={(i) => (monthWhat = i.label)} />
		<label class="row-between mt" style="font-size:14px;color:var(--muted);font-weight:700">
			Points needed, all together<input type="number" inputmode="numeric" step="100" bind:value={monthGoal} style="width:110px" />
		</label>
	</div>
	<div class="field">
		<span>🏆 Monthly champion wins</span>
		<input bind:value={prize} placeholder="Type your own or tap an idea" />
		<IdeaChips kind="champion" {budget} pick={(i) => (prize = i.label)} />
		<p class="sub" style="margin:6px 0 0">For whoever has the most points at the end of the month. Change it any month.</p>
	</div>
	<div class="field">
		<span>⚖️ Fair play for grown-ups</span>
		<div class="chips">
			{#each [[1, 'Full points'], [0.5, 'Half'], [0.33, 'A third']] as [v, l] (v)}
				<button type="button" class="chip" class:on={rate === v} onclick={() => (rate = Number(v))}>{l}</button>
			{/each}
		</div>
		<p class="sub" style="margin:8px 0 0">
			Grown-ups do bigger jobs, so they earn less per task (max {f.adultCap}). Kids always get full points. Set a target to 0 to hide that goal.
		</p>
	</div>
	<div class="gap">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
