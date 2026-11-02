// Client-rendered SPA: all data comes from the JSON API (see src/routes/api), so the same code runs
// in the web build (Cloudflare) and in the Capacitor build (adapter-static, `vite build --mode native`).
export const ssr = false;
