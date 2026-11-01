<script lang="ts">
	import { getApp, uid } from '#lib/client/app.svelte.ts';
	import { ALARM_PRESETS, WD } from '#lib/constants.ts';
	import { alarmInput } from '#lib/schemas.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	const f = app.s.family;
	type Row = { id: string | null; emoji: string; label: string; note: string; time: string; days: number[]; who: string[] | 'all'; pts: number; extend: boolean; on: boolean };
	let list = $state<Row[]>(f.alarms.map((a) => ({ ...a, days: [...a.days], who: a.who === 'all' ? 'all' : [...a.who] })));
	let cost = $state(f.extendCost);
	let max = $state(f.extendMax);
	let err = $state('');

	function add(i: number) {
		const [emoji, label, time, extend, pts, days] = ALARM_PRESETS[i];
		const kids = app.s.members.filter((p) => p.kind === 'kid').map((p) => p.id);
		list.push({
			id: null,
			emoji,
			label: pts === 0 && label === 'Custom alarm' ? '' : label,
			note: '',
			time,
			days: [...days],
			extend,
			pts,
			on: true,
			who: extend || label === 'Bedtime' ? kids : 'all'
		});
	}
	function toggleDay(a: Row, d: number) {
		if (!a.days.length) a.days = [0, 1, 2, 3, 4, 5, 6];
		const k = a.days.indexOf(d);
		if (k >= 0) a.days.splice(k, 1);
		else a.days.push(d);
		if (!a.days.length) a.days = [d];
	}
	function toggleWho(a: Row, v: string) {
		if (v === 'all') return (a.who = 'all');
		if (a.who === 'all') a.who = [];
		const k = a.who.indexOf(v);
		if (k >= 0) a.who.splice(k, 1);
		else a.who.push(v);
		if (!a.who.length) a.who = 'all';
	}

	async function save() {
		err = '';
		const alarms = list
			.filter((a) => /^\d\d:\d\d$/.test(a.time || ''))
			.map((a) => ({
				id: a.id ?? uid(),
				emoji: a.emoji.trim() || '⏰',
				label: a.label.trim() || 'Alarm',
				note: a.note.trim(),
				time: a.time,
				days: a.days.length === 7 ? [] : [...a.days].sort(),
				who: a.who === 'all' || !a.who.length ? ('all' as const) : [...a.who],
				pts: a.pts,
				extend: a.extend,
				on: a.on
			}))
			.sort((x, y) => x.time.localeCompare(y.time));
		const parsed = alarmInput.array().safeParse(alarms);
		if (!parsed.success) {
			err = 'Check the alarm details';
			return;
		}
		app.sheet = null;
		f.alarms = parsed.data;
		f.extendCost = cost;
		f.extendMax = max;
		if (await app.send({ op: 'alarms.save', alarms: parsed.data, extendCost: cost, extendMax: max })) app.showToast('Alarms saved');
	}
	const sm = 'padding:6px 10px;font-size:13px';
</script>

<Sheet>
	<h3>⏰ Alarms</h3>
	<p class="sub">
		Each alarm rings full-screen with a chime on the devices of the people it’s for (kids’ alarms also on grown-ups’ phones) until someone taps OK. “Everyone” alarms
		ring on every device and one tap stops them for all. Only works while Hausfrieden is open.
	</p>
	{#each list as a, i (i)}
		<div class="card" style="padding:12px;margin-bottom:10px">
			<div class="person-edit">
				<input bind:value={a.emoji} maxlength="4" aria-label="Emoji" />
				<input bind:value={a.label} placeholder="e.g. Leave the house" />
				<input type="time" bind:value={a.time} style="flex:none;width:132px" />
			</div>
			<input bind:value={a.note} placeholder="Note (optional), e.g. shoes, bags, lunch boxes!" style="width:100%;padding:10px;border-radius:12px;border:1.5px solid var(--line);background:#fff;margin-bottom:10px" />
			<div class="chips" style="margin-bottom:8px">
				{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
					<button type="button" class="chip" class:on={!a.days.length || a.days.includes(d)} style={sm} onclick={() => toggleDay(a, d)}>{WD[d]}</button>
				{/each}
			</div>
			<div class="chips" style="margin-bottom:8px">
				<button type="button" class="chip" class:on={a.who === 'all'} style={sm} onclick={() => toggleWho(a, 'all')}>👨‍👩‍👧‍👦 Everyone</button>
				{#each app.s.members as p (p.id)}
					<button type="button" class="chip" class:on={a.who !== 'all' && a.who.includes(p.id)} style={sm} onclick={() => toggleWho(a, p.id)}>{p.emoji} {p.name}</button>
				{/each}
			</div>
			<div class="chips" style="margin-bottom:8px;align-items:center">
				<span style="font-size:13px;color:var(--muted);font-weight:700">Points for doing it:</span>
				{#each [0, 5, 10] as n (n)}
					<button type="button" class="chip" class:on={a.pts === n} style="padding:5px 10px;font-size:13px" onclick={() => (a.pts = n)}>{n ? '+' + n : 'none'}</button>
				{/each}
			</div>
			<label class="row-between" style="font-size:14px;font-weight:700;margin-bottom:6px">
				<span>Can pay points for 10 more minutes</span>
				<input type="checkbox" bind:checked={a.extend} style="width:22px;height:22px;accent-color:var(--accent)" />
			</label>
			<div class="row-between">
				<label style="display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px">
					<input type="checkbox" bind:checked={a.on} style="width:22px;height:22px;accent-color:var(--accent)" /> On
				</label>
				<button class="btn danger" style="padding:7px 12px;font-size:13px" onclick={() => list.splice(i, 1)}>Delete</button>
			</div>
		</div>
	{/each}
	<div class="field">
		<span>Add an alarm</span>
		<div class="chips">
			{#each ALARM_PRESETS as p, i (i)}<button class="chip" onclick={() => add(i)}>+ {p[0]} {p[1]}</button>{/each}
		</div>
	</div>
	{#if list.some((a) => a.extend)}
		<div class="field">
			<span>10 more minutes costs</span>
			<div class="chips">
				{#each [10, 20, 30, 50] as n (n)}<button type="button" class="chip" class:on={cost === n} onclick={() => (cost = n)}>{n} pts</button>{/each}
			</div>
		</div>
		<div class="field">
			<span>Extensions allowed per alarm, per day</span>
			<div class="chips">
				{#each [1, 2, 3] as n (n)}<button type="button" class="chip" class:on={max === n} onclick={() => (max = n)}>{n}</button>{/each}
			</div>
		</div>
	{/if}
	{#if err}<p class="err">{err}</p>{/if}
	<div class="gap">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
