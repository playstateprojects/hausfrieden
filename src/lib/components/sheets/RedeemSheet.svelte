<script lang="ts">
	import { getApp, uid } from '#lib/client/app.svelte.ts';
	import { burst } from '#lib/client/fx.ts';
	import Sheet from './Sheet.svelte';

	let { id }: { id: string } = $props();
	const app = getApp();
	const r = $derived(app.s.rewards.find((x) => x.id === id));
	const me = $derived(app.house.person(app.me));
	const bal = $derived(app.house.balance(app.me!));

	async function redeem() {
		if (!r || !app.me || bal < r.cost) return;
		const rid = uid(),
			memberId = app.me;
		app.sheet = null;
		app.s.redemptions.unshift({ id: rid, memberId, name: r.name, emoji: r.emoji, cost: r.cost, at: Date.now(), ext: false, alarmId: null });
		app.s.balances[memberId] = (app.s.balances[memberId] || 0) - r.cost;
		burst(160);
		app.showToast(`Enjoy your ${r.name.toLowerCase()}! 🎉`);
		await app.send({ op: 'reward.redeem', id: rid, rewardId: r.id, memberId });
	}
</script>

<Sheet>
	{#if r && me}
		<div class="center">
			<div style="font-size:54px">{r.emoji}</div>
			<h3 style="margin:6px 0">{r.name}</h3>
			<p class="sub">{r.cost} points · {me.name} has {bal}</p>
			{#if bal >= r.cost}
				<p class="sub">Get a grown-up to say yes, then tap the button together.</p>
				<button class="btn warm block" onclick={redeem}>🎉 Get it for {r.cost} pts</button>
			{:else}
				<div class="tip">{r.cost - bal} more points to go. Check the Today tab for something quick!</div>
			{/if}
			<div class="gap mt">
				<button class="btn ghost" onclick={() => (app.sheet = null)}>Close</button>
				<button class="btn ghost" onclick={() => (app.sheet = { kind: 'reward', id: r.id })}>Edit treat</button>
			</div>
		</div>
	{/if}
</Sheet>
