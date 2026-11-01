<script lang="ts">
	import { getApp, uid } from '#lib/client/app.svelte.ts';
	import { WD } from '#lib/constants.ts';
	import { medInput } from '#lib/schemas.ts';
	import Sheet from './Sheet.svelte';

	const app = getApp();
	type Row = { id: string | null; created: number; who: string; label: string; note: string; times: string[]; days: number[]; on: boolean };
	let list = $state<Row[]>(app.s.family.meds.map((m) => ({ ...m, times: [...m.times], days: [...m.days] })));
	let err = $state('');
	const field = 'padding:8px 10px;border-radius:10px;border:1.5px solid var(--line);background:#fff';

	const add = () => list.push({ id: null, created: 0, who: app.me!, label: '', note: '', times: ['08:00'], days: [], on: true });
	function toggleDay(m: Row, d: number) {
		if (!m.days.length) m.days = [0, 1, 2, 3, 4, 5, 6];
		const k = m.days.indexOf(d);
		if (k >= 0) m.days.splice(k, 1);
		else m.days.push(d);
		if (!m.days.length) m.days = [d];
	}

	async function save() {
		err = '';
		const start = app.house.startOfDay;
		const meds = list
			.map((m) => ({
				id: m.id ?? uid(),
				created: m.created || start,
				who: m.who,
				label: m.label.trim() || 'Medicine',
				note: m.note.trim(),
				times: m.times.filter((t) => /^\d\d:\d\d$/.test(t)).sort(),
				days: m.days.length === 7 ? [] : [...m.days].sort(),
				on: m.on
			}))
			.filter((m) => m.times.length);
		const parsed = medInput.array().safeParse(meds);
		if (!parsed.success) {
			err = 'Check the medicine details';
			return;
		}
		app.sheet = null;
		app.s.family.meds = parsed.data;
		if (await app.send({ op: 'meds.save', meds: parsed.data })) app.showToast('Medicine reminders saved');
	}
</script>

<Sheet>
	<h3>💊 Medicine reminders</h3>
	<p class="sub">
		An alarm rings at each time on the person’s own device (and grown-ups’ phones for the kids) until it’s ticked off. Only works while Hausfrieden is open.
	</p>
	{#each list as m, i (i)}
		<div class="card" style="padding:12px;margin-bottom:10px">
			<div class="row-between">
				<select bind:value={m.who} style="{field};font-weight:700">
					{#each app.s.members as p (p.id)}<option value={p.id}>{p.emoji} {p.name}</option>{/each}
				</select>
				<label style="display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px">
					On <input type="checkbox" bind:checked={m.on} style="width:22px;height:22px;accent-color:var(--accent)" />
				</label>
			</div>
			<label class="field mt" style="margin-bottom:8px"><span>What</span><input bind:value={m.label} placeholder="e.g. Morning tablet, inhaler, vitamin D" /></label>
			<label class="field" style="margin-bottom:8px"><span>Note (optional)</span><input bind:value={m.note} placeholder="e.g. with food" /></label>
			<div class="field" style="margin-bottom:8px">
				<span>Times</span>
				<div class="chips">
					{#each m.times as _t, j (j)}
						<span style="display:flex;gap:4px">
							<input type="time" bind:value={m.times[j]} style={field} />
							{#if m.times.length > 1}<button class="x" style="width:34px" onclick={() => m.times.splice(j, 1)} aria-label="Remove time">×</button>{/if}
						</span>
					{/each}
					<button class="chip" onclick={() => m.times.push('20:00')}>+ time</button>
				</div>
			</div>
			<div class="field" style="margin-bottom:8px">
				<span>Days</span>
				<div class="chips">
					{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
						<button type="button" class="chip" class:on={!m.days.length || m.days.includes(d)} onclick={() => toggleDay(m, d)}>{WD[d]}</button>
					{/each}
				</div>
			</div>
			<button class="btn danger" style="padding:8px 12px;font-size:13.5px" onclick={() => list.splice(i, 1)}>Delete reminder</button>
		</div>
	{/each}
	<button class="btn ghost block" onclick={add}>+ Add a medicine reminder</button>
	{#if err}<p class="err mt">{err}</p>{/if}
	<div class="gap mt">
		<button class="btn ghost" onclick={() => (app.sheet = null)}>Cancel</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
