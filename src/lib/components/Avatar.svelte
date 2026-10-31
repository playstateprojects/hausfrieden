<script lang="ts">
	import type { Member } from '#lib/types.ts';
	let { p, lg = false }: { p: Member | undefined; lg?: boolean } = $props();
</script>

<span class="av" class:lg style="background:{p?.color ?? '#EEE'}">{p?.emoji ?? '🙂'}</span>
