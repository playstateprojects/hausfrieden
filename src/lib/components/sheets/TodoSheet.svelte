<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { CATS } from '#lib/constants.ts';
	import type { TodoCat } from '#lib/types.ts';
	import Sheet from './Sheet.svelte';

	let { id }: { id: string } = $props();
	const app = getApp();
	// svelte-ignore state_referenced_locally
	const t = app.s.todos.find((x) => x.id === id);
	let text = $state(t?.text ?? '');
	let cat = $state<TodoCat>(t?.cat ?? 'work');
	let star = $state(!!t?.star);

	async function save() {
		const v = text.trim();
		if (!t || !v) return;
		app.sheet = null;
		await app.patchTodo(id, { text: v, cat, star });
	}
	async function del() {
		app.sheet = null;
		await app.deleteTodo(id);
		app.showToast('Deleted');
	}
</script>

<Sheet>
	<h3>Edit</h3>
	<label class="field"><span>Task</span><input bind:value={text} /></label>
	<div class="field">
		<span>Type</span>
		<div class="chips">
			{#each Object.entries(CATS) as [k, c] (k)}
				<button type="button" class="chip" class:on={cat === k} onclick={() => (cat = k as TodoCat)}>{c[0]} {c[1]}</button>
			{/each}
		</div>
	</div>
	<label class="toggle"><input type="checkbox" bind:checked={star} /><span><b>⭐ Must do today</b> — goes to the top</span></label>
	<div class="gap mt"><button class="btn danger" onclick={del}>Delete</button><button class="btn" onclick={save}>Save</button></div>
</Sheet>
