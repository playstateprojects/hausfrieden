<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { rewardInput } from '#lib/schemas.ts';
	import IdeaChips from '../IdeaChips.svelte';
	import Sheet from './Sheet.svelte';

	let { id }: { id: string | null } = $props();
	const app = getApp();
	// svelte-ignore state_referenced_locally
	const r = id ? app.s.rewards.find((x) => x.id === id) : undefined;
	let emoji = $state(r?.emoji ?? '🎁');
	let name = $state(r?.name ?? '');
	let cost = $state(r?.cost ?? 100);
	let err = $state('');

	async function save() {
		const parsed = rewardInput.safeParse({
			id: id ?? undefined,
			emoji: emoji.trim() || '🎁',
			name,
			cost: Math.max(5, Math.round(Number(cost) || 50))
		});
		if (!parsed.success) {
			err = 'Give the treat a name';
			return;
		}
		app.sheet = null;
		await app.send({ op: 'reward.save', reward: parsed.data });
	}
	async function del() {
		if (!id) return;
		app.sheet = null;
		app.s.rewards = app.s.rewards.filter((x) => x.id !== id);
		await app.send({ op: 'reward.delete', id });
	}
</script>

<Sheet>
	<h3>{id ? 'Edit treat' : 'New treat'}</h3>
	<div class="person-edit">
		<input bind:value={emoji} maxlength="4" aria-label="Emoji" />
		<input bind:value={name} placeholder="e.g. Choose Saturday breakfast" />
	</div>
	{#if !id}
		<p class="sub" style="margin:10px 0 0">Ideas that suit your budget:</p>
		<IdeaChips
			kind="treats"
			budget={app.s.family.budget}
			pick={(i) => {
				name = i.label;
				emoji = i.emoji;
				if (i.cost) cost = i.cost;
			}}
		/>
	{/if}
	<label class="field mt"><span>Cost in points</span><input type="number" inputmode="numeric" min="5" step="5" bind:value={cost} /></label>
	<p class="sub">A typical day of helping earns 20–60 points.</p>
	{#if err}<p class="err">{err}</p>{/if}
	<div class="gap">
		{#if id}<button class="btn danger" onclick={del}>Delete</button>{:else}<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>{/if}
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
