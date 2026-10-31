<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pick = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let name = $state(data.userName ?? '');
	let emoji = $state('🙂');
</script>

<div class="app">
	<header class="top"><h1>Haus<span>frieden</span></h1></header>
	<div class="card" style="padding:22px">
		<h2 class="hello">Join {data.family.name}</h2>
		<p class="sub">Are you already on the household list? Pick yourself so your points carry over.</p>

		<form method="POST" use:enhance>
			{#each data.unlinked as m (m.id)}
				<button type="button" class="list-btn" class:on={pick === m.id} onclick={() => (pick = m.id)}>
					<span class="av" style="background:{m.color}">{m.emoji}</span>{m.name}
				</button>
			{/each}
			<button type="button" class="list-btn" class:on={pick === null} onclick={() => (pick = null)}>
				<span class="av" style="background:#EEE">＋</span>I’m new here
			</button>

			{#if pick}
				<input type="hidden" name="memberId" value={pick} />
			{:else}
				<div class="person-edit mt">
					<input name="emoji" bind:value={emoji} maxlength="4" aria-label="Emoji" />
					<input name="name" bind:value={name} placeholder="Your name" />
				</div>
			{/if}

			{#if form?.message}<p class="err mt">{form.message}</p>{/if}
			<button class="btn block mt" type="submit">Join →</button>
		</form>
	</div>
</div>
