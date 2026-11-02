<script lang="ts">
	import { getApp, hhmm } from '#lib/client/app.svelte.ts';
	import type { MedSlot } from '#lib/logic.ts';

	let { x, showWho = false, readonly = false }: { x: MedSlot; showWho?: boolean; readonly?: boolean } = $props();
	const app = getApp();
	const p = $derived(app.house.person(x.pid));
	const past = $derived(app.now >= x.at);
	const lateBy = $derived(x.took ? Math.round((x.took.at - x.at) / 6e4) : 0);
	const status = $derived(
		x.took
			? `taken ${hhmm(x.took.at)}${new Date(x.took.at).toDateString() !== new Date(x.at).toDateString() ? ' (ticked later)' : lateBy > 60 ? ' (late)' : ''}`
			: past
				? x.at < app.house.startOfDay
					? 'missed?'
					: 'due now'
				: 'later'
	);
	let confirm = $state(false);

	function tap() {
		if (readonly) return;
		if (!x.took) return app.medTaken(x.key);
		if (!confirm) {
			confirm = true;
			app.showToast('Tap again to untick');
			return;
		}
		confirm = false;
		app.medUntick(x);
	}
</script>

<div class="task" class:done={!!x.took} style="padding:9px 12px">
	<button class="check" onclick={tap} aria-label={x.took ? 'Untick' : 'Tick off'} style={confirm ? 'background:var(--due);border-color:var(--due)' : ''}>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
	</button>
	<div class="t-body">
		<div class="t-name" style="text-decoration:none">{x.m.label || 'Medicine'}</div>
		<div class="t-meta">
			{x.time}{#if showWho && p} · {p.emoji} {x.pid === app.me ? 'You' : p.name}{/if}{#if x.m.note} · {x.m.note}{/if}
		</div>
	</div>
	<span class="pill {x.took ? 'ok' : past ? 'due' : 'soon'}">{status}</span>
</div>
