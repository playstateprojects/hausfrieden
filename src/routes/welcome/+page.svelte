<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/client/api.ts';
	import { lsSet } from '#lib/client/app.svelte.ts';
	import { signOut as logout } from '#lib/client/auth.ts';
	import { burst } from '#lib/client/fx.ts';
	import { createFamily } from '#lib/schemas.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const first = data.userName?.trim() || 'Me';
	let familyName = $state(`${first}’s home`);
	let people = $state([
		{ emoji: '🌻', name: first, kind: 'adult' as 'adult' | 'kid' },
		{ emoji: '🎨', name: '', kind: 'adult' as 'adult' | 'kid' },
		{ emoji: '📷', name: '', kind: 'kid' as 'adult' | 'kid' },
		{ emoji: '🦄', name: '', kind: 'kid' as 'adult' | 'kid' }
	]);
	let starter = $state(true);
	let busy = $state(false);
	let err = $state('');
	let code = $state('');

	async function create() {
		err = '';
		const list = people.map((p) => ({ name: p.name.trim(), emoji: p.emoji.trim() || '🙂', kind: p.kind })).filter((p) => p.name);
		const parsed = createFamily.safeParse({
			name: familyName,
			members: list,
			meIndex: 0,
			starter,
			tzOffset: new Date().getTimezoneOffset()
		});
		if (!parsed.success) {
			err = list.length ? (parsed.error.issues[0]?.message ?? 'Check the form') : 'Add at least yourself';
			return;
		}
		busy = true;
		const res = await api('/api/families', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(parsed.data)
		});
		if (!res.ok) {
			busy = false;
			err = ((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? 'Couldn’t create your home';
			return;
		}
		const { familyId } = (await res.json()) as { familyId: string };
		lsSet('hf_family', familyId);
		burst();
		await goto('/', { refreshAll: true });
	}

	function join(e: SubmitEvent) {
		e.preventDefault();
		const c = code.trim().replace(/.*\/join\//, '').toUpperCase();
		if (c) goto(`/join/${encodeURIComponent(c)}`);
	}

	async function signOut() {
		await logout();
		await goto('/login', { refreshAll: true });
	}
</script>

<div class="app">
	<header class="top">
		<h1>Haus<span>frieden</span></h1>
		<button class="note" style="margin:0" onclick={signOut}>Sign out</button>
	</header>

	<div class="card" style="padding:22px">
		<h2 class="hello">Let’s set up your home</h2>
		<p class="sub">Who lives here? Everyone gets their own list, points and treats. The first person is you. Tap Grown-up/Kid to switch.</p>

		<label class="field"><span>Home name</span><input bind:value={familyName} /></label>

		{#each people as p, i (i)}
			<div class="person-edit">
				<input bind:value={p.emoji} maxlength="4" aria-label="Emoji" />
				<input bind:value={p.name} placeholder={i === 0 ? 'Your name' : 'Name'} />
				<button class="x" style="width:64px;font-size:12.5px;font-weight:800;color:var(--ink)" onclick={() => (p.kind = p.kind === 'adult' ? 'kid' : 'adult')}>
					{p.kind === 'adult' ? 'Grown-up' : 'Kid'}
				</button>
				{#if i > 0}
					<button class="x" onclick={() => people.splice(i, 1)} aria-label="Remove">×</button>
				{:else}
					<span class="x" style="display:grid;place-items:center;font-size:12px;font-weight:800">you</span>
				{/if}
			</div>
		{/each}
		<button class="btn ghost block" onclick={() => people.push({ emoji: '🙂', name: '', kind: 'kid' })}>+ Add person</button>

		<label class="toggle mt">
			<input type="checkbox" bind:checked={starter} />
			<span>
				<b>Start with a ready-made plan</b><br />
				<span style="color:var(--muted)">Rooms, about 40 everyday tasks split between grown-ups and kids, a family goal and a treat shop. Edit or delete anything later.</span>
			</span>
		</label>
		{#if err}<p class="err mt">{err}</p>{/if}
		<button class="btn block mt" onclick={create} disabled={busy}>{busy ? 'Setting up…' : 'Set up our home →'}</button>
	</div>

	<div class="card">
		<b>Joining someone else’s home?</b>
		<p class="sub" style="margin:4px 0 10px">Paste the invite link or code they sent you.</p>
		<form class="gap" onsubmit={join}>
			<input class="code" style="border:0;min-width:0" bind:value={code} placeholder="ABCD2345" aria-label="Invite code" />
			<button class="btn" style="flex:none" type="submit">Join</button>
		</form>
	</div>

	{#if data.hasFamily}<p class="note"><a class="linkish" href="/">← Back to my home</a></p>{/if}
</div>
