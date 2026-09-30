/* Build guard for Vercel deployments (runs from vercel.json's buildCommand).
   Fails the build — instead of shipping a site whose /api calls silently return index.html — when:
     • the /api rewrite still points at the placeholder host, or isn't an https URL that keeps the /api prefix;
     • the /api rewrite doesn't come BEFORE the SPA fallback, or the fallback can swallow /api;
     • VITE_API_URL is an absolute URL (the SameSite=Strict refresh cookie needs same-origin "/api").
   Only enforced when VERCEL is set, so local builds are unaffected. */
import { readFileSync } from "node:fs";

if (!process.env.VERCEL) process.exit(0);

const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const rewrites = cfg.rewrites || [];
const errors = [];

const apiIdx = rewrites.findIndex((r) => r.source.startsWith("/api"));
const fallbackIdx = rewrites.findIndex((r) => r.destination === "/index.html");
if (apiIdx === -1) errors.push('vercel.json has no "/api/:path*" rewrite to the backend.');
else {
  const dest = rewrites[apiIdx].destination;
  let url;
  try { url = new URL(dest.replace(":path*", "x")); } catch { errors.push(`API rewrite destination is not a valid URL: ${dest}`); }
  if (url) {
    if (url.protocol !== "https:") errors.push("API rewrite destination must be https (auth tokens and cookies travel over it).");
    if (/YOUR-VYRA-BACKEND-ORIGIN/i.test(dest)) errors.push("API rewrite still points at the placeholder host. Replace YOUR-VYRA-BACKEND-ORIGIN in frontend/vercel.json with the deployed backend's host.");
    if (!url.pathname.startsWith("/api/")) errors.push('API rewrite destination must keep the "/api" prefix (the backend mounts everything under /api).');
  }
}
if (fallbackIdx !== -1) {
  if (apiIdx > fallbackIdx) errors.push("The /api rewrite must come before the SPA fallback (first match wins).");
  if (new RegExp(`^${rewrites[fallbackIdx].source}$`).test("/api/seller-applications")) errors.push("The SPA fallback pattern matches /api/* and would swallow API calls.");
}
const viteApi = process.env.VITE_API_URL;
if (viteApi && /^https?:\/\//i.test(viteApi)) errors.push(`VITE_API_URL=${viteApi} is an absolute URL. Unset it (or set it to /api) so the browser stays same-origin and the SameSite=Strict refresh cookie works.`);

if (errors.length) {
  console.error("\n✖ Vercel configuration check failed:\n" + errors.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}
console.log("✔ Vercel config OK: /api/* is proxied to", rewrites[apiIdx].destination.replace("/api/:path*", ""));
