<script lang="ts">
	import { goto } from '$app/navigation';
	import { getApp } from '#lib/client/app.svelte.ts';
	import { signOut as logout } from '#lib/client/auth.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	const link = $derived(`${location.origin}/join/${app.s.family.inviteCode}`);
	const myMember = $derived(app.s.members.find((m) => m.id === app.s.myMemberId));
	let homeName = $state(app.s.family.name);

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			app.showToast('Invite link copied');
		} catch {
			app.showToast('Copy failed — select the link instead');
		}
	}
	async function share() {
		if (navigator.share) {
			try {
				await navigator.share({ title: `Join ${app.s.family.name} on Hausfrieden`, url: link });
			} catch {
				/* cancelled */
			}
		} else copy();
	}
	async function rename() {
		if (!homeName.trim() || homeName.trim() === app.s.family.name) return;
		app.s.family.name = homeName.trim();
		await app.send({ op: 'family.rename', name: homeName.trim() });
	}
	async function rotate() {
		await app.send({ op: 'invite.rotate' });
	}
	const switchTo = (id: string) => app.switchFamily(id);
	async function signOut() {
		await logout();
		await goto('/login', { refreshAll: true });
	}
</script>

<Sheet>
	<h3>🏡 {app.s.family.name}</h3>

	<div class="field">
		<span>Invite someone</span>
		<div class="code">{app.s.family.inviteCode}</div>
		<p class="sub" style="margin:8px 0">Anyone with this link can join your home with their own login.</p>
		<div class="gap">
			<button class="btn" onclick={share}>Share invite link</button>
			{#if myMember?.role === 'admin'}<button class="btn ghost" onclick={rotate}>New code</button>{/if}
		</div>
	</div>

	<label class="field">
		<span>Home name</span>
		<div class="gap"><input bind:value={homeName} /><button class="btn ghost" style="flex:none" onclick={rename}>Rename</button></div>
	</label>

	{#if app.families.length > 1}
		<div class="field">
			<span>Your homes</span>
			{#each app.families as f (f.id)}
				<button class="list-btn" class:on={f.id === app.familyId} onclick={() => f.id !== app.familyId && switchTo(f.id)}>🏡 {f.name}</button>
			{/each}
		</div>
	{/if}
	<a class="btn ghost block" href="/welcome" onclick={() => (app.sheet = null)}>+ Set up or join another home</a>

	<div class="field mt">
		<span>Account</span>
		<p class="sub" style="margin:0 0 10px">Signed in as {app.user.name} ({app.user.email})</p>
		<div class="gap">
			<button class="btn danger" onclick={signOut}>Sign out</button>
			<button class="btn ghost" onclick={() => (app.sheet = null)}>Close</button>
		</div>
	</div>
</Sheet>
