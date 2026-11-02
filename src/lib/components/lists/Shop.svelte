<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import { aisleInfo, aisleOf, AISLE_ORDER } from '#lib/shop.ts';

	const app = getApp();
	const all = $derived(app.s.shopping);
	const open = $derived(all.filter((x) => !x.done && !x.cleared));
	const basket = $derived(all.filter((x) => x.done && !x.cleared).sort((a, b) => b.done - a.done));
	const recent = $derived.by(() => {
		const onList = new Set(open.concat(basket).map((x) => x.text.toLowerCase()));
		const seen = new Set<string>();
		const out: string[] = [];
		for (const x of all.filter((q) => q.cleared).sort((a, b) => b.cleared - a.cleared)) {
			const k = x.text.toLowerCase();
			if (!seen.has(k) && !onList.has(k)) {
				seen.add(k);
				out.push(x.text);
			}
		}
		return out.slice(0, 12);
	});
	const groups = $derived(
		AISLE_ORDER.map((id) => [id, open.filter((x) => (x.aisle || aisleOf(x.text)) === id).sort((a, b) => a.createdAt - b.createdAt)] as const).filter((g) => g[1].length)
	);

	let text = $state('');
	let copyText = $state<string | null>(null);
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const v = text;
		text = '';
		await app.addShop(v);
	}
</script>

<div class="row-between" style="margin:4px 0 12px">
	<div>
		<h2 class="hello" style="margin:0">Shopping list</h2>
		<p class="sub" style="margin:2px 0 0">{open.length ? `${open.length} thing${open.length > 1 ? 's' : ''} to get` : 'Nothing needed right now'} · shared with everyone</p>
	</div>
	{#if open.length}<button class="chip" onclick={async () => (copyText = await app.copyShopping())}>📋 Copy</button>{/if}
</div>
<form class="quick-add" onsubmit={submit}>
	<input bind:value={text} placeholder="Add items, e.g. milk, bread, apples" autocomplete="off" enterkeyhint="done" />
	<button type="submit" class="qa-add" aria-label="Add">+</button>
</form>
{#if copyText}
	<div class="card mt">
		<p class="sub">Copy this text:</p>
		<textarea readonly style="width:100%;height:220px;border-radius:12px;border:1.5px solid var(--line);padding:10px;font:inherit" value={copyText}></textarea>
		<button class="btn block mt" onclick={() => (copyText = null)}>Close</button>
	</div>
{/if}
{#if recent.length}
	<div class="chips" style="margin:10px 0 0;gap:6px;align-items:center">
		<span style="font-size:12.5px;font-weight:800;color:var(--muted)">Add again:</span>
		{#each recent as r (r)}
			<button class="chip" style="padding:5px 10px;font-size:13px;background:#fff;border:1.5px solid var(--line)" onclick={() => app.shopAgain(r)}>+ {r}</button>
		{/each}
	</div>
{/if}
{#if !open.length && !basket.length}
	<div class="empty" style="padding-top:30px"><div class="emoji">🛒</div>Anyone can add things here — the kids too.<br />Separate several items with commas.</div>
{/if}
{#each groups as [id, xs] (id)}
	{@const a = aisleInfo(id)}
	<div class="day-grp">{a[1]} {a[2]} <span>{xs.length}</span></div>
	{#each xs as x (x.id)}
		{@const p = app.house.person(x.memberId)}
		<div class="shop">
			<button class="sbox" onclick={() => app.setShopDone(x.id, Date.now())} aria-label="Got it"></button>
			<span class="stext">{x.text}</span>
			{#if p}<span class="mini-av" style="background:{p.color}" title={p.name}>{p.emoji}</span>{/if}
			<button class="tbtn" onclick={() => app.deleteShop(x.id)} aria-label="Remove">×</button>
		</div>
	{/each}
{/each}
{#if basket.length}
	<div class="sec-title">
		🧺 In the basket <small><button onclick={() => app.clearBasket()} style="color:var(--accent);font-weight:800">Clear {basket.length}</button></small>
	</div>
	{#each basket as x (x.id)}
		<div class="shop got">
			<button class="sbox on" onclick={() => app.setShopDone(x.id, 0)} aria-label="Put back">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
			</button>
			<span class="stext">{x.text}</span>
		</div>
	{/each}
{/if}
