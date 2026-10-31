<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import Avatar from './Avatar.svelte';
	const app = getApp();
</script>

<div class="who-row">
	{#each app.s.members as p (p.id)}
		<button class="who-btn" class:on={p.id === app.me} onclick={() => app.pickMe(p.id)}><Avatar {p} />{p.name}</button>
	{/each}
</div>
