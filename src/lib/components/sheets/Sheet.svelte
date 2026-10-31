<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	const app = getApp();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (app.sheet = null)} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay show" onclick={(e) => e.target === e.currentTarget && (app.sheet = null)}>
	<div class="sheet" role="dialog" aria-modal="true">
		{@render children()}
	</div>
</div>
