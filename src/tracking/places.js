import { MAP_TOKEN } from "./config.js";

/** Mapbox forward-geocoding URL. Always limited to Nepal (so "Butwal" can't resolve to a namesake abroad); `near` biases results to the area. */
export function geocodeUrl(text, { token = MAP_TOKEN, near = null, limit = 1, autocomplete = false } = {}) {
  const q = new URLSearchParams({ access_token: token, country: "np", limit: String(limit), autocomplete: String(autocomplete), language: "en" });
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) q.set("proximity", `${near.lng},${near.lat}`);
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?${q}`;
}

/** Mapbox response → [{ id, name, lat, lng }], dropping anything without usable coordinates. */
export function parsePlaces(json) {
  return (json?.features ?? []).flatMap((f) => {
    const [lng, lat] = f?.center ?? [];
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ id: String(f.id ?? `${lat},${lng}`), name: f.place_name || f.text || "Unnamed place", lat, lng }] : [];
  });
}

/** Search-as-you-type for the pin picker. No token / empty text / failure → []. */
export async function searchPlaces(text, { near = null, signal, fetchImpl = globalThis.fetch } = {}) {
  const t = (text || "").trim();
  if (t.length < 3 || !MAP_TOKEN) return [];
  try {
    const r = await fetchImpl(geocodeUrl(t, { near, limit: 5, autocomplete: true }), { signal });
    return r.ok ? parsePlaces(await r.json()) : [];
  } catch { return []; }
}
