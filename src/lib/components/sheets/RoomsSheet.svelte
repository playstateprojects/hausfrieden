<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ROOM_COLORS } from '#lib/constants.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	const used = new Set(app.s.tasks.map((t) => t.roomId));
	let list = $state(app.s.rooms.map((r) => ({ id: r.id as string | undefined, key: r.key, name: r.name, emoji: r.emoji, color: r.color })));
	const add = () => list.push({ id: undefined, key: null, name: '', emoji: '🏠', color: ROOM_COLORS[list.length % ROOM_COLORS.length] });

	async function save() {
		const rooms = list
			.filter((r) => r.name.trim())
			.map((r) => ({ id: r.id, key: r.key, name: r.name.trim(), emoji: r.emoji.trim() || '🏠', color: r.color }));
		app.sheet = null;
		await app.send({ op: 'rooms.save', rooms });
	}
</script>

<Sheet>
	<h3>Rooms</h3>
	{#each list as r, i (i)}
		<div class="person-edit">
			<input bind:value={r.emoji} maxlength="4" aria-label="Emoji" />
			<input bind:value={r.name} placeholder="Room name" />
			{#if !(r.id && used.has(r.id))}<button class="x" onclick={() => list.splice(i, 1)} aria-label="Remove">×</button>{/if}
		</div>
	{/each}
	<p class="sub">Rooms with tasks can’t be removed until their tasks are deleted.</p>
	<button class="btn ghost block" onclick={add}>+ Add room</button>
	<div class="gap mt">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
