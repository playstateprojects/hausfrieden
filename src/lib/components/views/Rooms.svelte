<script lang="ts">
	import { getApp } from '#lib/client/app.svelte.ts';
	import TaskRow from '../TaskRow.svelte';

	const app = getApp();
	const h = $derived(app.house);
	const current = $derived(app.room ? h.roomOf(app.room) : null);
	const roomTasks = $derived(
		app.room ? app.s.tasks.filter((t) => t.roomId === app.room).sort((a, b) => h.ratio(b) - h.ratio(a)) : []
	);
	const cards = $derived(
		app.s.rooms.map((r) => {
			const ts = app.s.tasks.filter((t) => t.roomId === r.id);
			const fresh = ts.length
				? Math.round((ts.reduce((s, t) => s + Math.max(0, Math.min(1, 1 - h.ratio(t))), 0) / ts.length) * 100)
				: 100;
			const due = ts.filter((t) => h.ratio(t) >= 1).length;
			const col = fresh > 60 ? 'var(--ok)' : fresh > 30 ? 'var(--soon)' : 'var(--due)';
			return { r, ts, fresh, due, col };
		})
	);
</script>

{#if current}
	<button class="back" onclick={() => (app.room = null)}>‹ All rooms</button>
	<h2 class="hello">{current.emoji} {current.name}</h2>
	<p class="sub">{roomTasks.length} tasks · tap a task to edit it</p>
	{#each roomTasks as t (t.id)}<TaskRow {t} noRoom />{:else}<div class="empty">No tasks here yet.</div>{/each}
	<button class="btn ghost block mt" onclick={() => (app.sheet = { kind: 'task', id: null, roomId: app.room })}>+ Add a task to {current.name}</button>
{:else}
	<h2 class="hello">Rooms</h2>
	<p class="sub">The fuller the bar, the fresher the room.</p>
	<div class="rooms">
		{#each cards as c (c.r.id)}
			<button
				class="room"
				style="background:{c.r.color}"
				onclick={() => {
					app.room = c.r.id;
					scrollTo(0, 0);
				}}
			>
				<div><span class="emoji">{c.r.emoji}</span><b>{c.r.name}</b></div>
				<div>
					<div class="bar"><i style="width:{c.fresh}%;background:{c.col}"></i></div>
					<small>{c.due ? c.due + ' due' : 'all good'} · {c.ts.length} tasks</small>
				</div>
			</button>
		{/each}
	</div>
	<button class="btn ghost block mt" onclick={() => (app.sheet = { kind: 'rooms' })}>Edit rooms</button>
{/if}
