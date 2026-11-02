<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { DAYPRESETS, FREQ, MINS, ROUTINES, WD, type RoutineKey } from '#lib/constants.ts';
	import { hasDays } from '#lib/logic.ts';
	import { taskInput, type TaskInput } from '#lib/schemas.ts';
	import Sheet from './Sheet.svelte';

	let { id, roomId }: { id: string | null; roomId?: string | null } = $props();
	const app = getApp();
	const h = app.house;
	// svelte-ignore state_referenced_locally
	const old = id ? h.task(id) : undefined;

	// Initial values come from the task being edited (or sensible defaults).
	let name = $state(old?.name ?? '');
	// svelte-ignore state_referenced_locally
	let room = $state(old?.roomId ?? roomId ?? app.room ?? app.s.rooms[0]?.id ?? '');
	let mins = $state(old?.mins ?? 5);
	let pts = $state(old?.pts ?? 0);
	let mode = $state<'anyone' | 'each' | 'people'>(
		old?.each ? 'each' : old?.team?.length || old?.who ? 'people' : 'anyone'
	);
	let sel = $state<string[]>(old?.each ? [...(old.only ?? [])] : old?.team?.length ? [...old.team] : old?.who ? [old.who] : []);
	let days = $state<number[]>(old && hasDays(old) ? [...old.days] : [6]);
	let routine = $state<RoutineKey | ''>(old?.routine ?? '');
	const dkey = (d: number[]) => 'd:' + [...d].sort().join(',');
	let freq = $state(
		old?.once
			? 'o:1'
			: old && hasDays(old)
			? DAYPRESETS.some((p) => p[0] === dkey(old.days))
				? dkey(old.days)
				: 'd:custom'
			: 'i:' + (old?.every ?? 7)
	);
	const ints: [number, string][] = [...FREQ];
	if (old && !hasDays(old) && !ints.some((f) => f[0] === old.every)) ints.push([old.every, `Every ${old.every} days`]);

	const byDay = $derived(freq.startsWith('d:'));
	const once = $derived(freq === 'o:1');
	const names = $derived(h.names(sel));
	const hint = $derived(
		mode === 'anyone'
			? 'Whoever gets to it first.'
			: mode === 'each'
				? names.length
					? `${names.join(', ')} each tick off their own.`
					: 'Everyone ticks off their own.'
				: names.length === 1
					? `Only on ${names[0]}’s list.`
					: `On ${names.join(' and ')}’s lists — whoever does it first gets the points.`
	);
	let err = $state('');

	function onFreq() {
		if (freq.startsWith('d:') && freq !== 'd:custom') days = freq.slice(2).split(',').map(Number);
	}
	function toggleDay(n: number) {
		days = days.includes(n) ? days.filter((d) => d !== n) : [...days, n];
		const k = dkey(days);
		freq = DAYPRESETS.some((p) => p[0] === k) ? k : 'd:custom';
	}
	function whoMode(v: 'anyone' | 'each') {
		mode = v;
		if (v === 'anyone') sel = [];
	}
	function whoPerson(pid: string) {
		if (mode === 'anyone') {
			mode = 'people';
			sel = [pid];
			return;
		}
		sel = sel.includes(pid) ? sel.filter((x) => x !== pid) : [...sel, pid];
		if (mode === 'people' && !sel.length) mode = 'anyone';
	}

	async function save() {
		err = '';
		if (byDay && !days.length) {
			err = 'Pick at least one day';
			return;
		}
		const input: TaskInput = {
			id: id ?? undefined,
			name,
			roomId: room,
			mins,
			pts: pts || null,
			every: byDay || once ? 7 : Number(freq.slice(2)) || 7,
			days: byDay ? [...days].sort() : null,
			carry: false,
			once,
			each: mode === 'each',
			who: mode === 'people' && sel.length === 1 ? sel[0] : null,
			team: mode === 'people' && sel.length > 1 ? [...sel] : null,
			only: mode === 'each' && sel.length && sel.length < app.s.members.length ? [...sel] : null,
			routine: routine || null
		};
		const parsed = taskInput.safeParse(input);
		if (!parsed.success) {
			err = parsed.error.issues[0]?.path[0] === 'name' ? 'What needs doing?' : (parsed.error.issues[0]?.message ?? 'Check the form');
			return;
		}
		app.sheet = null;
		if (await app.send({ op: 'task.save', task: parsed.data })) app.showToast(old ? 'Saved' : 'Added — nice.');
	}

	async function del() {
		if (!id) return;
		app.sheet = null;
		app.s.tasks = app.s.tasks.filter((t) => t.id !== id);
		if (await app.send({ op: 'task.delete', id })) app.showToast('Deleted');
	}
