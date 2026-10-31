<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ago } from '#lib/logic.ts';
	import Avatar from '../Avatar.svelte';
	import GoalCard from '../GoalCard.svelte';
	import WhoRow from '../WhoRow.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const me = $derived(h.person(app.me)!);
	const bal = $derived(h.balance(app.me!));
	const rs = $derived([...app.s.rewards].sort((a, b) => a.cost - b.cost));
	const mine = $derived(app.s.redemptions.filter((x) => x.memberId === app.me).slice(0, 6));
</script>

<WhoRow />
<div class="card">
	<div class="balance">
		<Avatar p={me} lg />
		<div><div class="sub" style="margin:0">{me.name} has</div><b>{bal} pts</b></div>
	</div>
	<p class="sub" style="margin:10px 0 0">Earn points by ticking things off. Spend them here.</p>
</div>
<GoalCard />
<div class="sec-title">
	Treat shop <small><button onclick={() => (app.sheet = { kind: 'reward', id: null })} style="color:var(--accent);font-weight:800">+ Add treat</button></small>
</div>
{#each rs as r (r.id)}
	<button class="reward" class:locked={bal < r.cost} onclick={() => (app.sheet = { kind: 'redeem', id: r.id })}>
		<span class="emoji">{r.emoji}</span>
		<div>
			<b>{r.name}</b>
			{#if bal < r.cost}
				<div class="t-meta">{r.cost - bal} more to go</div>
			{:else}
				<div class="t-meta" style="color:var(--ok);font-weight:800">You can get this!</div>
			{/if}
		</div>
		<span class="cost">{r.cost} pts</span>
	</button>
{:else}
	<div class="empty">No treats yet — add some the family will actually want.</div>
{/each}
{#if mine.length}
	<div class="sec-title">{me.name}’s treats</div>
	<div class="card feed">
		{#each mine as x (x.id)}<div><span>{x.emoji}</span><span>{x.name}</span><time>{ago(x.at, app.now)}</time></div>{/each}
	</div>
{/if}
<p class="note">Tap any treat to get it, edit it or delete it.</p>
