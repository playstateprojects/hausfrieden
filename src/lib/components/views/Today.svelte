<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ROUTINES, type RoutineKey } from '#lib/constants.ts';
	import { hasDays, ptsFor } from '#lib/logic.ts';
	import type { Task } from '#lib/types.ts';
	import GoalCard from '../GoalCard.svelte';
	import TaskRow from '../TaskRow.svelte';
	import WhoRow from '../WhoRow.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const me = $derived(h.person(app.me)!);
	const list = $derived(h.scoped(app.scope));
	const due = $derived(list.filter((t) => h.ratio(t) >= 1).sort((a, b) => h.ratio(b) - h.ratio(a)));
	const soon = $derived(
		list
			.filter((t) => {
				const r = h.ratio(t);
				return r >= 0.75 && r < 1;
			})
			.sort((a, b) => h.ratio(b) - h.ratio(a))
	);
	const doneToday = $derived(list.filter(h.doneRecently));
	const mins = $derived(due.reduce((s, t) => s + (t.mins || 0), 0));
	const myToday = $derived(app.s.log.filter((l) => l.memberId === app.me && l.at >= h.startOfDay).length);
	const hour = $derived(new Date(app.now).getHours());
	const greet = $derived(hour < 12 ? 'Morning' : hour < 18 ? 'Hi' : 'Evening');

	const homeworkRoom = $derived(app.s.rooms.find((r) => r.key === 'homework')?.id);
	const isHw = (t: Task) => !!homeworkRoom && t.roomId === homeworkRoom;
	const isBig = (t: Task) => hasDays(t) && t.days.length <= 2 && !isHw(t);
	const hw = $derived(due.filter(isHw));
	const big = $derived(due.filter((t) => !isHw(t) && isBig(t)));
	const rest = $derived(due.filter((t) => !isHw(t) && !isBig(t)));
	const sum = (a: Task[]) => a.reduce((s, t) => s + (t.mins || 0), 0);
	const satOnly = $derived(big.every((t) => t.days?.includes(6)));

	const sprint = $derived(app.time ? h.buildSprint(app.time, app.scope) : []);
	const oneTask = $derived(due.length ? due[app.one % due.length] : null);

	type Card = { key: RoutineKey; steps: Task[]; done: number; all: boolean };
	const routineCards = $derived(
		(Object.keys(ROUTINES) as RoutineKey[])
			.map((key): Card => {
				const steps = h.routineSteps(key);
				const done = steps.filter(h.doneRecently).length;
				return { key, steps, done, all: done === steps.length };
			})
			.filter((c) => c.steps.length && (ROUTINES[c.key].show(hour) || (c.done > 0 && !c.all)))
	);

	// guided routine
	const gSteps = $derived(app.guide ? h.routineSteps(app.guide) : []);
	const gCur = $derived(
		gSteps.filter((s) => !h.doneRecently(s) && !app.gskip.includes(s.id))[0] ?? gSteps.find((s) => !h.doneRecently(s))
	);
</script>

<WhoRow />
<h2 class="hello">{greet}, {me.name} {me.emoji}</h2>
<p class="sub">
	{due.length ? `${due.length} thing${due.length > 1 ? 's' : ''} due · about ${mins} min in total` : 'Nothing due right now.'}
	{myToday ? ` · you’ve done ${myToday} today 🔥` : ''}
</p>