</script>

<Sheet>
	<h3>{id ? 'Edit task' : 'New task'}</h3>
	<label class="field">
		<span>What needs doing?</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input bind:value={name} placeholder="e.g. Stack your plate in the dishwasher" autofocus={!id} />
	</label>
	<label class="field">
		<span>Room</span>
		<select bind:value={room}>
			{#each app.s.rooms as r (r.id)}<option value={r.id}>{r.emoji} {r.name}</option>{/each}
		</select>
	</label>
	<label class="field">
		<span>How often?</span>
		<select bind:value={freq} onchange={onFreq}>
			<optgroup label="Repeat after">
				{#each ints as [d, l] (d)}<option value={'i:' + d}>{l}</option>{/each}
			</optgroup>
			<option value="o:1">Once only (e.g. paint a wall, bake a cake)</option>
			<optgroup label="On set days">
				{#each DAYPRESETS as [v, l] (v)}<option value={v}>{l}</option>{/each}
			</optgroup>
		</select>
	</label>
	{#if byDay}
		<div class="field">
			<div class="chips">
				{#each [1, 2, 3, 4, 5, 6, 0] as n (n)}
					<button type="button" class="chip" class:on={days.includes(n)} onclick={() => toggleDay(n)}>{WD[n]}</button>
				{/each}
			</div>
			<p class="sub" style="margin:8px 0 0">Shows only on those days. Missed one? Tap that day in the calendar to tick it off.</p>
		</div>
	{/if}
	<div class="field">
		<span>How long?</span>
		<div class="chips">
			{#each MINS as m (m)}<button type="button" class="chip" class:on={mins === m} onclick={() => (mins = m)}>{m}m</button>{/each}
		</div>
	</div>
	<div class="field">
		<span>Points</span>
		<div class="chips">
			{#each [[0, 'Auto +' + (5 + mins)], [5, '+5'], [10, '+10'], [15, '+15'], [20, '+20'], [30, '+30'], [50, '+50']] as [v, l] (v)}
				<button type="button" class="chip" class:on={pts === v} onclick={() => (pts = Number(v))}>{l}</button>
			{/each}
		</div>
	</div>
	<div class="field">
		<span>Who does it?</span>
		<div class="chips">
			<button type="button" class="chip" class:on={mode === 'anyone'} onclick={() => whoMode('anyone')}>🙋 Anyone</button>
			<button type="button" class="chip" class:on={mode === 'each'} onclick={() => whoMode('each')}>👥 Each does their own</button>
		</div>
		<div class="chips mt">
			{#each app.s.members as p (p.id)}
				<button type="button" class="chip" class:on={mode !== 'anyone' && sel.includes(p.id)} onclick={() => whoPerson(p.id)}>{p.emoji} {p.name}</button>
			{/each}
		</div>
		<p class="sub" style="margin:8px 0 0">{hint}</p>
	</div>
	<label class="field">
		<span>Part of a routine?</span>
		<select bind:value={routine}>
			<option value="">No — it’s a normal job</option>
			{#each Object.entries(ROUTINES) as [k, R] (k)}<option value={k}>{R.emoji} {R.label} (guided steps)</option>{/each}
		</select>
	</label>
	{#if err}<p class="err">{err}</p>{/if}
	<div class="gap mt">
		{#if id}
			<button class="btn danger" onclick={del}>Delete</button>
		{:else}
			<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		{/if}
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
