<script lang="ts">
	import { getApp, uid } from '#lib/client/app.svelte.ts';
	import { EVENT_KIND_INFO, WD } from '#lib/constants.ts';
	import { evWho, isRep, ymd } from '#lib/logic.ts';
	import { eventInput } from '#lib/schemas.ts';
	import type { EventKind } from '#lib/types.ts';
	import Sheet from './Sheet.svelte';

	let { id, day }: { id: string | null; day?: number } = $props();
	const app = getApp();
	// svelte-ignore state_referenced_locally
	const old = id ? app.s.events.find((e) => e.id === id) : undefined;

	let kind = $state<EventKind>(old?.kind ?? 'test');
	let title = $state(old?.title ?? '');
	// svelte-ignore state_referenced_locally
	let date = $state(old?.date ?? ymd(day ?? app.selDay));
	let time = $state(old?.time ?? '');
	let note = $state(old?.note ?? '');
	let prep = $state(old ? old.prep : 3);
	let repeat = $state<number[]>(old && isRep(old) ? [...old.repeat!] : []);
	let who = $state<string[] | 'all'>(
		old ? (evWho(old) === 'all' ? 'all' : [...(evWho(old) as string[])]) : app.s.members.filter((p) => p.kind !== 'adult').slice(0, 1).map((p) => p.id)
	);
	let err = $state('');

	const placeholder = $derived(
		kind === 'test' ? 'e.g. Maths Klassenarbeit' : kind === 'appt' ? 'e.g. Dentist' : kind === 'bday' ? 'e.g. Oma’s birthday' : 'e.g. School trip'
	);

	function pickKind(k: EventKind) {
		kind = k;
		if (k === 'test' && !prep) prep = 3;
	}
	function toggleWho(pid: string) {
		if (pid === 'all') return (who = 'all');
		const cur = who === 'all' ? [] : [...who];
		const i = cur.indexOf(pid);
		if (i >= 0) cur.splice(i, 1);
		else cur.push(pid);
		who = cur.length ? cur : 'all';
	}
	function toggleRep(d: number) {
		repeat = repeat.includes(d) ? repeat.filter((x) => x !== d) : [...repeat, d];
	}

	async function save() {
		err = '';
		const parsed = eventInput.safeParse({
			id: id ?? uid(),
			kind,
			title,
			date,
			time,
			who: who === 'all' || !who.length ? 'all' : who,
			note,
			prep: kind === 'test' && !repeat.length ? prep : 0,
			repeat: repeat.length ? [...repeat].sort() : null,
			until: old?.until ?? null
		});
		if (!parsed.success) {
			err = parsed.error.issues[0]?.path[0] === 'title' ? 'What is it?' : parsed.error.issues[0]?.path[0] === 'date' ? 'Pick a date' : 'Check the form';
			return;
		}
		app.sheet = null;
		const withPrep = parsed.data.prep > 0;
		if (await app.saveEvent(parsed.data)) app.showToast(old ? 'Event saved' : `📅 Added${withPrep ? ' — revision reminders set' : ''}`);
	}
	async function del() {
		if (!id) return;
		app.sheet = null;
		if (await app.deleteEvent(id)) app.showToast('Event deleted');
	}
</script>

<Sheet>
	<h3>{id ? 'Edit event' : 'New event'}</h3>
	<div class="chips" style="margin-bottom:12px">
		{#each EVENT_KIND_INFO as k (k[0])}
			<button type="button" class="chip" class:on={kind === k[0]} onclick={() => pickKind(k[0] as EventKind)}>{k[1]} {k[2]}</button>
		{/each}
	</div>
	<label class="field"><span>What</span><input bind:value={title} {placeholder} /></label>
	<div class="field">
		<span>🔁 Repeat every week on</span>
		<div class="chips">
			{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
				<button type="button" class="chip" class:on={repeat.includes(d)} style="padding:6px 10px;font-size:13px" onclick={() => toggleRep(d)}>{WD[d]}</button>
			{/each}
		</div>
		<p class="sub" style="margin:6px 0 0">{repeat.length ? 'Repeats weekly from the start date below. Tap days again to turn off.' : 'Leave empty for a one-off event.'}</p>
	</div>
	<div class="gap">
		<label class="field"><span>{repeat.length ? 'Starts' : 'Date'}</span><input type="date" bind:value={date} /></label>
		<label class="field" style="flex:.7"><span>Time (optional)</span><input type="time" bind:value={time} /></label>
	</div>
	<div class="field">
		<span>Who</span>
		<div class="chips">
			<button type="button" class="chip" class:on={who === 'all'} onclick={() => toggleWho('all')}>👨‍👩‍👧‍👦 Everyone</button>
			{#each app.s.members as p (p.id)}
				<button type="button" class="chip" class:on={who !== 'all' && who.includes(p.id)} onclick={() => toggleWho(p.id)}>{p.emoji} {p.name}</button>
			{/each}
		</div>
	</div>
	{#if kind === 'test' && !repeat.length}
		<div class="field">
			<span>📚 Revision reminders</span>
			<div class="chips">
				{#each [[0, 'None'], [2, '2 days before'], [3, '3 days before'], [5, '5 days before']] as [v, l] (v)}
					<button type="button" class="chip" class:on={prep === v} onclick={() => (prep = Number(v))}>{l}</button>
				{/each}
			</div>
			<p class="sub" style="margin:6px 0 0">Adds “Revise: …” (20 min, +20 pts) to their homework each day before the test.</p>
		</div>
	{/if}
	<label class="field"><span>Note (optional)</span><input bind:value={note} placeholder="e.g. bring PE kit, chapters 3–5" /></label>
	{#if err}<p class="err">{err}</p>{/if}
	<div class="gap">
		{#if id}<button class="btn danger" onclick={del}>Delete</button>{:else}<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>{/if}
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
