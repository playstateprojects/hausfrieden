<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { PERSON_COLORS } from '#lib/constants.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	let list = $state(
		app.s.members.map((p) => ({ id: p.id as string | undefined, name: p.name, emoji: p.emoji, color: p.color, linked: !!p.userId }))
	);
	const add = () => list.push({ id: undefined, name: '', emoji: '🙂', color: PERSON_COLORS[list.length % PERSON_COLORS.length], linked: false });

	async function save() {
		const members = list
			.filter((p) => p.name.trim())
			.map((p) => ({ id: p.id, name: p.name.trim(), emoji: p.emoji.trim() || '🙂', color: p.color }));
		if (!members.length) return;
		app.sheet = null;
		await app.send({ op: 'members.save', members });
	}
</script>

<Sheet>
	<h3>Household</h3>
	{#each list as p, i (i)}
		<div class="person-edit">
			<input bind:value={p.emoji} maxlength="4" aria-label="Emoji" />
			<input bind:value={p.name} placeholder="Name" />
			{#if p.linked}
				<span class="x" style="display:grid;place-items:center;font-size:15px" title="Has their own login">🔑</span>
			{:else if list.length > 1}
				<button class="x" onclick={() => list.splice(i, 1)} aria-label="Remove">×</button>
			{/if}
		</div>
	{/each}
	<p class="sub">🔑 = has their own login. Invite grown-ups from “Invite, homes & account”.</p>
	<button class="btn ghost block" onclick={add}>+ Add person</button>
	<div class="gap mt">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
