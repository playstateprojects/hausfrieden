<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { MONTHS, ROUTINES, WD } from '#lib/constants.ts';
	import { hasDays } from '#lib/logic.ts';
	import type { Task } from '#lib/types.ts';
	import DayPoints from '../DayPoints.svelte';
	import DayRow from '../DayRow.svelte';
	import EventsBlock from '../EventsBlock.svelte';
	import MedRow from '../MedRow.svelte';
	import WeekStrip from '../WeekStrip.svelte';
	import WhoRow from '../WhoRow.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const day = $derived(app.selDay);
	const today = $derived(h.startOfDay);
	const past = $derived(day < today);
	const d = $derived(new Date(day));
	const who = $derived(app.dayWho && h.person(app.dayWho) ? app.dayWho : app.me!);
	const canEdit = $derived(past && h.isAdult(app.me!));

	const list = $derived.by(() => {
		let l = h.tasksForDay(who, day);
		// looking ahead, only show what's actually planned rather than every "whenever" job
		if (!past) l = l.filter((t) => t.routine || h.isHw(t) || hasDays(t) || t.activeFrom || +t.every === 1);
		return l;
	});
	const groups = $derived(
		[
			...(Object.keys(ROUTINES) as (keyof typeof ROUTINES)[]).map((k): [string, Task[]] => [
				ROUTINES[k].emoji + ' ' + ROUTINES[k].label,
				list.filter((t) => t.routine === k).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
			]),
			['📚 Homework', list.filter((t) => !t.routine && h.isHw(t))] as [string, Task[]],
			[
				'🧹 ' + (past ? 'Jobs' : 'Planned jobs'),
				list.filter((t) => !t.routine && !h.isHw(t)).sort((a, b) => +(b.every === 1) - +(a.every === 1) || a.name.localeCompare(b.name))
			] as [string, Task[]]
		].filter((g) => g[1].length)
	);
	const meds = $derived(h.alarmPeople().includes(who) ? h.medSlotsOn(who, day) : []);
	const medsEditable = $derived(day === today || canEdit);
</script>

<WhoRow />
<WeekStrip />
<h2 class="hello">{WD[d.getDay()]} {d.getDate()}. {MONTHS[d.getMonth()]}</h2>
<p class="sub">
	{#if past}
		{canEdit ? 'Forgot to tick something? Tick it here — it counts for this day, with points, streaks and the ⭕ ring bonus.' : 'Looking back at this day. Grown-ups can fix missed ticks.'}
	{:else}Planning ahead.{/if}
</p>
<EventsBlock {day} />
{#if !h.eventsOn(day).length}
	<button class="btn ghost block" onclick={() => (app.sheet = { kind: 'event', id: null, day })} style="margin-bottom:12px">📅 Add an event — test, appointment, birthday…</button>
{/if}
<DayPoints {day} />
<div class="chips" style="margin:14px 0 4px">
	{#each app.s.members as p (p.id)}
		{@const pr = day <= today ? h.dayProgress(p.id, day) : null}
		<button class="chip" class:on={p.id === who} onclick={() => (app.dayWho = p.id)}>{p.emoji} {p.name}{pr !== null ? ` · ${Math.round(pr * 100)}%` : ''}</button>
	{/each}
</div>
{#if meds.length}
	<div class="day-grp">💊 Medicines</div>
	{#each meds as x (x.key)}<MedRow {x} readonly={!medsEditable} />{/each}
{/if}
{#each groups as [title, ts] (title)}
	<div class="day-grp">{title} <span>{past ? ts.filter((t) => h.doneOn(t, who, day)).length + '/' + ts.length : ts.length}</span></div>
	{#each ts as t (t.id)}<DayRow {t} pid={who} {day} {canEdit} />{/each}
{:else}
	{#if !meds.length}<div class="empty">Nothing scheduled.</div>{/if}
{/each}
