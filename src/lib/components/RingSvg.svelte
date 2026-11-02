<script lang="ts">
	let { p }: { p: number } = $props();
	const c = 2 * Math.PI * 8;
	const full = $derived(p >= 0.999);
</script>

<svg width="22" height="22" viewBox="0 0 22 22" style="display:block;margin:3px auto 0">
	<circle cx="11" cy="11" r="8" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="3.2" />
	<circle
		cx="11"
		cy="11"
		r="8"
		fill="none"
		stroke={full ? 'var(--ok)' : 'var(--warm)'}
		stroke-width="3.2"
		stroke-linecap="round"
		stroke-dasharray="{(c * p).toFixed(1)} {c.toFixed(1)}"
		transform="rotate(-90 11 11)"
	/>
	{#if full}<path d="M7.5 11.2l2.3 2.3 4.6-5" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" />{/if}
</svg>
