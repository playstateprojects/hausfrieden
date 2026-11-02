<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { RING_BONUS } from '#lib/constants.ts';
	import RingSvg from './RingSvg.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const day = $derived(h.startOfDay);
	const list = $derived(h.ringTasks(app.me!, day));
	const left = $derived(list.filter((t) => !h.ringDone(t, app.me!, day)));
	const done = $derived(list.length - left.length);
	const p = $derived(list.length ? done / list.length : 0);
	const closed = $derived(p >= 1);
	const bonus = $derived(h.award(RING_BONUS, app.me!));
</script>

{#if list.length}
	<div class="card" style="display:flex;gap:12px;align-items:center;padding:12px 14px;{closed ? 'background:var(--accent-soft)' : ''}">
		<div style="transform:scale(1.9);margin:6px 8px"><RingSvg {p} /></div>
		<div style="flex:1;font-size:14px">
			<b>{closed ? 'Ring closed today! ⭕' : `Close your ring: ${done}/${list.length}`}</b>
			<div class="sub" style="margin:2px 0 0">
				{#if closed}+{bonus} bonus earned. Legend.{:else}Finish your own things for today for a +{bonus} bonus.{#if left.length <= 3}
						Left: {left.map((t) => t.name).join(', ')}{/if}{/if}
			</div>
		</div>
	</div>
{/if}
