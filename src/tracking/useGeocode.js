import { useEffect, useState } from "react";
import { MAP_TOKEN } from "./config.js";

const cache = new Map();

/**
 * Display-only fallback for an address that has no saved map pin: look up the text address once with Mapbox Geocoding.
 * The result is ALWAYS labelled approximate by the caller — it is never written back, never used for ETA or routing decisions
 * on the server, and never replaces a real pin. No token / no match → null.
 */
export function useGeocode(text, { enabled = true, near = null } = {}) {
  const [point, setPoint] = useState(() => (text ? cache.get(text) ?? null : null));
  useEffect(() => {
    if (!enabled || !text || !MAP_TOKEN) { setPoint(null); return undefined; }
    if (cache.has(text)) { setPoint(cache.get(text)); return undefined; }
    const ac = new AbortController();
    const prox = near ? `&proximity=${near.lng},${near.lat}` : "";
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?limit=1&access_token=${encodeURIComponent(MAP_TOKEN)}${prox}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.features?.[0]?.center;
        const p = c ? { lat: c[1], lng: c[0] } : null;
        cache.set(text, p); setPoint(p);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [text, enabled, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return point;
}
