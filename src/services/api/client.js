/* ==========================================================================
   API client — the only place that talks to the backend over HTTP.

   • Access token lives in memory only (never localStorage), so an XSS bug can't
     read it from storage. The long-lived refresh token is an httpOnly cookie the
     browser sends by itself; JavaScript never sees it.
   • On a 401 the client refreshes once (single-flight, so parallel requests
     share one refresh) and replays the request.
   • Every call resolves to the `data` of { success: true, data } or throws ApiError.
   ========================================================================== */

const BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");

/** Absolute-or-relative URL of a public product photo, from the storage key the API returns. */
export const productImageUrl = (key) => `${BASE}/product-images/${encodeURIComponent(key)}`;
/** Inverse of productImageUrl — the storage key if `src` is one of our photo URLs, else null. */
export const productImageKey = (src) => { const m = /\/product-images\/([^/?#]+)$/.exec(String(src || "")); return m ? decodeURIComponent(m[1]) : null; };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** { mobile: "message", email: "message" } — the shape the existing forms already use for `errors`. */
  get fieldErrors() {
    const out = {};
    for (const d of Array.isArray(this.details) ? this.details : []) {
      const key = String(d.path || "").split(".").pop();
      if (key && !out[key]) out[key] = d.message;
    }
    return out;
  }
}

let accessToken = null;
let onSessionLost = null;

export const setAccessToken = (t) => { accessToken = t || null; };
export const hasAccessToken = () => !!accessToken;
/** Called when the session can't be refreshed (expired / revoked) so the app can sign the user out. */
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

async function send(path, { method = "GET", body, auth = true, query, raw = false } = {}) {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString() : "";
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-Vyra-Client": "web",
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }
  // Non-JSON responses (a prescription's file bytes, say) — the caller reads the body itself (e.g. res.blob()).
  if (raw) {
    if (res.ok) return res;
    let json = null;
    try { json = await res.json(); } catch { /* empty / non-JSON body */ }
    throw new ApiError(res.status, json?.code || "UNKNOWN_ERROR", json?.message || `Request failed (${res.status})`, json?.details);
  }
  let json = null;
  try { json = await res.json(); } catch { /* empty / non-JSON body */ }
  if (res.ok && json?.success) return json.data;
  // A 2xx whose body isn't JSON almost always means /api never reached the backend and the host answered with the
  // SPA's index.html (a catch-all rewrite). Say so, instead of the vague "Request failed (200)".
  if (res.ok && json === null && /text\/html/i.test(res.headers?.get?.("content-type") || "")) {
    throw new ApiError(res.status, "API_NOT_ROUTED", "The server returned a web page instead of API data — /api isn't routed to the backend. Check the hosting rewrite for /api.");
  }
  throw new ApiError(res.status, json?.code || "UNKNOWN_ERROR", json?.message || `Request failed (${res.status})`, json?.details);
}

let refreshing = null;

/** Exchanges the refresh cookie for a new access token. Returns the session payload ({ user, accessToken }). */
export function refreshSession() {
  refreshing ??= (async () => {
    try {
      let data;
      try {
        data = await send("/auth/refresh", { method: "POST", auth: false });
      } catch (err) {
        // Another tab rotated the cookie a moment ago; its fresh cookie is already in the browser — try once more.
        if (err.code !== "REFRESH_TOKEN_ROTATED") throw err;
        await new Promise((r) => setTimeout(r, 300));
        data = await send("/auth/refresh", { method: "POST", auth: false });
      }
      setAccessToken(data.accessToken);
      return data;
    } catch (err) {
      setAccessToken(null);
      throw err;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

const AUTH_EXPIRED = new Set(["UNAUTHENTICATED", "INVALID_TOKEN"]);

export async function request(path, opts = {}) {
  try {
    return await send(path, opts);
  } catch (err) {
    if (opts.auth === false || err.status !== 401 || !AUTH_EXPIRED.has(err.code)) throw err;
    try {
      await refreshSession();
    } catch {
      onSessionLost?.();
      throw err;
    }
    return send(path, opts); // replay once with the new token
  }
}

/**
 * Opens a streaming response (Server-Sent Events) with the bearer token — `EventSource` can't send an Authorization header,
 * and the token must never go in a URL. On a 401 the session is refreshed once and the request replayed, exactly like request().
 * Returns the raw Response; the caller reads `res.body`. Aborting `signal` ends it.
 */
export async function streamRequest(path, { signal } = {}) {
  const go = () => fetch(`${BASE}${path}`, {
    method: "GET", credentials: "include", signal, cache: "no-store",
    headers: { Accept: "text/event-stream", "X-Vyra-Client": "web", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  }).catch((err) => { if (err?.name === "AbortError") throw err; throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again."); });
  let res = await go();
  if (res.status === 401) {
    try { await refreshSession(); } catch { onSessionLost?.(); return res; }
    res = await go();
  }
  return res;
}

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body, opts) => request(path, { method: "POST", body: body ?? {}, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body: body ?? {} }),
  patch: (path, body) => request(path, { method: "PATCH", body: body ?? {} }),
  delete: (path) => request(path, { method: "DELETE" }),
};