{#if app.guide}
	{@const R = ROUTINES[app.guide]}
	{#snippet dots()}
		<div style="display:flex;gap:6px;margin:0 0 16px">
			{#each gSteps as s (s.id)}
				<i style="flex:1;height:10px;border-radius:9px;background:{h.doneRecently(s) ? 'var(--ok)' : s === gCur ? 'var(--warm)' : 'rgba(0,0,0,.09)'}"></i>
			{/each}
		</div>
	{/snippet}
	{#if !gCur}
		<div class="card big-one">
			{@render dots()}
			<div class="emoji">🎉</div>
			<h2>{R.label} done!</h2>
			<p class="sub">Every step ticked off. That’s how good days start.</p>
			<button class="btn block" onclick={() => (app.guide = null)}>Back to today</button>
		</div>
	{:else}
		<div class="card big-one">
			{@render dots()}
			<div class="sub" style="margin:0">{R.emoji} {R.label} · step {gSteps.indexOf(gCur) + 1} of {gSteps.length}</div>
			<h2 style="font-size:30px;margin:14px 0 8px">{gCur.name}</h2>
			<p class="sub">About {gCur.mins} min · +{ptsFor(gCur)} pts</p>
			<button class="btn block" style="padding:18px;font-size:18px" onclick={() => app.complete(gCur.id)}>Done! ✓</button>
			<div class="gap mt">
				<button class="btn ghost" onclick={() => app.gskip.push(gCur.id)}>Skip for now</button>
				<button class="btn ghost" onclick={() => (app.guide = null)}>Stop</button>
			</div>
		</div>
		<div class="sec-title">All steps</div>
		{#each gSteps as s (s.id)}<TaskRow t={s} noRoom />{/each}
	{/if}
{:else}
	{#each routineCards as c (c.key)}
		{@const R = ROUTINES[c.key]}
		<div class="card" style="background:{c.key === 'morning' ? '#FFF4DC' : '#E9E6F7'}">
			<div class="row-between">
				<b style="font-size:17px">{R.emoji} {R.label}</b><span class="pts" style="font-size:14px">{c.done}/{c.steps.length}</span>
			</div>
			<div style="display:flex;gap:6px;margin:12px 0">
				{#each c.steps as s (s.id)}
					<i style="flex:1;height:8px;border-radius:9px;background:{h.doneRecently(s) ? 'var(--ok)' : 'rgba(0,0,0,.09)'}"></i>
				{/each}
			</div>
			{#if c.all}
				<div style="font-weight:800;color:var(--accent)">All done — brilliant! 🎉</div>
			{:else}
				<button
					class="btn block"
					onclick={() => {
						app.guide = c.key;
						app.gskip = [];
						scrollTo(0, 0);
					}}>{c.done ? 'Keep going →' : 'Start, one step at a time →'}</button
				>
			{/if}
		</div>
	{/each}

	<GoalCard />

	{#if app.oneOpen && oneTask}
		{@const r = h.roomOf(oneTask.roomId)}
		<div class="card big-one">
			<div class="emoji">{r.emoji}</div>
			<div class="sub" style="margin:4px 0 0">{r.name} · {oneTask.mins} min · +{ptsFor(oneTask)} pts</div>
			<h2>{oneTask.name}</h2>
			<p class="sub">Just this one. Nothing else matters for the next {oneTask.mins} minutes.</p>
			<div class="gap">
				<button class="btn ghost" onclick={() => app.one++}>Not this one</button>
				<button class="btn" onclick={() => app.complete(oneTask.id)}>Done! ✓</button>
			</div>
			<button class="note" style="display:block;margin:16px auto 0;font-weight:700" onclick={() => (app.oneOpen = false)}>Show the full list</button>
		</div>
	{:else}
		<div class="card">
			<div class="row-between" style="margin-bottom:10px"><b>How much time have you got?</b></div>
			<div class="chips">
				{#each [5, 15, 30, 60] as m (m)}
					<button class="chip" class:on={app.time === m} onclick={() => (app.time = app.time === m ? null : m)}>{m} min</button>
				{/each}
			</div>
			{#if app.time}
				{#if sprint.length}
					<div class="mt">{#each sprint as t (t.id)}<TaskRow {t} />{/each}</div>
					<button class="btn block mt" onclick={() => app.startSprint()}>▶ Start {app.time}-minute sprint</button>
				{:else}
					<p class="sub mt">Nothing fits — you’re ahead. Enjoy it.</p>
				{/if}
			{:else}
				<button
					class="btn warm block mt"
					disabled={!due.length}
					onclick={() => {
						app.oneOpen = true;
						app.one = 0;
					}}>🎯 Just give me one thing</button
				>
			{/if}
		</div>

		<div class="seg" style="margin:18px 0 4px">
			<button class:on={app.scope === 'me'} onclick={() => app.setScope('me')}>{me.name}’s list</button>
			<button class:on={app.scope === 'all'} onclick={() => app.setScope('all')}>Whole family</button>
		</div>

		{#if big.length}
			<div class="sec-title">{satOnly ? '🧽 Saturday deep clean' : '🧽 Big clean'} <small>{big.length} · ~{sum(big)} min</small></div>
			{#each big as t (t.id)}<TaskRow {t} />{/each}
		{/if}
		{#if hw.length}
			<div class="sec-title">📚 Homework <small>{hw.length} · {sum(hw)} min</small></div>
			{#each hw as t (t.id)}<TaskRow {t} />{/each}
		{/if}
		<div class="sec-title">{big.length || hw.length ? 'Everyday jobs' : 'Due now'} <small>{rest.length}</small></div>
		{#each rest as t (t.id)}<TaskRow {t} />{:else}
			<div class="empty"><div class="emoji">🌿</div>All caught up. The house can wait — go sit down.</div>
		{/each}
		{#if doneToday.length}
			<div class="sec-title">Done today <small>{doneToday.length}</small></div>
			{#each doneToday as t (t.id)}<TaskRow {t} />{/each}
		{/if}
		{#if soon.length}
			<details>
				<summary class="sec-title">Coming up <small>{soon.length} ▾</small></summary>
				{#each soon as t (t.id)}<TaskRow {t} />{/each}
			</details>
		{/if}
		<p class="note">☁️ Synced — everyone in {app.s.family.name} sees the same list.</p>
	{/if}
{/if}
