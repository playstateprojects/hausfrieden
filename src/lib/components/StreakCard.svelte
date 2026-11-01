<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { MILESTONES } from '#lib/constants.ts';

	const app = getApp();
	const h = $derived(app.house);
	const s = $derived(h.streak(app.me!));
	const today = $derived(h.didToday(app.me!));
	const nm = $derived(h.nextMilestone(s));
	const msg = $derived(today ? 'Kept going today ✓' : s ? 'Tick off one thing today to keep it going!' : 'Tick off anything today to start one.');
</script>

<div class="card" style="display:flex;gap:14px;align-items:center;background:{today ? '#FFF4DC' : '#FDEBD8'}">
	<div style="font-size:{s ? 38 : 30}px;filter:{s ? 'none' : 'grayscale(1)'}">🔥</div>
	<div style="flex:1">
		<b style="font-size:17px">{s ? `${s}-day streak` : 'No streak yet'}</b>
		<div class="sub" style="margin:2px 0 0">
			{msg}{#if nm}<br />{nm - s} more day{nm - s > 1 ? 's' : ''} to the {nm}-day bonus (+{MILESTONES[nm]}){/if}
		</div>
	</div>
</div>
