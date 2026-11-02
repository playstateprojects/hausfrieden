<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/client/api.ts';
	import { lsSet } from '#lib/client/app.svelte.ts';
	import type { PageProps } from './$types';

	let { data, params }: PageProps = $props();
	// the load redirects when already joined, so here the invite is always open
	const join = $derived(data as Extract<typeof data, { already: false }>);

	let pick = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let name = $state(join.userName ?? '');
	let emoji = $state('🙂');
	let busy = $state(false);
	let message = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		message = '';
		busy = true;
		try {
			const res = await api(`/api/join/${encodeURIComponent(params.code)}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(pick ? { memberId: pick } : { name: name.trim() || undefined, emoji: emoji.trim() || undefined })
			});
			const body = (await res.json().catch(() => null)) as { familyId?: string; message?: string } | null;
			if (!res.ok || !body?.familyId) {
				message = body?.message ?? 'Couldn’t join — try again.';
				return;
			}
			lsSet('hf_family', body.familyId);
			await goto('/', { refreshAll: true });
		} catch {
			message = 'Can’t reach Hausfrieden. Check your connection.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="app">
	<header class="top"><h1>Haus<span>frieden</span></h1></header>
	<div class="card" style="padding:22px">
		<h2 class="hello">Join {join.family.name}</h2>
		<p class="sub">Are you already on the household list? Pick yourself so your points carry over.</p>

		<form onsubmit={submit}>
			{#each join.unlinked as m (m.id)}
				<button type="button" class="list-btn" class:on={pick === m.id} onclick={() => (pick = m.id)}>
					<span class="av" style="background:{m.color}">{m.emoji}</span>{m.name}
				</button>
			{/each}
			<button type="button" class="list-btn" class:on={pick === null} onclick={() => (pick = null)}>
				<span class="av" style="background:#EEE">＋</span>I’m new here
			</button>

			{#if !pick}
				<div class="person-edit mt">
					<input bind:value={emoji} maxlength="4" aria-label="Emoji" />
					<input bind:value={name} placeholder="Your name" />
				</div>
			{/if}

			{#if message}<p class="err mt">{message}</p>{/if}
			<button class="btn block mt" type="submit" disabled={busy}>{busy ? 'One moment…' : 'Join →'}</button>
		</form>
	</div>
</div>
