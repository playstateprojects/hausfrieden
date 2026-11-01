<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import Avatar from './Avatar.svelte';
	const app = getApp();
</script>

<div class="who-row">
	{#each app.s.members as p (p.id)}
		<button
			class="who-btn"
			class:on={p.id === app.me}
			onclick={() => (p.id === app.me && app.view !== 'treats' ? (app.sheet = { kind: 'profile', id: p.id }) : app.pickMe(p.id))}
			><Avatar {p} />{p.name}{#if app.house.streak(p.id)}<small style="color:var(--warm);font-weight:800;margin-top:-3px">🔥{app.house.streak(p.id)}</small>{/if}</button
		>
	{/each}
</div>
