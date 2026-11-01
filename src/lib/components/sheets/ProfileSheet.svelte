<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { EMOJIS, SWATCHES } from '#lib/constants.ts';
	import Sheet from './Sheet.svelte';

	let { id }: { id: string } = $props();
	const app = getApp();
	const h = app.house;
	// svelte-ignore state_referenced_locally
	const p = h.person(id)!;
	// svelte-ignore state_referenced_locally
	const pid = id;
	let name = $state(p.name);
	let emoji = $state(p.emoji);
	let custom = $state('');
	let color = $state(p.color);
	const s = h.streak(pid);

	async function save() {
		const nm = name.trim();
		if (!nm) return;
		const em = custom.trim() || emoji;
		app.sheet = null;
		Object.assign(p, { name: nm, emoji: em, color });
		if (await app.send({ op: 'member.profile', id, name: nm, emoji: em, color })) app.showToast('Looking good!');
	}
</script>

<Sheet>
	<div class="center">
		<div style="display:inline-grid;place-items:center;width:84px;height:84px;border-radius:50%;font-size:44px;background:{color}">{custom.trim() || emoji}</div>
		<p class="sub" style="margin:8px 0 0">{s ? `🔥 ${s}-day streak · ` : ''}{h.balance(pid)} points to spend</p>
	</div>
	<label class="field mt"><span>Name</span><input bind:value={name} /></label>
	<div class="field">
		<span>Pick your emoji</span>
		<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
			{#each EMOJIS as e (e)}
				<button type="button" onclick={() => (emoji = e)} style="font-size:24px;padding:6px 0;border-radius:10px;{e === emoji && !custom.trim() ? 'background:var(--accent-soft)' : ''}">{e}</button>
			{/each}
		</div>
		<input bind:value={custom} placeholder="…or type/paste any emoji" maxlength="4" style="margin-top:8px" />
	</div>
	<div class="field">
		<span>Colour</span>
		<div class="chips">
			{#each SWATCHES as c (c)}
				<button type="button" aria-label={c} onclick={() => (color = c)} style="width:34px;height:34px;border-radius:50%;background:{c};border:3px solid {c === color ? 'var(--accent)' : 'transparent'}"></button>
			{/each}
		</div>
	</div>
	<div class="gap">
		<button class="btn ghost" onclick={() => { app.sheet = null; app.pickMe(null); }}>Switch person</button>
		<button class="btn" onclick={save}>Save</button>
	</div>
</Sheet>
