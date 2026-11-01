import { env } from 'cloudflare:workers';

// Sends via the Resend REST API (no SDK needed on Workers).
// Without RESEND_API_KEY (e.g. local dev) the email is logged instead.
export async function sendEmail(to: string, subject: string, text: string) {
	if (!env.RESEND_API_KEY) {
		console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
		return;
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ from: env.RESEND_FROM, to, subject, text })
	});
	if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
