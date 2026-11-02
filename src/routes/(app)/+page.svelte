<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { AppState, setApp, type View } from '#lib/client/app.svelte.ts';
	import { unlockAudio } from '#lib/client/fx.ts';
	import AlarmOverlay from '#lib/components/AlarmOverlay.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import AlarmsSheet from '#lib/components/sheets/AlarmsSheet.svelte';
	import EventSheet from '#lib/components/sheets/EventSheet.svelte';
	import BonusSheet from '#lib/components/sheets/BonusSheet.svelte';
	import GoalSheet from '#lib/components/sheets/GoalSheet.svelte';
	import HomeSheet from '#lib/components/sheets/HomeSheet.svelte';
	import MedLogSheet from '#lib/components/sheets/MedLogSheet.svelte';
	import MedsSheet from '#lib/components/sheets/MedsSheet.svelte';
	import PeopleSheet from '#lib/components/sheets/PeopleSheet.svelte';
	import ProfileSheet from '#lib/components/sheets/ProfileSheet.svelte';
	import RedeemSheet from '#lib/components/sheets/RedeemSheet.svelte';
	import ReorderSheet from '#lib/components/sheets/ReorderSheet.svelte';
	import RewardSheet from '#lib/components/sheets/RewardSheet.svelte';
	import RoomsSheet from '#lib/components/sheets/RoomsSheet.svelte';
	import TaskSheet from '#lib/components/sheets/TaskSheet.svelte';
	import TodoSheet from '#lib/components/sheets/TodoSheet.svelte';
	import Family from '#lib/components/views/Family.svelte';
	import Focus from '#lib/components/views/Focus.svelte';
	import Lists from '#lib/components/views/Lists.svelte';
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
		// 10s keeps alarms and medicine reminders punctual; everything else only changes by the minute
		const clock = setInterval(() => (app.now = Date.now()), 10_000);
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
		// browsers only allow sound after a tap, so unlock the alarm chime on the first one
		document.addEventListener('click', unlockAudio, { capture: true });
		return () => {
			document.removeEventListener('click', unlockAudio, { capture: true });
			clearInterval(clock);
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onVis);
		};
	});
	// award the daily-ring bonus as soon as someone's ring is full
	$effect(() => {
		void app.s.log.length;
		void app.s.tasks;
		void app.selDay;
		const t = setTimeout(() => app.checkRings(), 700);
		return () => clearTimeout(t);
	});
	onDestroy(() => app.destroy());

	const me = $derived(app.house.person(app.me));
	const TABS: [View, string, string][] = [
		['today', '☀️', 'Today'],
		['rooms', '🏠', 'Rooms'],
		['focus', '⏱️', 'Focus'],
		['treats', '🎁', 'Treats'],
		['list', '📝', 'Lists'],
		['family', '👨‍👩‍👧‍👦', 'Family']
	];
	const showFab = $derived(!!me && (app.view === 'today' || app.view === 'rooms'));
</script>

<div class="app">
	<header class="top">
		<h1>Haus<span>frieden</span></h1>
		{#if me}
			{@const st = app.house.streak(me.id)}
			<button class="me-chip" onclick={() => (app.sheet = { kind: 'profile', id: me.id })}>
				<Avatar p={me} />{me.name} · <span style="color:var(--warm)">{app.house.balance(me.id)} pts</span>{st ? ` · 🔥${st}` : ''}
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
		{:else if app.view === 'list'}
			<Lists />
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
		{:else if s.kind === 'home'}<HomeSheet />
		{:else if s.kind === 'profile'}<ProfileSheet id={s.id} />
		{:else if s.kind === 'reorder'}<ReorderSheet routine={s.key} />
		{:else if s.kind === 'alarms'}<AlarmsSheet />
		{:else if s.kind === 'meds'}<MedsSheet />
		{:else if s.kind === 'medlog'}<MedLogSheet />
		{:else if s.kind === 'event'}<EventSheet id={s.id} day={s.day} />
		{:else if s.kind === 'todo'}<TodoSheet id={s.id} />{/if}
	{/key}
{/if}

{#if me}<AlarmOverlay />{/if}

<div class="toast" class:show={!!app.toast}>
	{#if app.toast}
		<span>{app.toast.msg}</span>
		{#if app.toast.btn}<button onclick={() => app.toast?.act?.()}>{app.toast.btn}</button>{/if}
	{/if}
</div>
