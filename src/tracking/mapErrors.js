/**
 * Turns "the map is blank" into something a person (and the site owner) can act on.
 *  • `tokenProblem(token)`  — checks the browser map token itself.
 *  • `describeMapError(err)` — classifies an error from Mapbox GL; returns null for harmless ones (e.g. one missing tile).
 * Each result is `{ message, detail }`: `message` is what the customer sees, `detail` is the technical hint logged to the console.
 */
export function tokenProblem(token) {
  const t = (token || "").trim();
  if (!t) return { message: "Map selection isn't available right now. You can still use “Use my current location”.", detail: "VITE_MAPBOX_TOKEN is not set. Set it in the frontend's environment (Vercel → Settings → Environment Variables, for Production) and REDEPLOY — Vite bakes it in at build time." };
  if (t.startsWith("sk.")) return { message: "The map can't load on this site right now. You can still use “Use my current location”.", detail: "VITE_MAPBOX_TOKEN is a SECRET token (sk.…). Browsers must use a public token (pk.…). Rotate the secret one — it has been exposed in the page — and put a pk. token here." };
  if (!t.startsWith("pk.")) return { message: "The map can't load on this site right now. You can still use “Use my current location”.", detail: "VITE_MAPBOX_TOKEN doesn't look like a Mapbox public token (should start with pk.). Check for a typo or extra spaces/quotes." };
  return null;
}

const NO_MAP = "The map couldn't load. You can still use “Use my current location”, or try again in a moment.";

export function describeMapError(err) {
  if (!err) return null;
  const status = err.status ?? err.statusCode;
  const text = String(err.message || err);
  if (status === 401) return { message: NO_MAP, detail: "Mapbox rejected the token (401). The token is invalid, revoked or mistyped." };
  if (status === 403) return { message: NO_MAP, detail: "Mapbox refused this website (403). If the token has URL restrictions, add this site's exact address, e.g. https://vyrapro.vercel.app/ (and any custom domain), in Mapbox → Tokens → URL restrictions." };
  if (status === 429) return { message: NO_MAP, detail: "Mapbox rate limit / free quota reached (429)." };
  if (/webgl/i.test(text)) return { message: "This browser or device can't display the map. You can still use “Use my current location”.", detail: `WebGL unavailable: ${text}` };
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) return { message: "Couldn't reach the map service. Check your internet connection, or use “Use my current location”.", detail: `Network error loading the map: ${text}` };
  return null; // a single missing tile etc. — not worth alarming anyone
}

export const MAP_LOAD_TIMEOUT = { message: "The map is taking too long to load. You can still use “Use my current location”.", detail: "The map didn't finish loading within 15 s (slow network, a blocked mapbox.com request, or an ad/privacy blocker)." };

/** True when this browser can create a WebGL context (Mapbox GL needs one). */
export function hasWebGL(doc = globalThis.document) {
  try { const c = doc.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
