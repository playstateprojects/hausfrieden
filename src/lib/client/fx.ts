// Confetti and chime, ported from the original artifact.

let canvas: HTMLCanvasElement | null = null;
function getCanvas() {
	if (!canvas) {
		canvas = document.createElement('canvas');
		canvas.id = 'confetti';
		document.body.appendChild(canvas);
	}
	return canvas;
}

export function burst(n = 70) {
	if (typeof window === 'undefined') return;
	const cv = getCanvas(),
		ctx = cv.getContext('2d');
	if (!ctx) return;
	const W = (cv.width = innerWidth),
		H = (cv.height = innerHeight);
	const cols = ['#F09A4A', '#2F7D6D', '#FFD27A', '#DD6550', '#9FD4C2', '#C9B6F2'];
	const ps = Array.from({ length: n }, () => ({
		x: W / 2 + (Math.random() - 0.5) * 80,
		y: H * 0.62,
		vx: (Math.random() - 0.5) * 12,
		vy: -Math.random() * 14 - 6,
		s: Math.random() * 7 + 4,
		c: cols[Math.floor(Math.random() * cols.length)],
		r: Math.random() * 6,
		vr: (Math.random() - 0.5) * 0.3
	}));
	let fr = 0;
	(function step() {
		ctx.clearRect(0, 0, W, H);
		for (const p of ps) {
			p.vy += 0.45;
			p.x += p.vx;
			p.y += p.vy;
			p.r += p.vr;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.r);
			ctx.fillStyle = p.c;
			ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
			ctx.restore();
		}
		if (++fr < 85) requestAnimationFrame(step);
		else ctx.clearRect(0, 0, W, H);
	})();
}

let audioCtx: AudioContext | null = null;

/** Must be called from a user gesture so the chime can play later. */
export function unlockAudio() {
	try {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		audioCtx = audioCtx ?? new AC();
		if (audioCtx.state === 'suspended') audioCtx.resume();
	} catch {
		/* no audio */
	}
}

export function chime() {
	const ctx = audioCtx;
	if (!ctx) return;
	try {
		[660, 880, 1100].forEach((fq, i) => {
			const o = ctx.createOscillator(),
				g = ctx.createGain(),
				t = ctx.currentTime + i * 0.18;
			o.frequency.value = fq;
			o.type = 'sine';
			g.gain.setValueAtTime(0.0001, t);
			g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
			o.connect(g).connect(ctx.destination);
			o.start(t);
			o.stop(t + 0.7);
		});
	} catch {
		/* ignore */
	}
}
