<script lang="ts">
	import { getApp, hhmm } from '#lib/client/app.svelte.ts';

	const app = getApp();
	const h = $derived(app.house);
	const f = $derived(app.s.family);
	const rows = $derived(h.alarmSlots().filter((s) => s.at > app.now - 36e5 && s.at < app.now + 12 * 36e5));
</script>

{#if rows.length}
	<div class="card" style="background:#2E2B4A;color:#fff">
		<div class="row-between">
			<b>⏰ Alarms today</b>
			<button onclick={() => (app.sheet = { kind: 'alarms' })} style="color:#fff;opacity:.8;font-weight:800;font-size:13px">✏️ Edit</button>
		</div>
		{#each rows as s (s.key)}
			{@const p = h.person(s.t)}
			{@const mins = Math.round((s.at - app.now) / 6e4)}
			{@const canExt = s.a.extend && s.t === app.me && !s.ack && s.ext < f.extendMax && h.balance(s.t) >= f.extendCost}
			<div class="row-between" style="margin-top:10px;font-size:14.5px;{s.ack ? 'opacity:.55' : ''}">
				<span>{hhmm(s.at)} {s.a.emoji || '⏰'} {s.a.label}{s.t === 'all' ? '' : ` · ${s.t === app.me ? 'You' : p?.name}`}</span>
				<span style="display:flex;gap:8px;align-items:center">
					{#if s.ack}<span style="opacity:.7">done ✓</span>
					{:else if mins <= 0}<b style="color:#FFD27A">now</b>
					{:else}<span style="opacity:.7">in {mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' min'}</span>{/if}
					{#if canExt}
						<button class="chip" style="background:rgba(255,255,255,.15);color:#fff;padding:5px 9px;font-size:12px" onclick={() => app.extendAlarm(s.key)}>+10 min · {f.extendCost}</button>
					{/if}
				</span>
			</div>
		{/each}
	</div>
{/if}
