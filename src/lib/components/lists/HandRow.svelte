<script lang="ts">
	import { getApp, hhmm } from '#lib/client/app.svelte.ts';
	import { CATS } from '#lib/constants.ts';
	import type { Handoff } from '#lib/types.ts';

	let { h, incoming }: { h: Handoff; incoming: boolean } = $props();
	const app = getApp();
	const c = $derived(CATS[h.cat] ?? CATS.personal);
	const other = $derived(app.house.person(incoming ? h.fromId : h.toId));
	let confirm = $state(false);
</script>

{#if incoming}
	<div class="todo" class:done={!!h.done} class:popin={app.justDone === h.id} style="--cat:{c[3]}">
		<button class="tcheck" onclick={() => app.setHandDone(h.id, h.done ? 0 : Date.now())} aria-label={h.done ? 'Not done' : 'Done'}>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
		</button>
		<div class="ttext">
			<span>{h.text}</span>
			<small>{other?.emoji ?? '🙂'} from {other?.name ?? 'Someone'} · {c[0]} {c[1]}{h.done ? ' · done ' + hhmm(h.done) : ''}</small>
		</div>
	</div>
{:else}
	<div class="todo" style="--cat:{c[3]};{h.done ? 'opacity:.65' : ''}">
		<span class="tcheck" style={h.done ? 'background:var(--cat)' : ''}>
			{#if h.done}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
			{:else}<span style="font-size:15px">{other?.emoji ?? '🙂'}</span>{/if}
		</span>
		<div class="ttext"><span>{h.text}</span><small>for {other?.name ?? 'Someone'} · {h.done ? '✓ done ' + hhmm(h.done) : 'waiting'}</small></div>
		<button
			class="tbtn"
			style={confirm ? 'color:var(--due)' : ''}
			onclick={() => (confirm ? app.deleteHand(h.id) : (confirm = true))}
			aria-label="Remove">{confirm ? '?' : '×'}</button
		>
	</div>
{/if}
