<script lang="ts">
	import { ideasFor, type Budget, type IDEAS } from '#lib/constants.ts';

	let {
		kind,
		budget,
		pick
	}: { kind: keyof typeof IDEAS; budget: Budget; pick: (idea: { label: string; emoji: string; cost?: number }) => void } = $props();
</script>

<div class="chips" style="gap:6px;margin-top:8px">
	{#each ideasFor(kind, budget) as [emoji, label, , cost] (label)}
		<button
			type="button"
			class="chip"
			style="font-size:12.5px;padding:6px 10px;background:#fff;border:1.5px solid var(--line)"
			onclick={() => pick({ label, emoji, cost })}>{emoji} {label}</button
		>
	{/each}
</div>
