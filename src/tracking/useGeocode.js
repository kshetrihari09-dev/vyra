import { useEffect, useState } from "react";
import { MAP_TOKEN } from "./config.js";
import { geocodeUrl, parsePlaces } from "./places.js";

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
    fetch(geocodeUrl(text, { near }), { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = parsePlaces(j)[0] ?? null; // Nepal-only (see geocodeUrl), so a namesake abroad can't win
        cache.set(text, p); setPoint(p);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [text, enabled, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return point;
}
