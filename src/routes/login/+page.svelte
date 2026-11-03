<script lang="ts">
	import { goto } from '$app/navigation';
	import { IS_NATIVE, getToken } from '#lib/client/api.ts';
	import { authClient } from '#lib/client/auth.ts';
	import { signIn, signUp } from '#lib/schemas.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let mode = $state<'in' | 'up'>('in');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let err = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		err = '';
		const parsed = mode === 'up' ? signUp.safeParse({ name, email, password }) : signIn.safeParse({ email, password });
		if (!parsed.success) {
			const i = parsed.error.issues[0];
			err = `${String(i.path[0] ?? '')}: ${i.message}`.replace(/^: /, '');
			return;
		}
		busy = true;
		try {
			const res =
				mode === 'up'
					? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
					: await authClient.signIn.email({ email: email.trim(), password });
			if (res.error) {
				err = res.error.message || `Sign-in failed (${res.error.status})`;
				return;
			}
			if (IS_NATIVE && !getToken()) {
				err = 'Signed in, but the server sent no session token. Please try again.';
				return;
			}
			await goto(data.next, { refreshAll: true });
		} catch (e) {
			err = `Can’t reach Hausfrieden (${e instanceof Error ? e.message : String(e)}).`;
		} finally {
			busy = false;
		}
	}
</script>

<div class="app">
	<div class="auth">
		<p class="brand">Haus<span>frieden</span></p>
		<p class="sub center">Everyday jobs, points and treats for the whole family.</p>

		<div class="card" style="padding:22px">
			<div class="seg" style="margin-bottom:18px">
				<button class:on={mode === 'in'} onclick={() => (mode = 'in')}>Sign in</button>
				<button class:on={mode === 'up'} onclick={() => (mode = 'up')}>Create account</button>
			</div>

			<form onsubmit={submit}>
				{#if mode === 'up'}
					<label class="field"><span>Your name</span><input bind:value={name} autocomplete="name" /></label>
				{/if}
				<label class="field"><span>Email</span><input type="email" bind:value={email} autocomplete="email" /></label>
				<label class="field">
					<span>Password</span>
					<input
						type="password"
						bind:value={password}
						autocomplete={mode === 'up' ? 'new-password' : 'current-password'}
					/>
				</label>
				{#if err}<p class="err">{err}</p>{/if}
				<button class="btn block" type="submit" disabled={busy}>
					{busy ? 'One moment…' : mode === 'up' ? 'Create account →' : 'Sign in →'}
				</button>
			</form>
		</div>
		<p class="note">Kids don’t need their own login — add them to your household and pick them on a shared phone.</p>
	</div>
</div>
