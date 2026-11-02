<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { ptsFor } from '#lib/logic.ts';
	import type { Task } from '#lib/types.ts';

	let { t, pid, day, canEdit }: { t: Task; pid: string; day: number; canEdit: boolean } = $props();
	const app = getApp();
	const l = $derived(app.house.doneOn(t, pid, day));
	const pts = $derived(app.house.award(ptsFor(t), pid));
	let confirm = $state(false);

	function tap() {
		if (!l) return app.tickPast(pid, day, t.id);
		if (!confirm) {
			confirm = true;
			app.showToast('Tap again to untick');
			return;
		}
		confirm = false;
		app.untickPast(pid, day, t.id);
	}
</script>

<div class="task" class:done={!!l} style="padding:9px 12px">
	{#if canEdit}
		<button class="check" onclick={tap} style={confirm ? 'background:var(--due);border-color:var(--due)' : ''} aria-label={l ? 'Untick' : 'Tick off'}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
		</button>
	{:else}
		<span class="check">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
		</span>
	{/if}
	<div class="t-body">
		<div class="t-name">{t.name}</div>
		<div class="t-meta">{t.mins}m · <span class="pts">+{pts}</span>{l?.fixed ? ' · ticked later' : ''}</div>
	</div>
</div>
