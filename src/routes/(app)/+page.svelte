<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { AppState, setApp, type View } from '#lib/client/app.svelte.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import BonusSheet from '#lib/components/sheets/BonusSheet.svelte';
	import GoalSheet from '#lib/components/sheets/GoalSheet.svelte';
	import HomeSheet from '#lib/components/sheets/HomeSheet.svelte';
	import PeopleSheet from '#lib/components/sheets/PeopleSheet.svelte';
	import RedeemSheet from '#lib/components/sheets/RedeemSheet.svelte';
	import RewardSheet from '#lib/components/sheets/RewardSheet.svelte';
	import RoomsSheet from '#lib/components/sheets/RoomsSheet.svelte';
	import TaskSheet from '#lib/components/sheets/TaskSheet.svelte';
	import Family from '#lib/components/views/Family.svelte';
	import Focus from '#lib/components/views/Focus.svelte';
	import PickMe from '#lib/components/views/PickMe.svelte';
	import Rooms from '#lib/components/views/Rooms.svelte';
	import Today from '#lib/components/views/Today.svelte';
	import Treats from '#lib/components/views/Treats.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const app = new AppState(untrack(() => data));
	setApp(app);

	// fresh server data (after a save, polling, or switching family) replaces local state
	$effect(() => {
		const d = data;
		untrack(() => app.replace(d));
	});

	// keep "due" states current, and pick up changes from the rest of the family
	$effect(() => {
		const clock = setInterval(() => (app.now = Date.now()), 60_000);
		const poll = setInterval(() => {
			if (document.visibilityState === 'visible' && !app.sheet) app.refresh();
		}, 20_000);
		const onVis = () => {
			if (document.visibilityState === 'visible') {
				app.now = Date.now();
				app.refresh();
			}
		};
		document.addEventListener('visibilitychange', onVis);
		return () => {
			clearInterval(clock);
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onVis);
		};
	});
	onDestroy(() => app.destroy());

	const me = $derived(app.house.person(app.me));
	const TABS: [View, string, string][] = [
		['today', '☀️', 'Today'],
		['rooms', '🏠', 'Rooms'],
		['focus', '⏱️', 'Focus'],
		['treats', '🎁', 'Treats'],
		['family', '👨‍👩‍👧‍👦', 'Family']
	];
	const showFab = $derived(!!me && (app.view === 'today' || app.view === 'rooms'));
</script>

<div class="app">
	<header class="top">
		<h1>Haus<span>frieden</span></h1>
		{#if me}
			<button class="me-chip" onclick={() => app.pickMe(null)}>
				<Avatar p={me} />{me.name} · <span style="color:var(--warm)">{app.house.balance(me.id)} pts</span>
			</button>
		{/if}
	</header>

	<main>
		{#if !me}
			<PickMe />
		{:else if app.view === 'today'}
			<Today />
		{:else if app.view === 'rooms'}
			<Rooms />
		{:else if app.view === 'focus'}
			<Focus />
		{:else if app.view === 'treats'}
			<Treats />
		{:else}
			<Family />
		{/if}
	</main>
</div>

{#if showFab}
	<button class="fab" aria-label="Add task" onclick={() => (app.sheet = { kind: 'task', id: null, roomId: app.room })}>+</button>
{/if}

{#if me}
	<nav class="tabs">
		<div class="in">
			{#each TABS as [v, icon, label] (v)}
				<button class:on={app.view === v} onclick={() => app.nav(v)}><span class="i">{icon}</span>{label}</button>
			{/each}
		</div>
	</nav>
{/if}

{#if app.sheet}
	{@const s = app.sheet}
	{#key s}
		{#if s.kind === 'task'}<TaskSheet id={s.id} roomId={s.roomId} />
		{:else if s.kind === 'reward'}<RewardSheet id={s.id} />
		{:else if s.kind === 'redeem'}<RedeemSheet id={s.id} />
		{:else if s.kind === 'bonus'}<BonusSheet />
		{:else if s.kind === 'people'}<PeopleSheet />
		{:else if s.kind === 'rooms'}<RoomsSheet />
		{:else if s.kind === 'goal'}<GoalSheet />
		{:else if s.kind === 'home'}<HomeSheet />{/if}
	{/key}
{/if}

<div class="toast" class:show={!!app.toast}>
	{#if app.toast}
		<span>{app.toast.msg}</span>
		{#if app.toast.btn}<button onclick={() => app.toast?.act?.()}>{app.toast.btn}</button>{/if}
	{/if}
</div>
