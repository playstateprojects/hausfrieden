<script lang="ts">
	import { getApp, uid } from '#lib/client/app.svelte.ts';
	import { burst } from '#lib/client/fx.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	let who = $state((app.s.members.find((p) => p.id !== app.me) ?? app.s.members[0]).id);
	let pts = $state(10);
	let why = $state('');

	async function give() {
		const name = '⭐ ' + (why.trim() || 'Bonus for helping');
		const id = uid(),
			at = Date.now();
		app.sheet = null;
		app.s.log.unshift({ id, taskId: null, name, memberId: who, at, pts, alarmKey: null, medKey: null, slotAt: null });
		app.s.balances[who] = (app.s.balances[who] || 0) + pts;
		burst();
		app.showToast(`+${pts} for ${app.house.person(who)?.name}!`);
		await app.send({ op: 'log.add', id, memberId: who, name, pts, at });
	}
</script>

<Sheet>
	<h3>⭐ Bonus points</h3>
	<p class="sub">Caught someone tidying without being asked? Reward it.</p>
	<div class="field">
		<span>Who</span>
		<div class="chips">
			{#each app.s.members as p (p.id)}<button class="chip" class:on={who === p.id} onclick={() => (who = p.id)}>{p.emoji} {p.name}</button>{/each}
		</div>
	</div>
	<div class="field">
		<span>How many</span>
		<div class="chips">
			{#each [5, 10, 20, 50] as v (v)}<button class="chip" class:on={pts === v} onclick={() => (pts = v)}>+{v}</button>{/each}
		</div>
	</div>
	<label class="field"><span>What for?</span><input bind:value={why} placeholder="e.g. Packed away the Lego without being asked" /></label>
	<div class="gap">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn warm" onclick={give}>Give points</button>
	</div>
</Sheet>
