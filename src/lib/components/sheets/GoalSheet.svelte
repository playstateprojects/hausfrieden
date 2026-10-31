<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	let goal = $state(app.s.family.goal || 0);
	let what = $state(app.s.family.goalReward || '');

	async function save() {
		const g = Math.max(0, Math.round(Number(goal) || 0));
		app.sheet = null;
		app.s.family.goal = g;
		app.s.family.goalReward = what.trim();
		await app.send({ op: 'goal.save', goal: g, goalReward: what.trim() });
	}
</script>

<Sheet>
	<h3>🏆 Family goal</h3>
	<p class="sub">Everyone’s points this week add up towards one shared treat. Set 0 to hide it.</p>
	<label class="field"><span>Weekly target (points)</span><input type="number" inputmode="numeric" step="50" bind:value={goal} /></label>
	<label class="field"><span>The shared treat</span><input bind:value={what} placeholder="e.g. Pizza & film night" /></label>
	<div class="gap">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
