<script lang="ts">
	import { getApp, hhmm } from '#lib/client/app.svelte.ts';
	import { CATS, WD } from '#lib/constants.ts';
	import type { Todo } from '#lib/types.ts';

	let { t }: { t: Todo } = $props();
	const app = getApp();
	const c = $derived(CATS[t.cat] ?? CATS.personal);
	const old = $derived(!t.done && t.createdAt < app.house.startOfDay);
</script>

<div class="todo" class:done={!!t.done} class:popin={app.justDone === t.id} style="--cat:{c[3]}">
	<button class="tcheck" onclick={() => (t.done ? app.patchTodo(t.id, { done: 0 }) : app.doneTodo(t.id))} aria-label={t.done ? 'Not done' : 'Done'}>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
	</button>
	<button class="ttext" onclick={() => (app.sheet = { kind: 'todo', id: t.id })}>
		<span>{t.text}</span>
		<small>{c[0]} {c[1]}{old ? ` · from ${WD[new Date(t.createdAt).getDay()]}` : ''}{t.done ? ` · done ${hhmm(t.done)}` : ''}</small>
	</button>
	{#if !t.done}
		<button class="tbtn" class:on={t.star} onclick={() => app.patchTodo(t.id, { star: !t.star })} aria-label="Must do">{t.star ? '★' : '☆'}</button>
		<button class="tbtn" onclick={() => app.focusOnTodo(t.id)} aria-label="Focus on this">⏱</button>
	{/if}
</div>
