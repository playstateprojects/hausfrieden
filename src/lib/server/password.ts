// Password hashing with WebCrypto PBKDF2.
//
// better-auth's default (scrypt in JS) can exceed the CPU-time limit on Cloudflare's
// free plan. PBKDF2 runs natively in the Workers runtime, which caps it at 100k iterations.
// Stored format: pbkdf2$<iterations>$<salt b64>$<hash b64>

const ITERATIONS = 100_000;
const KEY_BITS = 256;

const b64 = (buf: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password.normalize('NFKC')),
		'PBKDF2',
		false,
		['deriveBits']
	);
	return crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
		key,
		KEY_BITS
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derive(password, salt, ITERATIONS);
	return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	const [scheme, iter, saltB64, hashB64] = stored.split('$');
	if (scheme !== 'pbkdf2' || !iter || !saltB64 || !hashB64) return false;
	const expected = unb64(hashB64);
	const actual = new Uint8Array(await derive(password, unb64(saltB64), Number(iter)));
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}
