<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="app">
	<div class="auth">
		<p class="brand">Haus<span>frieden</span></p>
		<div class="card" style="padding:22px;text-align:center">
			<p>{page.error?.message ?? 'Something went wrong'}</p>
			<button class="btn block mt" onclick={() => location.reload()}>Try again</button>
		</div>
	</div>
</div>
