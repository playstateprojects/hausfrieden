<script lang="ts">
	import { getApp, hhmm, lsGet, lsSet } from '#lib/client/app.svelte.ts';
	import { chime } from '#lib/client/fx.ts';
	import type { AlarmSlot, MedSlot } from '#lib/logic.ts';

	const app = getApp();
	const h = $derived(app.house);
	const f = $derived(app.s.family);

	// Bumped when a device-local snooze/hide is set, so the derived "ringing" list recomputes.
	let local = $state(0);

	const meds = $derived.by(() => {
		local;
		return h
			.alarmPeople()
			.flatMap((pid) => h.medSlotsToday(pid))
			.filter(
				(s) =>
					!s.took &&
					app.now >= s.at &&
					app.now < s.at + 3 * 36e5 &&
					!lsGet('hf_medhide_' + s.key) &&
					+(lsGet('hf_medsnz_' + s.key) || 0) <= app.now
			);
	});
	const alarms = $derived.by(() => {
		local;
		return h
			.alarmSlots()
			.filter(
				(s) =>
					!s.ack &&
					app.now >= s.at &&
					app.now < s.at + 36e5 &&
					!lsGet('hf_ahide_' + s.key + '_' + s.at) &&
					+(lsGet('hf_asnz_' + s.key) || 0) <= app.now
			)
			.sort((x, y) => y.at - x.at);
	});
	const med = $derived<MedSlot | undefined>(meds[0]);
	const alarm = $derived<AlarmSlot | undefined>(med ? undefined : alarms[0]);
	const shown = $derived(med ? 'med:' + med.key : alarm ? 'al:' + alarm.key + alarm.at : null);

	// chime when a new alarm appears, then every 20 seconds until it is dealt with
	$effect(() => {
		if (!shown) return;
		chime();
		const t = setInterval(chime, 20_000);
		return () => clearInterval(t);
	});

	// 5-minute heads-up for alarms that can be extended (screens off)
	$effect(() => {
		const now = app.now;
		for (const s of h.alarmSlots()) {
			if (!s.a.extend || s.ack) continue;
			const k = 'hf_awarn_' + s.key + '_' + s.at;
			if (now >= s.at - 5 * 6e4 && now < s.at && !lsGet(k)) {
				lsSet(k, '1');
				const p = h.person(s.t);
				app.showToast(`${s.a.emoji || '⏰'} 5 minutes until ${s.a.label.toLowerCase()}${p && s.t !== app.me ? ' for ' + p.name : ''}`);
			}
		}
	});

	const slotTitle = (s: AlarmSlot) => {
		const p = h.person(s.t),
			lab = s.a.label || 'Alarm';
		if (s.t === 'all') return lab + '!';
		return s.t === app.me ? `${lab}, ${p?.name}!` : `${p?.name}: ${lab}`;
	};

	function medSnooze(s: MedSlot) {
		lsSet('hf_medsnz_' + s.key, String(Date.now() + 6e5));
		local++;
		app.showToast('⏰ Reminding again in 10 minutes');
	}
	function medHide(s: MedSlot) {
		lsSet('hf_medhide_' + s.key, '1');
		local++;
	}
	function snooze(s: AlarmSlot) {
		lsSet('hf_asnz_' + s.key, String(Date.now() + 5 * 6e4));
		local++;
		app.showToast('😴 Snoozing 5 minutes');
	}
	function hide(s: AlarmSlot) {
		lsSet('hf_ahide_' + s.key + '_' + s.at, '1');
		local++;
	}
	function ack(s: AlarmSlot) {
		app.ackAlarm(s.key);
	}
	function extend(s: AlarmSlot) {
		app.extendAlarm(s.key);
	}
</script>

{#if med}
	{@const p = h.person(med.pid)}
	{@const mine = med.pid === app.me}
	<div class="alarm show">
		<div class="alarm-box">
			<div style="font-size:64px">💊</div>
			<h2 style="font-size:28px;margin:6px 0">{mine ? `Medicine time, ${p?.name}` : `${p?.name}’s medicine`}</h2>
			<p style="opacity:.9;margin:0 0 4px;font-size:19px;font-weight:800">{med.m.label || 'Medicine'}</p>
			<p style="opacity:.75;margin:0 0 20px">{med.time}{med.m.note ? ' · ' + med.m.note : ''}</p>
			<button class="btn block" style="background:#9FE0C4;color:#1B1930;padding:16px;font-size:17px" onclick={() => app.medTaken(med.key)}>✓ Taken</button>
			<button class="btn block mt" style="background:rgba(255,255,255,.14)" onclick={() => medSnooze(med)}>⏰ Remind me in 10 minutes</button>
			{#if !mine}<button class="note" style="color:#fff;opacity:.7;display:block;margin:18px auto 0;font-weight:700" onclick={() => medHide(med)}>Hide on this phone</button>{/if}
		</div>
	</div>
{:else if alarm}
	{@const who = alarm.t === 'all' ? app.me! : alarm.t}
	{@const mine = alarm.t === app.me || alarm.t === 'all'}
	{@const pts = alarm.a.pts ? h.award(alarm.a.pts, who) : 0}
	<div class="alarm show">
		<div class="alarm-box">
			<div style="font-size:64px">{alarm.a.emoji || '⏰'}</div>
			<h2 style="font-size:30px;margin:6px 0">{slotTitle(alarm)}</h2>
			<p style="opacity:.85;margin:0 0 20px">
				It’s {hhmm(alarm.at)}{alarm.ext ? ` (after ${alarm.ext} extension${alarm.ext > 1 ? 's' : ''})` : ''}{alarm.a.note ? ' · ' + alarm.a.note : ''}
			</p>
			<button class="btn block" style="background:#FFD27A;color:#2A2833;padding:16px;font-size:17px" onclick={() => ack(alarm)}>✓ {alarm.a.extend ? 'Done' : 'OK, on it'}{pts ? ` (+${pts} pts)` : ''}</button>
			{#if alarm.a.extend && alarm.t !== 'all'}
				{@const can = alarm.ext < f.extendMax && h.balance(alarm.t) >= f.extendCost}
				<button class="btn block mt" style="background:rgba(255,255,255,.14)" disabled={!can} onclick={() => extend(alarm)}>⏰ 10 more minutes — {f.extendCost} pts</button>
				{#if !can}
					<p style="font-size:13px;opacity:.75;margin:8px 0 0">
						{alarm.ext >= f.extendMax ? `No more extensions today (max ${f.extendMax})` : `Needs ${f.extendCost} pts — has ${h.balance(alarm.t)}`}
					</p>
				{/if}
			{:else}
				<button class="btn block mt" style="background:rgba(255,255,255,.14)" onclick={() => snooze(alarm)}>😴 Snooze 5 minutes</button>
			{/if}
			{#if !mine}<button class="note" style="color:#fff;opacity:.7;display:block;margin:18px auto 0;font-weight:700" onclick={() => hide(alarm)}>Hide on this phone</button>{/if}
		</div>
	</div>
{/if}
