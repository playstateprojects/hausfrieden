<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import Avatar from '../Avatar.svelte';
	const app = getApp();
</script>

<div class="card center" style="padding:26px 18px">
	<h2 class="hello">Who’s using this phone?</h2>
	<p class="sub">You can switch any time — handy on a shared tablet.</p>
	<div class="chips" style="justify-content:center;gap:16px">
		{#each app.s.members as p (p.id)}
			<button class="who-btn" onclick={() => app.pickMe(p.id)}><Avatar {p} lg />{p.name}</button>
		{/each}
	</div>
</div>
